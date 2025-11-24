// Network Operations

export function setupNetworkListener(onRequestCaptured) {
    chrome.devtools.network.onRequestFinished.addListener((request) => {
        // Filter out data URLs or extension schemes
        if (!request.request.url.startsWith('http')) return;

        // Filter out static resources (JS, CSS, images, fonts, etc.)
        const url = request.request.url.toLowerCase();
        const staticExtensions = [
            '.css', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
            '.woff', '.woff2', '.ttf', '.eot', '.otf',
            '.mp4', '.webm', '.mp3', '.wav',
            '.pdf'
        ];

        // Check if URL ends with any static extension
        const isStatic = staticExtensions.some(ext => {
            return url.endsWith(ext) || url.includes(ext + '?');
        });

        if (isStatic) {
            // console.log('Skipping static resource:', request.request.url);
            return;
        }

        // Store the capture time for relative time display
        request.capturedAt = Date.now();

        onRequestCaptured(request);
    });
}

export function parseRequest(rawContent, useHttps) {
    const lines = rawContent.split('\n');
    if (lines.length === 0) {
        throw new Error('No content to send');
    }

    // Parse Request Line
    const requestLine = lines[0].trim();
    const reqLineParts = requestLine.split(' ');
    if (reqLineParts.length < 2) {
        throw new Error('Invalid Request Line. Format: METHOD PATH HTTP/1.1');
    }

    const method = reqLineParts[0].toUpperCase();
    const path = reqLineParts[1];

    // Split Headers and Body
    let headers = {};
    let bodyText = null;
    let isBody = false;
    let host = '';

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        if (!isBody) {
            if (line.trim() === '') {
                isBody = true;
                continue;
            }

            // Skip HTTP/2 pseudo-headers (start with :)
            if (line.trim().startsWith(':')) {
                continue;
            }

            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();

                if (key && value) {
                    if (key.toLowerCase() === 'host') {
                        host = value;
                    } else {
                        headers[key] = value;
                    }
                }
            }
        } else {
            // Body content
            if (bodyText === null) bodyText = line;
            else bodyText += '\n' + line;
        }
    }

    if (!host) {
        throw new Error('Host header is missing!');
    }

    const scheme = useHttps ? 'https' : 'http';
    const url = `${scheme}://${host}${path}`;

    // Filter out forbidden headers
    const forbiddenHeaders = [
        'accept-charset', 'accept-encoding', 'access-control-request-headers',
        'access-control-request-method', 'connection', 'content-length',
        'cookie', 'cookie2', 'date', 'dnt', 'expect', 'host', 'keep-alive',
        'origin', 'referer', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via'
    ];

    const filteredHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
        const lowerKey = key.toLowerCase();
        const isForbidden = forbiddenHeaders.includes(lowerKey) ||
            lowerKey.startsWith('sec-') ||
            lowerKey.startsWith('proxy-');

        if (!isForbidden) {
            if (/^[a-zA-Z0-9\-_]+$/.test(key)) {
                filteredHeaders[key] = value;
            }
        }
    }

    const options = {
        method: method,
        headers: filteredHeaders,
        mode: 'cors',
        credentials: 'omit'
    };

    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && bodyText) {
        options.body = bodyText;
    }

    return { url, options, method, filteredHeaders, bodyText };
}

export async function executeRequest(url, options) {
    const startTime = performance.now();
    const response = await fetch(url, options);
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(0);

    const responseBody = await response.text();
    const size = new TextEncoder().encode(responseBody).length;

    return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: responseBody,
        size: size,
        duration: duration
    };
}
