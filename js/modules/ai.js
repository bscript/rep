// AI Integration Module (Anthropic)

import { settings } from './settings.js';

export function getAISettings() {
    return {
        apiKey: settings.anthropicApiKey.value || '',
        model: settings.anthropicModel.value || 'claude-3-5-sonnet-20241022'
    };
}

export function saveAISettings(apiKey, model) {
    // This function is no longer needed as settings are saved via the settings modal
    // Keeping it for compatibility if needed, but it should update the settings object
    settings.anthropicApiKey.value = apiKey;
    settings.anthropicModel.value = model;
    import('./settings.js').then(m => m.saveSettings());
}

export async function streamExplanationFromClaude(apiKey, model, request, onUpdate) {
    const systemPrompt = "You are an expert security researcher and web developer. Explain the following HTTP request in detail, highlighting interesting parameters, potential security implications, and what this request is likely doing. Be concise but thorough.";

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 1024,
            system: systemPrompt,
            stream: true,
            messages: [
                { role: 'user', content: `Explain this HTTP request:\n\n${request}` }
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to communicate with Anthropic API');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') continue;

                try {
                    const data = JSON.parse(dataStr);
                    if (data.type === 'content_block_delta' && data.delta.text) {
                        fullText += data.delta.text;
                        onUpdate(fullText);
                    }
                } catch (e) {
                    // Ignore parse errors for incomplete chunks
                }
            }
        }
    }

    return fullText;
}

export function setupAIFeatures(elements) {
    const aiMenuBtn = document.getElementById('ai-menu-btn');
    const aiMenuDropdown = document.getElementById('ai-menu-dropdown');
    const explainBtn = document.getElementById('explain-btn');
    const suggestAttackBtn = document.getElementById('suggest-attack-btn');
    const explanationModal = document.getElementById('explanation-modal');
    const explanationContent = document.getElementById('explanation-content');
    const ctxExplainAi = document.getElementById('ctx-explain-ai');

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
            // Open settings modal
            const settingsBtn = document.getElementById('settings-btn');
            if (settingsBtn) settingsBtn.click();
            return;
        }

        if (explanationModal && explanationContent) {
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
            // Hide context menu if open
            const contextMenu = document.getElementById('context-menu');
            if (contextMenu) {
                contextMenu.classList.remove('show');
                contextMenu.style.visibility = 'hidden';
            }

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
