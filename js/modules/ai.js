// AI Integration Module (Anthropic & Gemini)

export function getAISettings() {
    const provider = localStorage.getItem('ai_provider') || 'anthropic';
    
    if (provider === 'gemini') {
        return {
            provider: 'gemini',
            apiKey: localStorage.getItem('gemini_api_key') || '',
            model: localStorage.getItem('gemini_model') || 'gemini-flash-latest'
        };
    }
    
    return {
        provider: 'anthropic',
        apiKey: localStorage.getItem('anthropic_api_key') || '',
        model: localStorage.getItem('anthropic_model') || 'claude-3-5-sonnet-20241022'
    };
}

export function saveAISettings(provider, apiKey, model) {
    localStorage.setItem('ai_provider', provider);
    
    if (provider === 'gemini') {
        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('gemini_model', model);
    } else {
        localStorage.setItem('anthropic_api_key', apiKey);
        localStorage.setItem('anthropic_model', model);
    }
}

export async function streamExplanation(apiKey, model, request, onUpdate, provider = 'anthropic') {
    if (provider === 'gemini') {
        return streamExplanationFromGemini(apiKey, model, request, onUpdate);
    }
    return streamExplanationFromClaude(apiKey, model, request, onUpdate);
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

export async function streamExplanationFromGemini(apiKey, model, request, onUpdate) {
    const systemPrompt = "You are an expert security researcher and web developer. Explain the following HTTP request in detail, highlighting interesting parameters, potential security implications, and what this request is likely doing. Be concise but thorough.";
    
    const prompt = `${systemPrompt}\n\nExplain this HTTP request:\n\n${request}`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to communicate with Gemini API');
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
                const dataStr = line.slice(6).trim();
                if (!dataStr) continue;

                try {
                    const data = JSON.parse(dataStr);
                    if (data.candidates && data.candidates[0]?.content?.parts) {
                        for (const part of data.candidates[0].content.parts) {
                            if (part.text) {
                                fullText += part.text;
                                onUpdate(fullText);
                            }
                        }
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
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const aiProviderSelect = document.getElementById('ai-provider');
    const anthropicApiKeyInput = document.getElementById('anthropic-api-key');
    const anthropicModelSelect = document.getElementById('anthropic-model');
    const geminiApiKeyInput = document.getElementById('gemini-api-key');
    const geminiModelSelect = document.getElementById('gemini-model');
    const anthropicSettings = document.getElementById('anthropic-settings');
    const geminiSettings = document.getElementById('gemini-settings');
    const aiMenuBtn = document.getElementById('ai-menu-btn');
    const aiMenuDropdown = document.getElementById('ai-menu-dropdown');
    const explainBtn = document.getElementById('explain-btn');
    const suggestAttackBtn = document.getElementById('suggest-attack-btn');
    const explanationModal = document.getElementById('explanation-modal');
    const explanationContent = document.getElementById('explanation-content');
    const ctxExplainAi = document.getElementById('ctx-explain-ai');

    // Handle provider switching
    if (aiProviderSelect) {
        aiProviderSelect.addEventListener('change', () => {
            const provider = aiProviderSelect.value;
            if (provider === 'gemini') {
                anthropicSettings.style.display = 'none';
                geminiSettings.style.display = 'block';
            } else {
                anthropicSettings.style.display = 'block';
                geminiSettings.style.display = 'none';
            }
        });
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            const { provider, apiKey, model } = getAISettings();
            
            if (aiProviderSelect) aiProviderSelect.value = provider;
            
            if (provider === 'gemini') {
                geminiApiKeyInput.value = apiKey;
                if (geminiModelSelect) geminiModelSelect.value = model;
                anthropicSettings.style.display = 'none';
                geminiSettings.style.display = 'block';
            } else {
                anthropicApiKeyInput.value = apiKey;
                if (anthropicModelSelect) anthropicModelSelect.value = model;
                anthropicSettings.style.display = 'block';
                geminiSettings.style.display = 'none';
            }

            settingsModal.style.display = 'block';
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const provider = aiProviderSelect ? aiProviderSelect.value : 'anthropic';
            let key, model;
            
            if (provider === 'gemini') {
                key = geminiApiKeyInput.value.trim();
                model = geminiModelSelect ? geminiModelSelect.value : 'gemini-flash-latest';
            } else {
                key = anthropicApiKeyInput.value.trim();
                model = anthropicModelSelect ? anthropicModelSelect.value : 'claude-3-5-sonnet-20241022';
            }

            if (key) {
                saveAISettings(provider, key, model);
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
        const { provider, apiKey, model } = getAISettings();
        if (!apiKey) {
            const providerName = provider === 'gemini' ? 'Gemini' : 'Anthropic';
            alert(`Please configure your ${providerName} API Key in Settings first.`);
            settingsModal.style.display = 'block';
            return;
        }

        explanationModal.style.display = 'block';
        explanationContent.innerHTML = '<div class="loading-spinner">Generating...</div>';

        try {
            await streamExplanation(apiKey, model, promptPrefix + "\n\n" + content, (text) => {
                if (typeof marked !== 'undefined') {
                    explanationContent.innerHTML = marked.parse(text);
                } else {
                    explanationContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: sans-serif;">${text}</pre>`;
                }
            }, provider);
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
