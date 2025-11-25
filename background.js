// Background service worker
const ports = new Set();
const requestMap = new Map();

// Handle connections from DevTools panels
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "rep-panel") return;
    console.log("DevTools panel connected");
    ports.add(port);

    port.onDisconnect.addListener(() => {
        console.log("DevTools panel disconnected");
        ports.delete(port);
    });

    // Listen for messages from panel (e.g. to toggle capture)
    port.onMessage.addListener((msg) => {
        if (msg.type === 'ping') {
            port.postMessage({ type: 'pong' });
        }
    });
});

// Helper to process request body
function parseRequestBody(requestBody) {
    if (!requestBody) return null;

    if (requestBody.raw && requestBody.raw.length > 0) {
        try {
            const decoder = new TextDecoder('utf-8');
            return requestBody.raw.map(bytes => {
                if (bytes.bytes) {
                    return decoder.decode(bytes.bytes);
                }
                return '';
            }).join('');
        } catch (e) {
            console.error('Error decoding request body:', e);
            return null;
        }
    }

    if (requestBody.formData) {
        // Convert formData object to URL encoded string
        const params = new URLSearchParams();
        for (const [key, values] of Object.entries(requestBody.formData)) {
            values.forEach(value => params.append(key, value));
        }
        return params.toString();
    }

    return null;
}

// 1. Capture Request Method, URL, Body
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (ports.size === 0) return;

        // Filter out extension requests
        if (details.url.startsWith('chrome-extension://')) return;

        requestMap.set(details.requestId, {
            requestId: details.requestId,
            url: details.url,
            method: details.method,
            type: details.type,
            timeStamp: Date.now(),
            requestBody: parseRequestBody(details.requestBody),
            tabId: details.tabId
        });
    },
    { urls: ["<all_urls>"] },
    ["requestBody"]
);

// 2. Capture Request Headers
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        if (ports.size === 0) return;

        const req = requestMap.get(details.requestId);
        if (req) {
            req.requestHeaders = details.requestHeaders;
        }
    },
    { urls: ["<all_urls>"] },
    ["requestHeaders"]
);

// 3. Capture Response Headers & Status, then Send
chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (ports.size === 0) return;

        const req = requestMap.get(details.requestId);
        if (req) {
            req.statusCode = details.statusCode;
            req.statusLine = details.statusLine; // HTTP/1.1 200 OK
            req.responseHeaders = details.responseHeaders;

            // Send to all connected panels
            const message = {
                type: 'captured_request',
                data: req
            };

            ports.forEach(p => {
                try {
                    p.postMessage(message);
                } catch (e) {
                    console.error('Error sending to port:', e);
                    ports.delete(p);
                }
            });

            // Cleanup
            requestMap.delete(details.requestId);
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

// Cleanup on error
chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
        requestMap.delete(details.requestId);
    },
    { urls: ["<all_urls>"] }
);

// Periodic cleanup of stale requests (older than 1 minute)
setInterval(() => {
    const now = Date.now();
    for (const [id, req] of requestMap.entries()) {
        if (now - req.timeStamp > 60000) {
            requestMap.delete(id);
        }
    }
}, 30000);
