// panel.js

// State
let requests = [];
let selectedRequest = null;
let currentFilter = 'all';
let currentSearchTerm = '';
let useRegex = false;
let requestHistory = [];
let historyIndex = -1;
let undoStack = [];
let redoStack = [];

const STAR_ICON_FILLED = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';
const STAR_ICON_OUTLINE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.01 4.38.38-3.32 2.88 1 4.28L12 15.4z"/></svg>';

// DOM Elements
const requestList = document.getElementById('request-list');
const searchBar = document.getElementById('search-bar');
const regexToggle = document.getElementById('regex-toggle');
const rawRequestInput = document.getElementById('raw-request-input');
const useHttpsCheckbox = document.getElementById('use-https');
const sendBtn = document.getElementById('send-btn');
const rawResponseDisplay = document.getElementById('raw-response-display');
const resStatus = document.getElementById('res-status');
const resTime = document.getElementById('res-time');
const resSize = document.getElementById('res-size');
const historyBackBtn = document.getElementById('history-back');
const historyFwdBtn = document.getElementById('history-fwd');
const copyReqBtn = document.getElementById('copy-req-btn');
const copyResBtn = document.getElementById('copy-res-btn');
const screenshotBtn = document.getElementById('screenshot-btn');
const contextMenu = document.getElementById('context-menu');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Wait for html2canvas to be available
    waitForHtml2Canvas();

    setupNetworkListener();
    setupEventListeners();
    setupResizeHandle();
    setupSidebarResize();

    // Global error handler to catch any uncaught errors
    window.addEventListener('error', (e) => {
        console.error('Global error caught:', e.error);
        if (rawResponseDisplay) {
            rawResponseDisplay.textContent = `UNCAUGHT ERROR: \n${e.error} \n\nCheck console for details.`;
            rawResponseDisplay.style.display = 'block';
        }
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled promise rejection:', e.reason);
        if (rawResponseDisplay) {
            rawResponseDisplay.textContent = `PROMISE REJECTION: \n${e.reason} \n\nCheck console for details.`;
            rawResponseDisplay.style.display = 'block';
        }
    });
});

// Context Menu Functions
function setupContextMenu() {
    // Right-click on editors
    [rawRequestInput, rawResponseDisplay].forEach(editor => {
        if (!editor) return;

        editor.addEventListener('contextmenu', (e) => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (!selectedText) {
                return; // Don't show menu if no text selected
            }

            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, editor);
        });
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    // Handle menu item clicks (only items with data-action, not the parent)
    contextMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.context-menu-item[data-action]');
        if (item) {
            e.stopPropagation();
            const action = item.dataset.action;
            if (action) {
                handleEncodeDecode(action);
                hideContextMenu();
            }
        }
    });

    // Keyboard shortcut: Ctrl+E (or Cmd+E on Mac) to show context menu
    document.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modKey = isMac ? e.metaKey : e.ctrlKey;

        if (modKey && e.key === 'e' && !e.shiftKey && !e.altKey) {
            const activeElement = document.activeElement;
            if (activeElement === rawRequestInput || activeElement === rawResponseDisplay) {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();

                if (selectedText) {
                    e.preventDefault();
                    const rect = activeElement.getBoundingClientRect();
                    const range = selection.getRangeAt(0);
                    const rect2 = range.getBoundingClientRect();
                    showContextMenu(rect2.right, rect2.top + rect2.height / 2, activeElement);
                }
            }
        }
    });
}

function showContextMenu(x, y, targetElement) {
    contextMenu.dataset.target = targetElement === rawRequestInput ? 'request' : 'response';
    contextMenu.classList.add('show');
    contextMenu.classList.remove('open-left');

    // Reset to defaults to measure
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.style.bottom = 'auto';
    contextMenu.style.right = 'auto';

    // Reset submenu alignment
    const submenuItems = contextMenu.querySelectorAll('.has-submenu');
    submenuItems.forEach(item => item.classList.remove('submenu-align-bottom'));

    const rect = contextMenu.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Vertical Adjustment (Main Menu)
    if (rect.bottom > winHeight) {
        contextMenu.style.top = 'auto';
        contextMenu.style.bottom = (winHeight - y) + 'px';
    }

    // Horizontal Adjustment (Main Menu)
    if (rect.right > winWidth) {
        contextMenu.style.left = 'auto';
        contextMenu.style.right = (winWidth - x) + 'px';
        contextMenu.classList.add('open-left');
    }

    // Check Submenu Overflow
    submenuItems.forEach(item => {
        const submenu = item.querySelector('.context-submenu');
        if (submenu) {
            // Temporarily show to measure
            submenu.style.display = 'block';
            submenu.style.visibility = 'hidden';
            const subRect = submenu.getBoundingClientRect();
            submenu.style.display = '';
            submenu.style.visibility = '';

            // If submenu goes off bottom, align to bottom
            // We use the item's top position + submenu height to predict
            const itemRect = item.getBoundingClientRect();
            if (itemRect.top + subRect.height > winHeight) {
                item.classList.add('submenu-align-bottom');
            }
        }
    });
}

function hideContextMenu() {
    contextMenu.classList.remove('show');
}

function handleEncodeDecode(action) {
    const targetType = contextMenu.dataset.target;
    const editor = targetType === 'request' ? rawRequestInput : rawResponseDisplay;

    if (!editor) return;

    // Get selected text
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    if (!selectedText.trim()) return;

    // Save undo state BEFORE making any changes (only for request editor)
    const isRequestEditor = editor === rawRequestInput;
    if (isRequestEditor) {
        // Save current state before conversion
        saveUndoState();
        // Temporarily disable input event listener to prevent interference
        if (rawRequestInput.undoTimeout) {
            clearTimeout(rawRequestInput.undoTimeout);
        }
        rawRequestInput._undoDisabled = true;
    }

    let transformedText = '';

    try {
        switch (action) {
            case 'base64-encode':
                transformedText = btoa(unescape(encodeURIComponent(selectedText)));
                break;
            case 'base64-decode':
                transformedText = decodeURIComponent(escape(atob(selectedText)));
                break;
            case 'url-decode':
                transformedText = decodeURIComponent(selectedText);
                break;
            case 'url-encode-key':
                // URL encode only key/reserved characters (like : / ? # [ ] @ ! $ & ' ( ) * + , ; =)
                // encodeURIComponent already does this, but we can be more explicit
                transformedText = encodeURIComponent(selectedText);
                break;
            case 'url-encode-all':
                // URL encode ALL characters (even alphanumeric)
                transformedText = selectedText.split('').map(char => {
                    return '%' + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
                }).join('');
                break;
            case 'url-encode-unicode':
                // URL encode all characters, handling unicode properly
                transformedText = selectedText.split('').map(char => {
                    const code = char.charCodeAt(0);
                    if (code > 127) {
                        // Unicode character - use encodeURIComponent for proper UTF-8 encoding
                        return encodeURIComponent(char);
                    } else {
                        // Regular ASCII - encode all
                        return '%' + code.toString(16).toUpperCase().padStart(2, '0');
                    }
                }).join('');
                break;
            case 'jwt-decode':
                // JWT decode - decode header and payload parts
                transformedText = decodeJWT(selectedText);
                break;
            default:
                return;
        }

        // Replace selected text
        if (editor.contentEditable === 'true') {
            // For contenteditable div
            range.deleteContents();
            const textNode = document.createTextNode(transformedText);
            range.insertNode(textNode);

            // Update selection
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // For pre element, we need to update innerHTML/innerText
            const fullText = editor.textContent;
            const start = editor.textContent.indexOf(selectedText);
            if (start !== -1) {
                const before = fullText.substring(0, start);
                const after = fullText.substring(start + selectedText.length);
                editor.textContent = before + transformedText + after;
            }
        }

        // Re-apply syntax highlighting if it's the request editor
        if (targetType === 'request' && editor === rawRequestInput) {
            const currentContent = editor.innerText || editor.textContent;
            editor.innerHTML = highlightHTTP(currentContent);

            // Save the new state after conversion (re-enable undo tracking)
            setTimeout(() => {
                if (isRequestEditor) {
                    rawRequestInput._undoDisabled = false;
                    saveUndoState();
                }
            }, 0);

            // Try to restore cursor position after syntax highlighting
            try {
                const newSelection = window.getSelection();
                const newRange = document.createRange();
                const textNodes = getTextNodesIn(editor);
                let charCount = 0;
                let startNode = null;
                let startOffset = 0;
                const fullTextBefore = editor.innerText || editor.textContent;
                const start = fullTextBefore.indexOf(selectedText);
                const cursorPos = start !== -1 ? start + transformedText.length : 0;

                for (const node of textNodes) {
                    const nodeLength = node.textContent.length;
                    if (charCount + nodeLength >= cursorPos) {
                        startNode = node;
                        startOffset = cursorPos - charCount;
                        break;
                    }
                    charCount += nodeLength;
                }

                if (startNode) {
                    newRange.setStart(startNode, Math.min(startOffset, startNode.textContent.length));
                    newRange.collapse(true);
                    newSelection.removeAllRanges();
                    newSelection.addRange(newRange);
                    editor.focus();
                }
            } catch (e) {
                // If cursor positioning fails, that's okay
                if (isRequestEditor) {
                    rawRequestInput._undoDisabled = false;
                    saveUndoState();
                }
            }
        } else {
            // For response editor, just re-enable undo if needed
            if (isRequestEditor) {
                rawRequestInput._undoDisabled = false;
            }
        }

    } catch (error) {
        console.error('Encode/decode error:', error);
        if (isRequestEditor) {
            rawRequestInput._undoDisabled = false;
        }
        alert(`Error: ${error.message}\n\nMake sure the selected text is valid for this operation.\nBase64 decode requires valid base64 encoded text.`);
    }
}

// Helper function to get text nodes in an element
function getTextNodesIn(node) {
    let textNodes = [];
    if (node.nodeType === 3) {
        textNodes.push(node);
    } else {
        for (let i = 0; i < node.childNodes.length; i++) {
            textNodes.push(...getTextNodesIn(node.childNodes[i]));
        }
    }
    return textNodes;
}

// JWT Decode Function
function decodeJWT(jwt) {
    try {
        // Remove whitespace
        jwt = jwt.trim();

        // Split JWT into parts (header.payload.signature)
        const parts = jwt.split('.');

        if (parts.length !== 3) {
            throw new Error('Invalid JWT format. Expected format: header.payload.signature');
        }

        // Base64URL decode helper
        function base64UrlDecode(str) {
            // Replace base64url characters with base64 characters
            str = str.replace(/-/g, '+').replace(/_/g, '/');

            // Add padding if needed
            while (str.length % 4) {
                str += '=';
            }

            // Decode base64
            try {
                const decoded = atob(str);
                // Convert to JSON string
                return decodeURIComponent(
                    decoded.split('').map(function (c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join('')
                );
            } catch (e) {
                throw new Error('Failed to decode base64: ' + e.message);
            }
        }

        // Decode header
        let header;
        try {
            const headerJson = base64UrlDecode(parts[0]);
            header = JSON.parse(headerJson);
        } catch (e) {
            throw new Error('Failed to decode JWT header: ' + e.message);
        }

        // Decode payload
        let payload;
        try {
            const payloadJson = base64UrlDecode(parts[1]);
            payload = JSON.parse(payloadJson);
        } catch (e) {
            throw new Error('Failed to decode JWT payload: ' + e.message);
        }

        // Format output
        let output = 'JWT Decoded:\n\n';
        output += '=== HEADER ===\n';
        output += JSON.stringify(header, null, 2);
        output += '\n\n=== PAYLOAD ===\n';
        output += JSON.stringify(payload, null, 2);
        output += '\n\n=== SIGNATURE ===\n';
        output += parts[2] + '\n';
        output += '(Signature verification not performed)';

        // Add helpful info if exp claim exists
        if (payload.exp) {
            const expDate = new Date(payload.exp * 1000);
            const now = new Date();
            const isExpired = expDate < now;
            output += '\n\n=== TOKEN INFO ===\n';
            output += `Expiration: ${expDate.toISOString()}\n`;
            output += `Status: ${isExpired ? 'EXPIRED' : 'VALID'}\n`;
            if (isExpired) {
                output += `Expired ${Math.floor((now - expDate) / 1000 / 60)} minutes ago`;
            } else {
                output += `Expires in ${Math.floor((expDate - now) / 1000 / 60)} minutes`;
            }
        }

        return output;

    } catch (error) {
        throw new Error('JWT decode failed: ' + error.message);
    }
}

// Undo/Redo Functions
function setupUndoRedo() {
    // Track changes in request editor
    rawRequestInput.addEventListener('input', () => {
        // Skip if undo is temporarily disabled (during programmatic changes)
        if (rawRequestInput._undoDisabled) {
            return;
        }
        // Debounce undo state saving
        clearTimeout(rawRequestInput.undoTimeout);
        rawRequestInput.undoTimeout = setTimeout(() => {
            if (!rawRequestInput._undoDisabled) {
                saveUndoState();
            }
        }, 500);
    });

    // Handle Ctrl+Z / Cmd+Z for undo
    rawRequestInput.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modKey = isMac ? e.metaKey : e.ctrlKey;

        if (modKey && e.key === 'z' && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            undo();
        } else if (modKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redo();
        }
    });
}

function saveUndoState() {
    // Skip if undo is temporarily disabled
    if (rawRequestInput._undoDisabled) {
        return;
    }
    const currentContent = rawRequestInput.innerText || rawRequestInput.textContent;
    // Don't save if content hasn't changed
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === currentContent) {
        return;
    }
    undoStack.push(currentContent);
    // Limit undo stack size
    if (undoStack.length > 50) {
        undoStack.shift();
    }
    // Clear redo stack when new change is made
    redoStack = [];
}

function undo() {
    if (undoStack.length <= 1) return; // Keep at least one state

    // Save current state to redo stack
    const currentContent = rawRequestInput.innerText || rawRequestInput.textContent;
    redoStack.push(currentContent);

    // Remove current state and get previous
    undoStack.pop(); // Remove current
    const previousContent = undoStack[undoStack.length - 1];

    if (previousContent !== undefined) {
        rawRequestInput.textContent = previousContent;
        rawRequestInput.innerHTML = highlightHTTP(previousContent);
    }
}

function redo() {
    if (redoStack.length === 0) return;

    const nextContent = redoStack.pop();
    if (nextContent !== undefined) {
        undoStack.push(nextContent);
        rawRequestInput.textContent = nextContent;
        rawRequestInput.innerHTML = highlightHTTP(nextContent);
    }
}

function waitForHtml2Canvas() {
    // Check if html2canvas is already loaded (check both window.html2canvas and global html2canvas)
    const checkHtml2Canvas = () => {
        return typeof html2canvas !== 'undefined' ||
            (typeof window !== 'undefined' && typeof window.html2canvas !== 'undefined');
    };

    if (checkHtml2Canvas()) {
        console.log('html2canvas loaded');
        return;
    }

    // Wait for it to load (check every 100ms for up to 5 seconds)
    let attempts = 0;
    const maxAttempts = 50;
    const checkInterval = setInterval(() => {
        attempts++;
        if (checkHtml2Canvas()) {
            console.log('html2canvas loaded after', attempts * 100, 'ms');
            clearInterval(checkInterval);
        } else if (attempts >= maxAttempts) {
            console.error('html2canvas failed to load after 5 seconds');
            clearInterval(checkInterval);
            // Disable screenshot button if library doesn't load
            if (screenshotBtn) {
                screenshotBtn.disabled = true;
                screenshotBtn.title = 'Screenshot unavailable: html2canvas not loaded';
            }
        }
    }, 100);
}

function setupNetworkListener() {
    chrome.devtools.network.onRequestFinished.addListener((request) => {
        // Filter out data URLs or extension schemes
        if (!request.request.url.startsWith('http')) return;

        // Filter out static resources (JS, CSS, images, fonts, etc.)
        const url = request.request.url.toLowerCase();
        const staticExtensions = [
            '.js', '.css', '.map',
            '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
            '.woff', '.woff2', '.ttf', '.eot', '.otf',
            '.mp4', '.webm', '.mp3', '.wav',
            '.pdf', '.zip', '.tar', '.gz'
        ];

        // Check if URL ends with any static extension
        const isStatic = staticExtensions.some(ext => {
            return url.endsWith(ext) || url.includes(ext + '?');
        });

        if (isStatic) {
            console.log('Skipping static resource:', request.request.url);
            return;
        }

        // Store the capture time for relative time display
        request.capturedAt = Date.now();

        requests.push(request);
        renderRequestItem(request, requests.length - 1);
    });
}

function formatTime(capturedAt) {
    if (!capturedAt) return '';

    const date = new Date(capturedAt);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function renderRequestItem(request, index) {
    const item = document.createElement('div');
    item.className = 'request-item';
    if (request.starred) item.classList.add('starred');
    item.dataset.index = index;
    item.dataset.method = request.request.method;

    const methodSpan = document.createElement('span');
    methodSpan.className = `req-method ${request.request.method}`;
    methodSpan.textContent = request.request.method;

    const urlSpan = document.createElement('span');
    urlSpan.className = 'req-url';

    try {
        const urlObj = new URL(request.request.url);
        urlSpan.textContent = urlObj.pathname + urlObj.search;
    } catch (e) {
        urlSpan.textContent = request.request.url;
    }
    urlSpan.title = request.request.url;

    // Time span
    const timeSpan = document.createElement('span');
    timeSpan.className = 'req-time';
    timeSpan.textContent = formatTime(request.capturedAt);
    if (request.capturedAt) {
        const date = new Date(request.capturedAt);
        timeSpan.title = date.toLocaleTimeString();
    }

    // Actions container
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';

    // Star Button
    const starBtn = document.createElement('button');
    starBtn.className = `star-btn ${request.starred ? 'active' : ''}`;
    starBtn.innerHTML = request.starred ? STAR_ICON_FILLED : STAR_ICON_OUTLINE;

    starBtn.title = request.starred ? 'Unstar' : 'Star request';
    starBtn.onclick = (e) => {
        e.stopPropagation();
        toggleStar(request);
    };

    actionsDiv.appendChild(starBtn);

    item.appendChild(methodSpan);
    item.appendChild(urlSpan);
    item.appendChild(timeSpan);
    item.appendChild(actionsDiv);

    item.addEventListener('click', () => selectRequest(index));

    // Remove empty state if present
    const emptyState = requestList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    requestList.appendChild(item);
    filterRequests();
}

function toggleStar(request) {
    request.starred = !request.starred;
    console.log('Toggled star:', request.starred, request.request.url);

    const requestIndex = requests.indexOf(request);
    if (requestIndex !== -1) {
        const item = requestList.querySelector(`.request-item[data-index="${requestIndex}"]`);
        if (item) {
            item.classList.toggle('starred', request.starred);
            const starBtn = item.querySelector('.star-btn');
            if (starBtn) {
                starBtn.classList.toggle('active', request.starred);
                starBtn.innerHTML = request.starred ? STAR_ICON_FILLED : STAR_ICON_OUTLINE;
                starBtn.title = request.starred ? 'Unstar' : 'Star request';
            }
        }
    }

    // Refresh list while maintaining scroll position
    const scrollTop = requestList.scrollTop;
    filterRequests();
    requestList.scrollTop = scrollTop;
}

function selectRequest(index) {
    selectedRequest = requests[index];

    // Highlight in list
    document.querySelectorAll('.request-item').forEach(el => el.classList.remove('selected'));
    requestList.children[index].classList.add('selected');

    // Parse URL
    const urlObj = new URL(selectedRequest.request.url);
    const path = urlObj.pathname + urlObj.search;
    const method = selectedRequest.request.method;
    const httpVersion = selectedRequest.request.httpVersion || 'HTTP/1.1';

    // Set HTTPS toggle
    useHttpsCheckbox.checked = urlObj.protocol === 'https:';

    // Construct Raw Request
    // Line 1: METHOD PATH VERSION
    let rawText = `${method} ${path} ${httpVersion} \n`;

    // Host Header (Ensure it's present and maybe first?)
    // Filter out existing Host header to avoid duplicates if we re-add it,
    // but usually we just list what was captured.
    // However, for clarity, let's just dump headers as is.
    // If Host is missing in captured headers (rare), we might want to add it.

    let headers = selectedRequest.request.headers;

    // Check if Host header exists
    const hasHost = headers.some(h => h.name.toLowerCase() === 'host');
    if (!hasHost) {
        rawText += `Host: ${urlObj.host} \n`;
    }

    rawText += headers
        .map(h => `${h.name}: ${h.value} `)
        .join('\n');

    // Body
    if (selectedRequest.request.postData && selectedRequest.request.postData.text) {
        let bodyText = selectedRequest.request.postData.text;

        // Try to beautify JSON
        try {
            const jsonBody = JSON.parse(bodyText);
            bodyText = JSON.stringify(jsonBody, null, 2);
        } catch (e) {
            // Not JSON or invalid JSON, use as-is
        }

        rawText += '\n\n' + bodyText;
    }

    rawRequestInput.innerHTML = highlightHTTP(rawText);

    // Initialize History
    requestHistory = [];
    historyIndex = -1;
    addToHistory(rawText, useHttpsCheckbox.checked);

    // Initialize Undo/Redo
    undoStack = [rawText];
    redoStack = [];

    // Initialize Undo/Redo
    undoStack = [rawText];
    redoStack = [];

    // Clear Response
    rawResponseDisplay.textContent = '';
    resStatus.textContent = '';
    resStatus.className = 'status-badge';
    resTime.textContent = '';
    resSize.textContent = '';
}

function setupEventListeners() {
    // Send Request
    sendBtn.addEventListener('click', async () => {
        await sendRequest();
    });

    // Search Bar
    searchBar.addEventListener('input', (e) => {
        currentSearchTerm = useRegex ? e.target.value : e.target.value.toLowerCase();
        filterRequests();
    });

    // Regex Toggle
    regexToggle.addEventListener('click', () => {
        useRegex = !useRegex;
        regexToggle.classList.toggle('active', useRegex);

        // Update search term based on mode
        if (useRegex) {
            currentSearchTerm = searchBar.value;
            searchBar.placeholder = 'Filter with regex (e.g., /user/\\d+)...';
        } else {
            currentSearchTerm = searchBar.value.toLowerCase();
            searchBar.placeholder = 'Filter requests...';
        }

        filterRequests();
    });

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Update filter
            currentFilter = e.target.dataset.filter;
            filterRequests();
        });
    });

    // Clear All Button
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            clearAllRequests();
        });
    }

    // History Navigation
    historyBackBtn.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            loadHistoryState(historyIndex);
        }
    });

    historyFwdBtn.addEventListener('click', () => {
        if (historyIndex < requestHistory.length - 1) {
            historyIndex++;
            loadHistoryState(historyIndex);
        }
    });

    // Copy Buttons
    copyReqBtn.addEventListener('click', () => {
        const text = rawRequestInput.innerText;
        copyToClipboard(text, copyReqBtn);
    });

    copyResBtn.addEventListener('click', () => {
        const text = rawResponseDisplay.innerText;
        copyToClipboard(text, copyResBtn);
    });

    // Screenshot Button
    screenshotBtn.addEventListener('click', async () => {
        await captureScreenshot();
    });

    // Context Menu for Encode/Decode
    setupContextMenu();

    // Undo/Redo for request editor
    setupUndoRedo();
}

async function copyToClipboard(text, btn) {
    try {
        // Try modern API first
        await navigator.clipboard.writeText(text);
        showCopySuccess(btn);
    } catch (err) {
        console.warn('Clipboard API failed, trying fallback:', err);

        // Fallback: create temporary textarea
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;

            // Ensure it's not visible but part of DOM
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '0';
            document.body.appendChild(textArea);

            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (successful) {
                showCopySuccess(btn);
            } else {
                throw new Error('execCommand copy failed');
            }
        } catch (fallbackErr) {
            console.error('Copy failed:', fallbackErr);
            // Show error state on button
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#f28b82"/></svg>';
            setTimeout(() => {
                btn.innerHTML = originalHtml;
            }, 1500);
        }
    }
}

function showCopySuccess(btn) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#81c995"/></svg>';

    setTimeout(() => {
        btn.innerHTML = originalHtml;
    }, 1500);
}

async function captureScreenshot() {
    // Get html2canvas function (check both global and window scope)
    let html2canvasFn = typeof html2canvas !== 'undefined'
        ? html2canvas
        : (typeof window !== 'undefined' && typeof window.html2canvas !== 'undefined'
            ? window.html2canvas
            : null);

    if (!html2canvasFn) {
        // Try waiting a moment for the script to load
        await new Promise(resolve => setTimeout(resolve, 200));
        html2canvasFn = typeof html2canvas !== 'undefined'
            ? html2canvas
            : (typeof window !== 'undefined' && typeof window.html2canvas !== 'undefined'
                ? window.html2canvas
                : null);

        if (!html2canvasFn) {
            console.error('html2canvas library not loaded');
            const originalHtml = screenshotBtn.innerHTML;
            screenshotBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#f28b82"/></svg>';
            setTimeout(() => {
                screenshotBtn.innerHTML = originalHtml;
            }, 2000);
            return;
        }
    }

    // Show loading state
    const originalHtml = screenshotBtn.innerHTML;
    screenshotBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill="currentColor"/></svg>';
    screenshotBtn.disabled = true;

    try {
        // Capture the main content area (both request and response panes)
        const mainContent = document.querySelector('.main-content');

        if (!mainContent) {
            throw new Error('Main content area not found');
        }

        const requestPane = document.querySelector('.request-pane');
        const responsePane = document.querySelector('.response-pane');
        const requestPaneBody = requestPane ? requestPane.querySelector('.pane-body') : null;
        const responsePaneBody = responsePane ? responsePane.querySelector('.pane-body') : null;
        const requestEditor = document.getElementById('raw-request-input');
        const responseDisplay = document.getElementById('raw-response-display');

        // Store original styles and scroll positions
        const originalStyles = {
            requestPaneBody: requestPaneBody ? {
                overflow: requestPaneBody.style.overflow,
                height: requestPaneBody.style.height,
                maxHeight: requestPaneBody.style.maxHeight
            } : null,
            responsePaneBody: responsePaneBody ? {
                overflow: responsePaneBody.style.overflow,
                height: responsePaneBody.style.height,
                maxHeight: responsePaneBody.style.maxHeight
            } : null,
            requestEditor: requestEditor ? {
                overflow: requestEditor.style.overflow,
                height: requestEditor.style.height,
                maxHeight: requestEditor.style.maxHeight
            } : null,
            responseDisplay: responseDisplay ? {
                overflow: responseDisplay.style.overflow,
                height: responseDisplay.style.height,
                maxHeight: responseDisplay.style.maxHeight
            } : null,
            mainContent: {
                overflow: mainContent.style.overflow,
                height: mainContent.style.height
            }
        };

        const originalScrollPositions = {
            requestEditor: requestEditor ? requestEditor.scrollTop : 0,
            responseDisplay: responseDisplay ? responseDisplay.scrollTop : 0,
            mainContent: mainContent.scrollTop
        };

        // Temporarily expand elements to show full content
        if (requestPaneBody) {
            requestPaneBody.style.overflow = 'visible';
            requestPaneBody.style.height = 'auto';
            requestPaneBody.style.maxHeight = 'none';
        }

        if (responsePaneBody) {
            responsePaneBody.style.overflow = 'visible';
            responsePaneBody.style.height = 'auto';
            responsePaneBody.style.maxHeight = 'none';
        }

        if (requestEditor) {
            requestEditor.style.overflow = 'visible';
            requestEditor.style.height = 'auto';
            requestEditor.style.maxHeight = 'none';
            requestEditor.scrollTop = 0;
        }

        if (responseDisplay) {
            responseDisplay.style.overflow = 'visible';
            responseDisplay.style.height = 'auto';
            responseDisplay.style.maxHeight = 'none';
            responseDisplay.scrollTop = 0;
        }

        mainContent.style.overflow = 'visible';
        mainContent.scrollTop = 0;

        // Calculate full content heights before capturing
        // We need to measure each element's full content height

        if (requestEditor) {
            // Get full content height by temporarily expanding
            requestEditor.style.overflow = 'visible';
            requestEditor.style.height = 'auto';
            requestEditor.style.maxHeight = 'none';

            // Force browser to recalculate layout
            void requestEditor.offsetHeight;

            // Get the actual full height including all content
            const fullEditorHeight = Math.max(
                requestEditor.scrollHeight,
                requestEditor.clientHeight,
                requestEditor.offsetHeight
            );

            requestEditor.style.height = fullEditorHeight + 'px';
        }

        if (responseDisplay) {
            // Get full content height by temporarily expanding
            responseDisplay.style.overflow = 'visible';
            responseDisplay.style.height = 'auto';
            responseDisplay.style.maxHeight = 'none';

            // Force browser to recalculate layout
            void responseDisplay.offsetHeight;

            // Get the actual full height including all content
            const fullDisplayHeight = Math.max(
                responseDisplay.scrollHeight,
                responseDisplay.clientHeight,
                responseDisplay.offsetHeight
            );

            responseDisplay.style.height = fullDisplayHeight + 'px';
        }

        if (requestPaneBody) {
            requestPaneBody.style.height = 'auto';
            void requestPaneBody.offsetHeight; // Force reflow
            requestPaneBody.style.height = Math.max(
                requestPaneBody.scrollHeight,
                requestPaneBody.clientHeight
            ) + 'px';
        }

        if (responsePaneBody) {
            responsePaneBody.style.height = 'auto';
            void responsePaneBody.offsetHeight; // Force reflow
            responsePaneBody.style.height = Math.max(
                responsePaneBody.scrollHeight,
                responsePaneBody.clientHeight
            ) + 'px';
        }

        // Wait for layout recalculation
        await new Promise(resolve => setTimeout(resolve, 300));

        // Calculate full height including all panes and their headers
        let requestPaneFullHeight = 0;
        let responsePaneFullHeight = 0;

        if (requestPane) {
            // Include header height + body height
            const requestHeader = requestPane.querySelector('.pane-header');
            const headerHeight = requestHeader ? requestHeader.offsetHeight : 0;
            requestPaneFullHeight = headerHeight + (requestPaneBody ? requestPaneBody.scrollHeight : 0);
        }

        if (responsePane) {
            // Include header height + body height
            const responseHeader = responsePane.querySelector('.pane-header');
            const headerHeight = responseHeader ? responseHeader.offsetHeight : 0;
            responsePaneFullHeight = headerHeight + (responsePaneBody ? responsePaneBody.scrollHeight : 0);
        }

        // Use the maximum of both panes to ensure we capture everything
        const fullHeight = Math.max(
            requestPaneFullHeight,
            responsePaneFullHeight,
            mainContent.scrollHeight,
            mainContent.offsetHeight
        ) + 100; // Extra padding to ensure we get everything

        const fullWidth = Math.max(
            mainContent.scrollWidth,
            mainContent.offsetWidth
        );

        // Use html2canvas with onclone callback to ensure full content is visible
        const canvas = await html2canvasFn(mainContent, {
            backgroundColor: '#202124',
            scale: 2, // Higher quality
            logging: false,
            useCORS: true,
            allowTaint: true,
            width: fullWidth,
            height: fullHeight,
            scrollX: 0,
            scrollY: 0,
            windowWidth: fullWidth,
            windowHeight: fullHeight,
            onclone: (clonedDoc) => {
                // Modify the cloned document to show full content
                const clonedMainContent = clonedDoc.querySelector('.main-content');
                if (clonedMainContent) {
                    clonedMainContent.style.overflow = 'visible';
                    clonedMainContent.style.height = fullHeight + 'px';

                    // Expand all pane bodies
                    const clonedPaneBodies = clonedDoc.querySelectorAll('.pane-body');
                    clonedPaneBodies.forEach(paneBody => {
                        paneBody.style.overflow = 'visible';
                        paneBody.style.height = 'auto';
                        paneBody.style.maxHeight = 'none';
                        // Force expansion
                        paneBody.style.display = 'flex';
                    });

                    // Expand editors and set explicit heights based on content
                    const clonedRequestEditor = clonedDoc.getElementById('raw-request-input');
                    const clonedResponseDisplay = clonedDoc.getElementById('raw-response-display');

                    if (clonedRequestEditor) {
                        clonedRequestEditor.style.overflow = 'visible';
                        clonedRequestEditor.style.height = 'auto';
                        clonedRequestEditor.style.maxHeight = 'none';
                        clonedRequestEditor.scrollTop = 0;
                        // Force browser to calculate full height
                        void clonedRequestEditor.offsetHeight;
                        clonedRequestEditor.style.height = Math.max(
                            clonedRequestEditor.scrollHeight,
                            clonedRequestEditor.clientHeight
                        ) + 'px';
                    }

                    if (clonedResponseDisplay) {
                        clonedResponseDisplay.style.overflow = 'visible';
                        clonedResponseDisplay.style.height = 'auto';
                        clonedResponseDisplay.style.maxHeight = 'none';
                        clonedResponseDisplay.scrollTop = 0;
                        // Force browser to calculate full height
                        void clonedResponseDisplay.offsetHeight;
                        clonedResponseDisplay.style.height = Math.max(
                            clonedResponseDisplay.scrollHeight,
                            clonedResponseDisplay.clientHeight
                        ) + 'px';
                    }
                }
            }
        });

        // Restore original styles and scroll positions
        if (requestPaneBody && originalStyles.requestPaneBody) {
            requestPaneBody.style.overflow = originalStyles.requestPaneBody.overflow || '';
            requestPaneBody.style.height = originalStyles.requestPaneBody.height || '';
            requestPaneBody.style.maxHeight = originalStyles.requestPaneBody.maxHeight || '';
        }

        if (responsePaneBody && originalStyles.responsePaneBody) {
            responsePaneBody.style.overflow = originalStyles.responsePaneBody.overflow || '';
            responsePaneBody.style.height = originalStyles.responsePaneBody.height || '';
            responsePaneBody.style.maxHeight = originalStyles.responsePaneBody.maxHeight || '';
        }

        if (requestEditor && originalStyles.requestEditor) {
            requestEditor.style.overflow = originalStyles.requestEditor.overflow || '';
            requestEditor.style.height = originalStyles.requestEditor.height || '';
            requestEditor.style.maxHeight = originalStyles.requestEditor.maxHeight || '';
            requestEditor.scrollTop = originalScrollPositions.requestEditor;
        }

        if (responseDisplay && originalStyles.responseDisplay) {
            responseDisplay.style.overflow = originalStyles.responseDisplay.overflow || '';
            responseDisplay.style.height = originalStyles.responseDisplay.height || '';
            responseDisplay.style.maxHeight = originalStyles.responseDisplay.maxHeight || '';
            responseDisplay.scrollTop = originalScrollPositions.responseDisplay;
        }

        mainContent.style.overflow = originalStyles.mainContent.overflow || '';
        mainContent.style.height = originalStyles.mainContent.height || '';
        mainContent.scrollTop = originalScrollPositions.mainContent;

        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
            if (!blob) {
                throw new Error('Failed to create image blob');
            }

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const method = selectedRequest ? selectedRequest.request.method : 'REQUEST';
            let pathPart = 'unknown';
            if (selectedRequest) {
                try {
                    const urlObj = new URL(selectedRequest.request.url);
                    pathPart = urlObj.pathname
                        .replace(/\//g, '_')
                        .replace(/[^a-zA-Z0-9_-]/g, '')
                        .slice(0, 50) || 'path'; // Limit length
                } catch (e) {
                    pathPart = 'request';
                }
            }
            const filename = `request-response-${method}-${pathPart}-${timestamp}.png`;

            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Show success feedback
            screenshotBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#81c995"/></svg>';
            setTimeout(() => {
                screenshotBtn.innerHTML = originalHtml;
                screenshotBtn.disabled = false;
            }, 1500);
        }, 'image/png');

    } catch (error) {
        console.error('Screenshot error:', error);
        screenshotBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#f28b82"/></svg>';
        setTimeout(() => {
            screenshotBtn.innerHTML = originalHtml;
            screenshotBtn.disabled = false;
        }, 1500);
    }
}

function testRegex(pattern, text) {
    try {
        const regex = new RegExp(pattern);
        return regex.test(text);
    } catch (e) {
        // Invalid regex pattern - don't match anything
        return false;
    }
}

function filterRequests() {
    const items = requestList.querySelectorAll('.request-item');
    let visibleCount = 0;
    let regexError = false;

    items.forEach((item, index) => {
        const request = requests[parseInt(item.dataset.index)];
        if (!request) return;

        const url = request.request.url;
        const urlLower = url.toLowerCase();
        const method = request.request.method.toUpperCase();

        // Build searchable text from headers
        let headersText = '';
        let headersTextLower = '';
        if (request.request.headers) {
            request.request.headers.forEach(header => {
                const headerLine = `${header.name}: ${header.value} `;
                headersText += headerLine;
                headersTextLower += headerLine.toLowerCase();
            });
        }

        // Get request body if available
        let bodyText = '';
        let bodyTextLower = '';
        if (request.request.postData && request.request.postData.text) {
            bodyText = request.request.postData.text;
            bodyTextLower = bodyText.toLowerCase();
        }

        // Check search term (search in URL, method, headers, and body)
        let matchesSearch = false;
        if (currentSearchTerm === '') {
            matchesSearch = true;
        } else if (useRegex) {
            // Use regex matching
            try {
                const regex = new RegExp(currentSearchTerm);
                matchesSearch =
                    regex.test(url) ||
                    regex.test(method) ||
                    regex.test(headersText) ||
                    regex.test(bodyText);
            } catch (e) {
                // Invalid regex - mark error but don't break the loop
                if (!regexError) {
                    regexError = true;
                    console.warn('Invalid regex pattern:', currentSearchTerm, e);
                }
                matchesSearch = false;
            }
        } else {
            // Plain text matching (case-insensitive)
            matchesSearch =
                urlLower.includes(currentSearchTerm) ||
                method.includes(currentSearchTerm.toUpperCase()) ||
                headersTextLower.includes(currentSearchTerm) ||
                bodyTextLower.includes(currentSearchTerm);
        }

        // Check filter
        let matchesFilter = true;
        if (currentFilter !== 'all') {
            // Filter by Method or Starred
            if (currentFilter === 'starred') {
                matchesFilter = request.starred;
            } else {
                matchesFilter = method === currentFilter;
            }
        }

        // Show/hide item
        if (matchesSearch && matchesFilter) {
            item.style.display = 'flex';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });

    // Show error state if regex is invalid
    if (regexError && useRegex && currentSearchTerm) {
        regexToggle.classList.add('error');
        regexToggle.title = 'Invalid regex pattern';
    } else {
        regexToggle.classList.remove('error');
        regexToggle.title = useRegex
            ? 'Regex mode enabled (click to disable)'
            : 'Toggle Regex Mode (enable to use regex patterns)';
    }

    // Show empty state if no results
    const emptyState = requestList.querySelector('.empty-state');
    if (visibleCount === 0 && items.length > 0) {
        if (!emptyState) {
            const div = document.createElement('div');
            div.className = 'empty-state';
            div.textContent = regexError && useRegex && currentSearchTerm
                ? 'Invalid regex pattern'
                : 'No requests match your filter';
            requestList.appendChild(div);
        } else {
            emptyState.textContent = regexError && useRegex && currentSearchTerm
                ? 'Invalid regex pattern'
                : 'No requests match your filter';
        }
    } else if (emptyState && visibleCount > 0) {
        emptyState.remove();
    }
}

function addToHistory(rawText, useHttps) {
    // Don't add if same as current
    if (historyIndex >= 0) {
        const current = requestHistory[historyIndex];
        if (current.rawText === rawText && current.useHttps === useHttps) {
            return;
        }
    }

    // If we are in the middle of history and make a change, discard future history
    if (historyIndex < requestHistory.length - 1) {
        requestHistory = requestHistory.slice(0, historyIndex + 1);
    }

    requestHistory.push({ rawText, useHttps });
    historyIndex = requestHistory.length - 1;
    updateHistoryButtons();
}

function loadHistoryState(index) {
    const state = requestHistory[index];
    if (!state) return;

    rawRequestInput.innerHTML = highlightHTTP(state.rawText);
    useHttpsCheckbox.checked = state.useHttps;
    updateHistoryButtons();
}

function updateHistoryButtons() {
    historyBackBtn.disabled = historyIndex <= 0;
    historyFwdBtn.disabled = historyIndex >= requestHistory.length - 1;
}




async function sendRequest() {
    console.log('=== SEND REQUEST STARTED ===');

    // Ensure response display is visible and clear
    rawResponseDisplay.textContent = 'Processing request...';
    rawResponseDisplay.style.display = 'block';
    resStatus.textContent = 'Preparing...';
    resStatus.className = 'status-badge';
    resTime.textContent = '';

    try {
        const rawContent = rawRequestInput.innerText.trim();
        const useHttps = useHttpsCheckbox.checked;

        // Add to history
        addToHistory(rawContent, useHttps);

        const scheme = useHttps ? 'https' : 'http';

        console.log('Raw content length:', rawContent.length);

        // Parse Raw Content
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

        console.log('Method:', method, 'Path:', path);

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
                    console.log('Skipping HTTP/2 pseudo-header:', line.trim());
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

        console.log('Host:', host);
        console.log('Headers count:', Object.keys(headers).length);
        console.log('Body length:', bodyText ? bodyText.length : 0);

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

        console.log('Original headers:', Object.keys(headers));
        console.log('Filtered headers:', Object.keys(filteredHeaders));

        const options = {
            method: method,
            headers: filteredHeaders,
            mode: 'cors',
            credentials: 'omit'
        };

        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && bodyText) {
            options.body = bodyText;
        }

        resStatus.textContent = 'Sending...';
        resStatus.className = 'status-badge';
        const startTime = performance.now();

        console.log('Sending request to:', url);
        console.log('Method:', method);
        console.log('Headers:', filteredHeaders);

        const response = await fetch(url, options);

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(0);
        resTime.textContent = `${duration}ms`;

        console.log('Response received:', response.status, response.statusText);

        const responseBody = await response.text();

        // Calculate size
        const size = new TextEncoder().encode(responseBody).length;
        resSize.textContent = formatBytes(size);

        console.log('Response body length:', responseBody.length);

        // Display Status
        resStatus.textContent = `${response.status} ${response.statusText}`;
        if (response.status >= 200 && response.status < 300) {
            resStatus.className = 'status-badge status-2xx';
        } else if (response.status >= 400 && response.status < 500) {
            resStatus.className = 'status-badge status-4xx';
        } else if (response.status >= 500) {
            resStatus.className = 'status-badge status-5xx';
        }

        // Build raw HTTP response
        let rawResponse = `HTTP/1.1 ${response.status} ${response.statusText}\n`;

        for (const [key, value] of response.headers) {
            rawResponse += `${key}: ${value}\n`;
        }

        rawResponse += '\n';

        // Try to format JSON
        try {
            const json = JSON.parse(responseBody);
            rawResponse += JSON.stringify(json, null, 2);
        } catch (e) {
            // Not JSON, display as-is
            rawResponse += responseBody;
        }

        console.log('Setting response display text, length:', rawResponse.length);

        // Apply syntax highlighting to response
        rawResponseDisplay.innerHTML = highlightHTTP(rawResponse);

        // Force visibility
        rawResponseDisplay.style.display = 'block';
        rawResponseDisplay.style.visibility = 'visible';

        // Check if it's actually visible
        const computedStyle = window.getComputedStyle(rawResponseDisplay);
        console.log('Response display computed style:', {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            height: computedStyle.height,
            width: computedStyle.width
        });

        const responsePane = document.querySelector('.response-pane');
        const responsePaneStyle = window.getComputedStyle(responsePane);
        const responsePaneWidth = parseInt(responsePaneStyle.width);

        console.log('Response pane computed style:', {
            display: responsePaneStyle.display,
            flex: responsePaneStyle.flex,
            width: responsePaneStyle.width,
            widthPx: responsePaneWidth
        });

        // Safety check: if response pane is collapsed, force it open
        if (responsePaneWidth < 100) {
            console.warn('Response pane is collapsed! Forcing it open...');
            const requestPane = document.querySelector('.request-pane');
            requestPane.style.flex = '0 0 50%';
            responsePane.style.flex = '0 0 50%';
            console.log('Panes forced to 50/50 split');
        }

        console.log('Response displayed successfully');
        console.log('=== SEND REQUEST COMPLETED ===');

    } catch (err) {
        console.error('=== REQUEST FAILED ===');
        console.error('Error:', err);
        console.error('Stack:', err.stack);

        resStatus.textContent = 'Error';
        resStatus.className = 'status-badge status-5xx';
        resTime.textContent = '0ms';

        let errorMsg = `Error: ${err.message}\n\n`;

        if (err.message === 'Failed to fetch') {
            errorMsg += 'Possible causes:\n';
            errorMsg += '- Invalid Host header or URL\n';
            errorMsg += '- Network connection issue\n';
            errorMsg += '- CORS policy blocking the request\n';
            errorMsg += '- Mixed Content (sending HTTP request from HTTPS context)\n';
            errorMsg += '- Server is unreachable\n\n';
        }

        errorMsg += `Type: ${err.name}\n`;
        if (err.stack) {
            errorMsg += `Stack: ${err.stack}\n`;
        }

        // Use innerHTML to allow styling if needed, but keep it simple for now
        // We can reuse the syntax highlighter if we format it like a response, 
        // but plain text is clearer for errors.
        rawResponseDisplay.textContent = errorMsg;
        rawResponseDisplay.style.display = 'block';

        console.log('=== ERROR DISPLAYED ===');
    }
}

let resizeInitialized = false;

function setupResizeHandle() {
    if (resizeInitialized) {
        console.log('Resize already initialized, skipping');
        return;
    }

    const resizeHandle = document.querySelector('.pane-resize-handle');
    const requestPane = document.querySelector('.request-pane');
    const responsePane = document.querySelector('.response-pane');
    const container = document.querySelector('.main-content');

    if (!resizeHandle || !requestPane || !responsePane) {
        console.warn('Resize elements not found');
        return;
    }

    // Only reset flex on first load if not already set
    if (!requestPane.style.flex || requestPane.style.flex === '') {
        requestPane.style.flex = '1';
        responsePane.style.flex = '1';
        console.log('Panes initialized to 50/50 split');
    } else {
        console.log('Preserving existing pane sizes:', requestPane.style.flex, responsePane.style.flex);
    }

    let isResizing = false;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizeHandle.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        console.log('Resize started');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = container.getBoundingClientRect();
        const offsetX = e.clientX - containerRect.left;
        const containerWidth = containerRect.width;

        // Calculate percentage (between 20% and 80%)
        let percentage = (offsetX / containerWidth) * 100;
        percentage = Math.max(20, Math.min(80, percentage));

        requestPane.style.flex = `0 0 ${percentage}%`;
        responsePane.style.flex = `0 0 ${100 - percentage}%`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizeHandle.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            console.log('Resize ended. New sizes:', requestPane.style.flex, responsePane.style.flex);
        }
    });

    resizeInitialized = true;
    console.log('Resize handler initialized');
}

function setupSidebarResize() {
    const resizeHandle = document.querySelector('.sidebar-resize-handle');
    const sidebar = document.querySelector('.sidebar');

    if (!resizeHandle || !sidebar) return;

    let isResizing = false;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizeHandle.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const newWidth = e.clientX;
        // Constraints (min 150px, max 600px)
        if (newWidth >= 150 && newWidth <= 600) {
            sidebar.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizeHandle.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

function clearAllRequests() {
    // Clear state
    requests = [];
    selectedRequest = null;

    // Clear DOM
    requestList.innerHTML = '';

    // Add empty state message
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Listening for requests...';
    requestList.appendChild(emptyState);

    // Clear Editor
    rawRequestInput.textContent = '';
    rawResponseDisplay.textContent = '';
    resStatus.textContent = '';
    resStatus.className = 'status-badge';
    resTime.textContent = '';
    resSize.textContent = '';

    // Reset History
    requestHistory = [];
    historyIndex = -1;
    updateHistoryButtons();
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
