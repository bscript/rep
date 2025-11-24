// Main Entry Point
import { state, addRequest, addToHistory } from './modules/state.js';
import {
    initUI, elements, renderRequestItem, filterRequests, updateHistoryButtons,
    clearAllRequestsUI, setupResizeHandle, setupSidebarResize, setupContextMenu,
    setupUndoRedo, captureScreenshot, exportRequests, importRequests, selectRequest
} from './modules/ui.js';
import { setupNetworkListener, parseRequest, executeRequest } from './modules/network.js';
import { getAISettings, saveAISettings, streamExplanationFromClaude } from './modules/ai.js';
import { setupBulkReplay } from './modules/bulk-replay.js';
import { scanForSecrets } from './modules/secret-scanner.js';
import { formatBytes, highlightHTTP, renderDiff, copyToClipboard, escapeHtml } from './modules/utils.js';

// Theme Detection
function updateTheme() {
    const pref = localStorage.getItem('themePreference');
    if (pref === 'light') {
        document.body.classList.add('light-theme');
    } else if (pref === 'dark') {
        document.body.classList.remove('light-theme');
    } else {
        const theme = chrome.devtools.panels.themeName;
        if (theme === 'default') {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.remove('light-theme');
            } else {
                document.body.classList.add('light-theme');
            }
        } else if (theme === 'dark') {
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
        }
    }
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;

    const isLight = document.body.classList.contains('light-theme');
    if (isLight) {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M10 2c-1.82 0-3.53.5-5 1.35C7.99 5.08 10 8.3 10 12s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2z" fill="currentColor"/></svg>`;
        btn.title = "Switch to Dark Mode";
    } else {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" fill="currentColor" /></svg>`;
        btn.title = "Switch to Light Mode";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI Elements
    initUI();

    updateTheme();

    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isLight = document.body.classList.contains('light-theme');
            if (isLight) {
                localStorage.setItem('themePreference', 'dark');
            } else {
                localStorage.setItem('themePreference', 'light');
            }
            updateTheme();
        });
    }

    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
    }

    // Setup Network Listener
    setupNetworkListener((request) => {
        const index = addRequest(request);
        renderRequestItem(request, index);
    });

    // Setup UI Components
    setupResizeHandle();
    setupSidebarResize();
    setupContextMenu();
    setupUndoRedo();
    setupBulkReplay();

    // Event Listeners

    // Send Request
    elements.sendBtn.addEventListener('click', handleSendRequest);

    // Search & Filter
    elements.searchBar.addEventListener('input', (e) => {
        state.currentSearchTerm = e.target.value.toLowerCase();
        filterRequests();
    });

    elements.regexToggle.addEventListener('click', () => {
        state.useRegex = !state.useRegex;
        elements.regexToggle.classList.toggle('active', state.useRegex);
        elements.regexToggle.title = state.useRegex
            ? 'Regex mode enabled (click to disable)'
            : 'Toggle Regex Mode (enable to use regex patterns)';
        filterRequests();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentFilter = btn.dataset.filter;
            filterRequests();
        });
    });

    // Clear All
    elements.clearAllBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all requests?')) {
            clearAllRequestsUI();
        }
    });

    // Export/Import
    elements.exportBtn.addEventListener('click', exportRequests);
    elements.importBtn.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importRequests(e.target.files[0]);
            e.target.value = ''; // Reset
        }
    });

    // History Navigation
    elements.historyBackBtn.addEventListener('click', () => {
        if (state.historyIndex > 0) {
            state.historyIndex--;
            const item = state.requestHistory[state.historyIndex];
            elements.rawRequestInput.innerText = item.rawText;
            elements.useHttpsCheckbox.checked = item.useHttps;
            updateHistoryButtons();
        }
    });

    elements.historyFwdBtn.addEventListener('click', () => {
        if (state.historyIndex < state.requestHistory.length - 1) {
            state.historyIndex++;
            const item = state.requestHistory[state.historyIndex];
            elements.rawRequestInput.innerText = item.rawText;
            elements.useHttpsCheckbox.checked = item.useHttps;
            updateHistoryButtons();
        }
    });

    // Copy Buttons
    elements.copyReqBtn.addEventListener('click', () => {
        copyToClipboard(elements.rawRequestInput.innerText, elements.copyReqBtn);
    });

    elements.copyResBtn.addEventListener('click', () => {
        copyToClipboard(elements.rawResponseDisplay.innerText, elements.copyResBtn);
    });

    // Screenshot
    elements.screenshotBtn.addEventListener('click', captureScreenshot);

    // Diff Toggle
    if (elements.showDiffCheckbox) {
        elements.showDiffCheckbox.addEventListener('change', () => {
            if (state.regularRequestBaseline && state.currentResponse) {
                if (elements.showDiffCheckbox.checked) {
                    elements.rawResponseDisplay.innerHTML = renderDiff(state.regularRequestBaseline, state.currentResponse);
                } else {
                    elements.rawResponseDisplay.innerHTML = highlightHTTP(state.currentResponse);
                }
            }
        });
    }

    // Secret Scanner
    const scanSecretsBtn = document.getElementById('scan-secrets-btn');
    const secretsModal = document.getElementById('secrets-modal');
    const secretsResults = document.getElementById('secrets-results');
    const secretsProgress = document.getElementById('secrets-progress');
    const secretsProgressBar = document.getElementById('secrets-progress-bar');
    const secretsProgressText = document.getElementById('secrets-progress-text');
    const secretsSearch = document.getElementById('secrets-search');
    const secretsSearchContainer = document.getElementById('secrets-search-container');

    let currentSecretResults = [];

    function renderSecretResults(results) {
        if (results.length === 0) {
            secretsResults.innerHTML = '<div class="empty-state">No secrets found matching your criteria.</div>';
            return;
        }

        let html = '<table class="secrets-table"><thead><tr><th>Type</th><th>Match</th><th>Confidence</th><th>File</th></tr></thead><tbody>';
        results.forEach(r => {
            const confidenceClass = r.confidence >= 80 ? 'high' : (r.confidence >= 50 ? 'medium' : 'low');
            html += `<tr>
                <td>${escapeHtml(r.type)}</td>
                <td class="secret-match" title="${escapeHtml(r.match)}">${escapeHtml(r.match.substring(0, 50))}${r.match.length > 50 ? '...' : ''}</td>
                <td><span class="confidence-badge ${confidenceClass}">${r.confidence}%</span></td>
                <td class="secret-file"><a href="${escapeHtml(r.file)}" target="_blank" title="${escapeHtml(r.file)}">${escapeHtml(r.file)}</a></td>
            </tr>`;
        });
        html += '</tbody></table>';
        secretsResults.innerHTML = html;
    }

    if (scanSecretsBtn) {
        scanSecretsBtn.addEventListener('click', async () => {
            secretsModal.style.display = 'block';
            secretsResults.innerHTML = '';
            secretsProgress.style.display = 'block';
            secretsProgressBar.style.setProperty('--progress', '0%');
            secretsProgressText.textContent = 'Scanning JS files...';
            if (secretsSearch) secretsSearch.value = ''; // Reset search
            if (secretsSearchContainer) secretsSearchContainer.style.display = 'none';

            currentSecretResults = await scanForSecrets(state.requests, (processed, total) => {
                const percent = Math.round((processed / total) * 100);
                secretsProgressBar.style.setProperty('--progress', `${percent}%`);
                secretsProgressText.textContent = `Scanning JS files... ${processed}/${total}`;
            });

            secretsProgress.style.display = 'none';
            if (secretsSearchContainer) secretsSearchContainer.style.display = 'block';
            renderSecretResults(currentSecretResults);
        });
    }

    if (secretsSearch) {
        secretsSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = currentSecretResults.filter(r =>
                r.type.toLowerCase().includes(term) ||
                r.match.toLowerCase().includes(term) ||
                r.file.toLowerCase().includes(term)
            );
            renderSecretResults(filtered);
        });
    }

    // In-pane search functionality
    const requestSearchInput = document.getElementById('request-search');
    const responseSearchInput = document.getElementById('response-search');
    const requestSearchCount = document.getElementById('request-search-count');
    const responseSearchCount = document.getElementById('response-search-count');
    const requestPrevBtn = document.getElementById('request-search-prev');
    const requestNextBtn = document.getElementById('request-search-next');
    const responsePrevBtn = document.getElementById('response-search-prev');
    const responseNextBtn = document.getElementById('response-search-next');

    let requestCurrentMatch = 0;
    let responseCurrentMatch = 0;
    let requestMatches = [];
    let responseMatches = [];

    function updateCurrentHighlight(matches, currentIndex) {
        matches.forEach((mark, index) => {
            if (index === currentIndex) {
                mark.classList.add('current');
            } else {
                mark.classList.remove('current');
            }
        });
    }

    function navigateMatch(element, matches, currentIndex, direction, countElement) {
        if (matches.length === 0) return currentIndex;

        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = matches.length - 1;
        if (newIndex >= matches.length) newIndex = 0;

        updateCurrentHighlight(matches, newIndex);
        matches[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (countElement) {
            countElement.textContent = `${newIndex + 1}/${matches.length}`;
        }

        return newIndex;
    }

    function highlightSearchResults(element, searchTerm, countElement, prevBtn, nextBtn) {
        if (!element || !searchTerm) {
            if (countElement) countElement.textContent = '';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return [];
        }

        const content = element.textContent || element.innerText;
        if (!content) {
            if (countElement) countElement.textContent = '';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return [];
        }

        // Case-insensitive search in text content
        const regex = new RegExp(escapeRegExp(searchTerm), 'gi');
        const matches = content.match(regex);

        if (!matches || matches.length === 0) {
            if (countElement) countElement.textContent = 'No matches';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return [];
        }

        // Update count
        if (countElement) {
            countElement.textContent = `1/${matches.length}`;
        }

        // Enable navigation buttons
        if (prevBtn) prevBtn.disabled = false;
        if (nextBtn) nextBtn.disabled = false;

        // Highlight matches only in text nodes, not in HTML tags
        const highlightElements = highlightTextNodes(element, regex);

        // Set first match as current
        if (highlightElements.length > 0) {
            highlightElements[0].classList.add('current');
            highlightElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        return highlightElements;
    }

    function highlightTextNodes(element, regex) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodesToReplace = [];
        let node;

        while (node = walker.nextNode()) {
            if (node.nodeValue && regex.test(node.nodeValue)) {
                nodesToReplace.push(node);
            }
        }

        // Reset regex lastIndex
        regex.lastIndex = 0;

        const highlightElements = [];

        nodesToReplace.forEach(node => {
            const text = node.nodeValue;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;

            // Reset regex for this node
            const nodeRegex = new RegExp(regex.source, regex.flags);

            while ((match = nodeRegex.exec(text)) !== null) {
                // Add text before match
                if (match.index > lastIndex) {
                    fragment.appendChild(
                        document.createTextNode(text.substring(lastIndex, match.index))
                    );
                }

                // Add highlighted match
                const mark = document.createElement('mark');
                mark.className = 'search-highlight';
                mark.textContent = match[0];
                fragment.appendChild(mark);
                highlightElements.push(mark);

                lastIndex = match.index + match[0].length;
            }

            // Add remaining text
            if (lastIndex < text.length) {
                fragment.appendChild(
                    document.createTextNode(text.substring(lastIndex))
                );
            }

            node.parentNode.replaceChild(fragment, node);
        });

        return highlightElements;
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function clearSearchHighlights(element) {
        if (!element) return;
        const marks = element.querySelectorAll('.search-highlight');
        marks.forEach(mark => {
            const text = mark.textContent;
            mark.replaceWith(text);
        });
    }

    if (requestSearchInput) {
        requestSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            const editor = elements.rawRequestInput;

            if (!searchTerm) {
                clearSearchHighlights(editor);
                if (requestSearchCount) requestSearchCount.textContent = '';
                if (requestPrevBtn) requestPrevBtn.disabled = true;
                if (requestNextBtn) requestNextBtn.disabled = true;
                requestMatches = [];
                requestCurrentMatch = 0;
                return;
            }

            // Re-render with highlighting
            const rawText = editor.textContent || editor.innerText;
            editor.innerHTML = highlightHTTP(rawText);
            requestMatches = highlightSearchResults(editor, searchTerm, requestSearchCount, requestPrevBtn, requestNextBtn);
            requestCurrentMatch = 0;
        });

        // Enter key to navigate to next match
        requestSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && requestMatches.length > 0) {
                e.preventDefault();
                requestCurrentMatch = navigateMatch(elements.rawRequestInput, requestMatches, requestCurrentMatch, 1, requestSearchCount);
            }
        });
    }

    if (responseSearchInput) {
        responseSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            const display = elements.rawResponseDisplay;

            if (!searchTerm) {
                clearSearchHighlights(display);
                if (responseSearchCount) responseSearchCount.textContent = '';
                if (responsePrevBtn) responsePrevBtn.disabled = true;
                if (responseNextBtn) responseNextBtn.disabled = true;
                responseMatches = [];
                responseCurrentMatch = 0;
                return;
            }

            // Re-render with highlighting
            const rawText = display.textContent || display.innerText;
            display.innerHTML = highlightHTTP(rawText);
            responseMatches = highlightSearchResults(display, searchTerm, responseSearchCount, responsePrevBtn, responseNextBtn);
            responseCurrentMatch = 0;
        });

        // Enter key to navigate to next match
        responseSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && responseMatches.length > 0) {
                e.preventDefault();
                responseCurrentMatch = navigateMatch(elements.rawResponseDisplay, responseMatches, responseCurrentMatch, 1, responseSearchCount);
            }
        });
    }

    // Navigation button listeners
    if (requestPrevBtn) {
        requestPrevBtn.addEventListener('click', () => {
            requestCurrentMatch = navigateMatch(elements.rawRequestInput, requestMatches, requestCurrentMatch, -1, requestSearchCount);
        });
    }

    if (requestNextBtn) {
        requestNextBtn.addEventListener('click', () => {
            requestCurrentMatch = navigateMatch(elements.rawRequestInput, requestMatches, requestCurrentMatch, 1, requestSearchCount);
        });
    }

    if (responsePrevBtn) {
        responsePrevBtn.addEventListener('click', () => {
            responseCurrentMatch = navigateMatch(elements.rawResponseDisplay, responseMatches, responseCurrentMatch, -1, responseSearchCount);
        });
    }

    if (responseNextBtn) {
        responseNextBtn.addEventListener('click', () => {
            responseCurrentMatch = navigateMatch(elements.rawResponseDisplay, responseMatches, responseCurrentMatch, 1, responseSearchCount);
        });
    }

    // AI Features
    setupAIFeatures();
});

async function handleSendRequest() {
    const rawContent = elements.rawRequestInput.innerText;
    const useHttps = elements.useHttpsCheckbox.checked;

    // Add to history
    addToHistory(rawContent, useHttps);
    updateHistoryButtons();

    try {
        const { url, options, method, filteredHeaders, bodyText } = parseRequest(rawContent, useHttps);

        elements.resStatus.textContent = 'Sending...';
        elements.resStatus.className = 'status-badge';

        console.log('Sending request to:', url);

        const result = await executeRequest(url, options);

        elements.resTime.textContent = `${result.duration}ms`;
        elements.resSize.textContent = formatBytes(result.size);

        elements.resStatus.textContent = `${result.status} ${result.statusText}`;
        if (result.status >= 200 && result.status < 300) {
            elements.resStatus.className = 'status-badge status-2xx';
        } else if (result.status >= 400 && result.status < 500) {
            elements.resStatus.className = 'status-badge status-4xx';
        } else if (result.status >= 500) {
            elements.resStatus.className = 'status-badge status-5xx';
        }

        // Build raw HTTP response
        let rawResponse = `HTTP/1.1 ${result.status} ${result.statusText}\n`;
        for (const [key, value] of result.headers) {
            rawResponse += `${key}: ${value}\n`;
        }
        rawResponse += '\n';

        try {
            const json = JSON.parse(result.body);
            rawResponse += JSON.stringify(json, null, 2);
        } catch (e) {
            rawResponse += result.body;
        }

        // Store current response
        state.currentResponse = rawResponse;

        // Handle Diff Baseline
        if (!state.regularRequestBaseline) {
            state.regularRequestBaseline = rawResponse;
            elements.diffToggle.style.display = 'none';
        } else {
            elements.diffToggle.style.display = 'flex';
            if (elements.showDiffCheckbox && elements.showDiffCheckbox.checked) {
                elements.rawResponseDisplay.innerHTML = renderDiff(state.regularRequestBaseline, rawResponse);
            } else {
                elements.rawResponseDisplay.innerHTML = highlightHTTP(rawResponse);
            }
        }

        // If diff not enabled or first response
        if (!elements.showDiffCheckbox || !elements.showDiffCheckbox.checked || !state.regularRequestBaseline || state.regularRequestBaseline === rawResponse) {
            elements.rawResponseDisplay.innerHTML = highlightHTTP(rawResponse);
        }

        elements.rawResponseDisplay.style.display = 'block';
        elements.rawResponseDisplay.style.visibility = 'visible';

    } catch (err) {
        console.error('Request Failed:', err);
        elements.resStatus.textContent = 'Error';
        elements.resStatus.className = 'status-badge status-5xx';
        elements.resTime.textContent = '0ms';
        elements.rawResponseDisplay.textContent = `Error: ${err.message}\n\nStack: ${err.stack}`;
        elements.rawResponseDisplay.style.display = 'block';
    }
}

function setupAIFeatures() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const anthropicApiKeyInput = document.getElementById('anthropic-api-key');
    const anthropicModelSelect = document.getElementById('anthropic-model');
    const aiMenuBtn = document.getElementById('ai-menu-btn');
    const aiMenuDropdown = document.getElementById('ai-menu-dropdown');
    const explainBtn = document.getElementById('explain-btn');
    const suggestAttackBtn = document.getElementById('suggest-attack-btn');
    const explanationModal = document.getElementById('explanation-modal');
    const explanationContent = document.getElementById('explanation-content');
    const ctxExplainAi = document.getElementById('ctx-explain-ai');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            const { apiKey, model } = getAISettings();
            anthropicApiKeyInput.value = apiKey;
            if (anthropicModelSelect) anthropicModelSelect.value = model;

            settingsModal.style.display = 'block';
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const key = anthropicApiKeyInput.value.trim();
            const model = anthropicModelSelect ? anthropicModelSelect.value : 'claude-3-5-sonnet-20241022';

            if (key) {
                saveAISettings(key, model);
            }

            alert('Settings saved!');
            settingsModal.style.display = 'none';
        });
    }

    if (aiMenuBtn && aiMenuDropdown) {
        aiMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            aiMenuDropdown.classList.toggle('show');
        });
        window.addEventListener('click', () => {
            if (aiMenuDropdown.classList.contains('show')) {
                aiMenuDropdown.classList.remove('show');
            }
        });
    }

    const handleAIRequest = async (promptPrefix, content) => {
        const { apiKey, model } = getAISettings();
        if (!apiKey) {
            alert('Please configure your Anthropic API Key in Settings first.');
            settingsModal.style.display = 'block';
            return;
        }

        explanationModal.style.display = 'block';
        explanationContent.innerHTML = '<div class="loading-spinner">Generating...</div>';

        try {
            await streamExplanationFromClaude(apiKey, model, promptPrefix + "\n\n" + content, (text) => {
                if (typeof marked !== 'undefined') {
                    explanationContent.innerHTML = marked.parse(text);
                } else {
                    explanationContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: sans-serif;">${text}</pre>`;
                }
            });
        } catch (error) {
            explanationContent.innerHTML = `<div style="color: var(--error-color); padding: 20px;">Error: ${error.message}</div>`;
        }
    };

    if (explainBtn) {
        explainBtn.addEventListener('click', () => {
            const content = elements.rawRequestInput.innerText;
            if (!content.trim()) {
                alert('Request is empty.');
                return;
            }
            handleAIRequest("Explain this HTTP request:", content);
        });
    }

    if (suggestAttackBtn) {
        suggestAttackBtn.addEventListener('click', () => {
            const content = elements.rawRequestInput.innerText;
            if (!content.trim()) {
                alert('Request is empty.');
                return;
            }
            const prompt = `Analyze this HTTP request for potential security vulnerabilities. Provide a prioritized checklist of specific attack vectors to test. For each item, specify the target parameter/header, the potential vulnerability (e.g., IDOR, SQLi, XSS), and a brief test instruction. Format the output as a clear Markdown checklist.`;
            handleAIRequest(prompt, content);
        });
    }

    if (ctxExplainAi) {
        ctxExplainAi.addEventListener('click', () => {
            const selection = window.getSelection().toString();
            if (!selection.trim()) {
                alert('Please select some text to explain.');
                return;
            }
            const prompt = `Explain this specific part of an HTTP request/response:\n\n"${selection}"\n\nProvide context on what it is, how it's used, and any security relevance.`;
            handleAIRequest(prompt, ""); // Content is in prompt
        });
    }

    // Close Modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}
