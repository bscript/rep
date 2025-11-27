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

// Listener functions
function handleBeforeRequest(details) {
    if (ports.size === 0) return;
    if (details.url.startsWith('chrome-extension://')) return;

    requestMap.set(details.requestId, {
        requestId: details.requestId,
        url: details.url,
        method: details.method,
        type: details.type,
        timeStamp: Date.now(),
        requestBody: parseRequestBody(details.requestBody),
        tabId: details.tabId,
        initiator: details.initiator
    });
}

function handleBeforeSendHeaders(details) {
    if (ports.size === 0) return;
    const req = requestMap.get(details.requestId);
    if (req) {
        req.requestHeaders = details.requestHeaders;
    }
}

function handleCompleted(details) {
    if (ports.size === 0) return;
    const req = requestMap.get(details.requestId);
    if (req) {
        req.statusCode = details.statusCode;
        req.statusLine = details.statusLine;
        req.responseHeaders = details.responseHeaders;

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

        requestMap.delete(details.requestId);
    }
}

function handleErrorOccurred(details) {
    requestMap.delete(details.requestId);
}

function setupListeners() {
    if (chrome.webRequest) {
        if (!chrome.webRequest.onBeforeRequest.hasListener(handleBeforeRequest)) {
            chrome.webRequest.onBeforeRequest.addListener(
                handleBeforeRequest,
                { urls: ["<all_urls>"] },
                ["requestBody"]
            );
        }
        if (!chrome.webRequest.onBeforeSendHeaders.hasListener(handleBeforeSendHeaders)) {
            chrome.webRequest.onBeforeSendHeaders.addListener(
                handleBeforeSendHeaders,
                { urls: ["<all_urls>"] },
                ["requestHeaders"]
            );
        }
        if (!chrome.webRequest.onCompleted.hasListener(handleCompleted)) {
            chrome.webRequest.onCompleted.addListener(
                handleCompleted,
                { urls: ["<all_urls>"] },
                ["responseHeaders"]
            );
        }
        if (!chrome.webRequest.onErrorOccurred.hasListener(handleErrorOccurred)) {
            chrome.webRequest.onErrorOccurred.addListener(
                handleErrorOccurred,
                { urls: ["<all_urls>"] }
            );
        }
        console.log("WebRequest listeners registered");
    } else {
        console.log("WebRequest permission not granted");
    }
}

// Initial setup
setupListeners();

// Listen for permission changes
if (chrome.permissions) {
    chrome.permissions.onAdded.addListener((permissions) => {
        if (permissions.permissions && permissions.permissions.includes('webRequest')) {
            setupListeners();
        }
    });
}

// Periodic cleanup of stale requests (older than 1 minute)
setInterval(() => {
    const now = Date.now();
    for (const [id, req] of requestMap.entries()) {
        if (now - req.timeStamp > 60000) {
            requestMap.delete(id);
        }
    }
}, 30000);

// Proxy fetch to bypass CORS using extension host permissions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'proxyFetch') {
        (async () => {
            try {
                const { url, options } = message;
                const res = await fetch(url, options || {});
                const text = await res.text();
                const headersObj = {};
                res.headers.forEach((v, k) => { headersObj[k] = v; });
                sendResponse({
                    ok: true,
                    status: res.status,
                    statusText: res.statusText,
                    headers: headersObj,
                    body: text
                });
            } catch (e) {
                sendResponse({ ok: false, error: e.message });
            }
        })();
        return true; // keep the message channel open for async sendResponse
    }
});
