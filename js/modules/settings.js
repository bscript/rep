// Settings Module
import { state, oosPatterns } from './state.js';
import { filterRequests } from './ui.js';

// Default OOS patterns from state.js
const DEFAULT_OOS_PATTERNS = [
    '^/_next/',
    '^/__nextjs',
    '^/next/',
    '^/_app/',
    '^/@svelte',
    '^\\.svelte-kit/',
    '^/_nuxt/',
    '^/__nuxt',
    '^/@vite',
    '^/@react-refresh',
    '^/@id/',
    '^/node_modules/',
    '^/__vite_',
    '^/webpack',
    '\\.hot-update\\.',
    '^/sockjs-node',
    '\\.map$',
    '^/_ws$',
    '^/ws$',
    '^/socket\\.io',
    '^/static/chunks/',
    '^/static/development/',
    '^/static/webpack/',
    '^/_buildManifest\\.js',
    '^/_ssgManifest\\.js',
    '^/gtm\\.js',
    '^/gtag/',
    '/analytics',
    '/collect\\?',
    '^/cdn-cgi/',
    '\\?t=\\d+$',
    '^/hmr$',
    // Google tracking/logging (for testing)
    '/log\\?',
    '/punctual',
    '/_/scs/'
];

/**
 * Settings structure - easily extensible for new settings
 */
export const settings = {
    // AI Settings
    anthropicApiKey: {
        title: 'Anthropic API Key',
        description: 'Required for AI-powered features like "Explain Request"',
        type: 'password',
        value: '',
        default: '',
        placeholder: 'sk-ant-...'
    },
    anthropicModel: {
        title: 'AI Model',
        description: 'Choose which Claude model to use for AI features',
        type: 'select',
        value: 'claude-3-5-sonnet-20241022',
        default: 'claude-3-5-sonnet-20241022',
        options: [
            { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Oct 2024)' },
            { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet (Jun 2024)' },
            { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
            { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
        ]
    },

    // CORS Settings
    enableCorsForAllHosts: {
        title: 'Enable CORS for All Hosts',
        description: 'Allow requests to any domain by bypassing CORS restrictions.',
        type: 'checkbox',
        value: false,
        default: false,
        warning: 'This allows the extension to make requests to any website on your behalf. Only enable if you trust the tool and understand the privacy implications.'
    },

    // Filtering Settings
    oosPatterns: {
        title: 'Out-of-Scope Patterns',
        description: 'Regex patterns to filter framework noise (one per line)',
        type: 'list',
        value: [],
        default: DEFAULT_OOS_PATTERNS
    },
    inScopePatterns: {
        title: 'In-Scope Patterns',
        description: 'Regex patterns to always include (overrides OOS)',
        type: 'list',
        value: [],
        default: []
    },

    // Keyboard Shortcuts
    keyboardShortcuts: {
        title: 'Keyboard Shortcuts',
        description: 'Customize keyboard shortcuts for common actions',
        type: 'shortcuts',
        value: {},
        default: {
            sendRequest: { key: 'Space', ctrl: true, shift: false, alt: false, description: 'Send request' },
            clearInput: { key: 'KeyL', ctrl: true, shift: false, alt: false, description: 'Clear request input' },
            toggleOOS: { key: 'KeyO', ctrl: true, shift: true, alt: false, description: 'Toggle OOS visibility' }
        }
    }
};

/**
 * Reclassify all existing requests after OOS patterns change
 */
async function reclassifyAllRequests() {
    const { state, isOutOfScope } = await import('./state.js');
    state.requests.forEach(request => {
        request.isOOS = isOutOfScope(request.request.url);
    });
}

/**
 * Load settings from localStorage
 */
export async function loadSettings() {
    try {
        const stored = localStorage.getItem('rep_settings');

        if (stored) {
            const parsed = JSON.parse(stored);
            Object.keys(settings).forEach(key => {
                if (parsed[key] !== undefined) {
                    settings[key].value = parsed[key];
                }
            });
        }

        // Sync CORS setting with actual Chrome permission state
        const hasPermission = await checkCorsPermission();
        settings.enableCorsForAllHosts.value = hasPermission;

        // If no OOS patterns loaded (first time or empty), use defaults
        if (!settings.oosPatterns.value || settings.oosPatterns.value.length === 0) {
            settings.oosPatterns.value = [...DEFAULT_OOS_PATTERNS];
        }

        // Update patterns in state
        const { updateOOSPatterns } = await import('./state.js');
        updateOOSPatterns(settings.oosPatterns.value);

        // Reclassify existing requests
        await reclassifyAllRequests();

    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

/**
 * Save settings to localStorage
 */
export function saveSettings() {
    try {
        const toSave = {};
        Object.keys(settings).forEach(key => {
            toSave[key] = settings[key].value;
        });
        localStorage.setItem('rep_settings', JSON.stringify(toSave));
        return true;
    } catch (e) {
        console.error('Failed to save settings:', e);
        return false;
    }
}

/**
 * Reset settings to defaults
 */
export function resetSettings() {
    Object.keys(settings).forEach(key => {
        settings[key].value = Array.isArray(settings[key].default)
            ? [...settings[key].default]
            : settings[key].default;
    });
    saveSettings();
    loadSettings(); // Reload to update oosPatterns and reclassify
}

/**
 * Initialize settings modal
 */
export function initSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const openBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('settings-close');
    const saveBtn = document.getElementById('settings-save');
    const resetBtn = document.getElementById('settings-reset');
    const tabs = document.querySelectorAll('.settings-tab');

    if (!modal || !openBtn) return;

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update active content
            document.querySelectorAll('.settings-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`settings-tab-${tabName}`).classList.add('active');
        });
    });

    // Open modal
    openBtn.addEventListener('click', () => {
        renderSettingsUI();
        modal.classList.add('show');
    });

    // Close modal
    const closeModal = () => modal.classList.remove('show');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Save settings
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (saveSettingsFromUI()) {
                closeModal();
                filterRequests(); // Re-filter with new patterns
                showToast('Settings saved successfully');
            }
        });
    }

    // Reset settings
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Reset all settings to defaults?')) {
                resetSettings();
                renderSettingsUI();
                showToast('Settings reset to defaults');
            }
        });
    }
}

/**
 * Render settings UI dynamically
 */
function renderSettingsUI() {
    const aiTab = document.getElementById('settings-tab-ai');
    const privacyTab = document.getElementById('settings-tab-privacy');
    const filteringTab = document.getElementById('settings-tab-filtering');
    const shortcutsTab = document.getElementById('settings-tab-shortcuts');

    if (!aiTab || !privacyTab || !filteringTab) return;

    // Clear all tabs
    aiTab.innerHTML = '';
    privacyTab.innerHTML = '';
    filteringTab.innerHTML = '';
    if (shortcutsTab) shortcutsTab.innerHTML = '';

    // AI Tab
    aiTab.appendChild(createSettingSection('anthropicApiKey', settings.anthropicApiKey));
    aiTab.appendChild(createSettingSection('anthropicModel', settings.anthropicModel));

    // Privacy Tab
    privacyTab.appendChild(createSettingSection('enableCorsForAllHosts', settings.enableCorsForAllHosts));

    // Filtering Tab
    filteringTab.appendChild(createSettingSection('oosPatterns', settings.oosPatterns));
    filteringTab.appendChild(createSettingSection('inScopePatterns', settings.inScopePatterns));

    // Shortcuts Tab
    if (shortcutsTab) {
        shortcutsTab.appendChild(createSettingSection('keyboardShortcuts', settings.keyboardShortcuts));
    }
}

/**
 * Create a setting section based on type
 */
function createSettingSection(key, setting) {
    const section = document.createElement('div');
    section.className = 'setting-section';
    section.dataset.key = key;

    const header = document.createElement('div');
    header.className = 'setting-header';
    header.innerHTML = `
        <h3>${setting.title}</h3>
        <p>${setting.description}</p>
    `;
    section.appendChild(header);

    const content = document.createElement('div');
    content.className = 'setting-content';

    if (setting.type === 'list') {
        content.appendChild(createListInput(key, setting));
    } else if (setting.type === 'text' || setting.type === 'password') {
        content.appendChild(createTextInput(key, setting, setting.type));
    } else if (setting.type === 'select') {
        content.appendChild(createSelectInput(key, setting));
    } else if (setting.type === 'checkbox') {
        content.appendChild(createCheckboxInput(key, setting));
    } else if (setting.type === 'shortcuts') {
        content.appendChild(createShortcutsInput(key, setting));
    }

    // Add warning if present
    if (setting.warning) {
        const warning = document.createElement('p');
        warning.className = 'setting-warning';
        warning.innerHTML = `⚠️ ${setting.warning}`;
        content.appendChild(warning);
    }

    section.appendChild(content);
    return section;
}

/**
 * Create list input (for OOS patterns, match/replace)
 */
function createListInput(key, setting) {
    const container = document.createElement('div');
    container.className = 'list-input';

    const list = document.createElement('div');
    list.className = 'list-items';
    list.id = `list-${key}`;

    // Render existing items
    const items = setting.value;
    items.forEach((item, index) => {
        list.appendChild(createListItem(item, index, key));
    });

    container.appendChild(list);

    // Add new item input
    const addContainer = document.createElement('div');
    addContainer.className = 'add-item-container';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = key === 'inScopePatterns' ? 'e.g., ^/api/ or /admin' : 'e.g., ^/_custom/ or \\.debug$';
    input.className = 'add-item-input';
    input.id = `add-${key}`;

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add';
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => {
        const value = input.value.trim();
        if (value) {
            // Validate regex
            try {
                new RegExp(value);
            } catch (e) {
                showToast('Invalid regex pattern: ' + e.message, 'error');
                return;
            }

            setting.value.push(value);
            list.appendChild(createListItem(value, setting.value.length - 1, key));
            input.value = '';
        }
    });

    // Enter key to add
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addBtn.click();
    });

    addContainer.appendChild(input);
    addContainer.appendChild(addBtn);
    container.appendChild(addContainer);

    return container;
}

/**
 * Create a single list item
 */
function createListItem(value, index, key) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.dataset.index = index;

    const text = document.createElement('span');
    text.className = 'list-item-text';
    text.textContent = value;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', () => {
        settings[key].value.splice(index, 1);
        item.remove();
        // Re-index remaining items
        document.querySelectorAll(`#list-${key} .list-item`).forEach((el, idx) => {
            el.dataset.index = idx;
        });
    });

    item.appendChild(text);
    item.appendChild(deleteBtn);
    return item;
}

/**
 * Create text input
 */
function createTextInput(key, setting, inputType = 'text') {
    const input = document.createElement('input');
    input.type = inputType;
    input.className = 'text-input';
    input.value = setting.value || '';
    input.placeholder = setting.placeholder || ('Enter ' + setting.title.toLowerCase());
    input.id = `input-${key}`;

    // Update setting value on change
    input.addEventListener('input', (e) => {
        settings[key].value = e.target.value;
    });

    return input;
}

/**
 * Create select dropdown
 */
function createSelectInput(key, setting) {
    const select = document.createElement('select');
    select.className = 'select-input';
    select.id = `input-${key}`;

    setting.options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        opt.selected = option.value === setting.value;
        select.appendChild(opt);
    });

    // Update setting value on change
    select.addEventListener('change', (e) => {
        settings[key].value = e.target.value;
    });

    return select;
}

/**
 * Create checkbox input
 */
function createCheckboxInput(key, setting) {
    const container = document.createElement('div');
    container.className = 'checkbox-container';

    const label = document.createElement('label');
    label.className = 'checkbox-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `input-${key}`;
    checkbox.checked = setting.value || false;

    // Update setting value on change
    checkbox.addEventListener('change', async (e) => {
        // Special handling for CORS permission
        if (key === 'enableCorsForAllHosts') {
            if (e.target.checked) {
                // Request permission from Chrome
                const granted = await requestCorsPermission();
                if (!granted) {
                    e.target.checked = false;
                    settings[key].value = false;
                    showToast('Permission denied. CORS for All Hosts not enabled.', 'error');
                    return;
                }
                showToast('CORS permission granted successfully', 'success');
            } else {
                // Revoke permission
                await revokeCorsPermission();
                showToast('CORS permission revoked', 'success');
            }
        }
        settings[key].value = e.target.checked;
    });

    const labelText = document.createElement('span');
    labelText.textContent = 'Enable';

    label.appendChild(checkbox);
    label.appendChild(labelText);
    container.appendChild(label);

    return container;
}

/**
 * Save settings from UI
 */
function saveSettingsFromUI() {
    try {
        // Settings are already updated during interaction
        // Just save and reload OOS patterns
        if (saveSettings()) {
            loadSettings(); // Reload to update oosPatterns
            return true;
        }
        return false;
    } catch (e) {
        showToast('Failed to save settings: ' + e.message, 'error');
        return false;
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

/**
 * Request <all_urls> permission from user
 * Shows Chrome's native permission dialog
 */
async function requestCorsPermission() {
    return new Promise((resolve) => {
        chrome.permissions.request({
            origins: ['<all_urls>']
        }, (granted) => {
            resolve(granted);
        });
    });
}

/**
 * Revoke <all_urls> permission
 */
async function revokeCorsPermission() {
    return new Promise((resolve) => {
        chrome.permissions.remove({
            origins: ['<all_urls>']
        }, (removed) => {
            resolve(removed);
        });
    });
}

/**
 * Check if CORS permission is currently granted
 */
async function checkCorsPermission() {
    return new Promise((resolve) => {
        chrome.permissions.contains({
            origins: ['<all_urls>']
        }, (result) => {
            resolve(result);
        });
    });
}

/**
 * Create shortcuts input (key capture interface)
 */
function createShortcutsInput(key, setting) {
    const container = document.createElement('div');
    container.className = 'shortcuts-container';

    // Add info banner
    const infoBanner = document.createElement('div');
    infoBanner.className = 'shortcuts-info';
    infoBanner.innerHTML = `
        <strong>ℹ️ Note:</strong> All keyboard shortcuts are required and cannot be removed. 
        Click on any shortcut to reassign it. Press <strong>Esc</strong> to cancel editing.
    `;
    container.appendChild(infoBanner);

    // Merge defaults with saved values to ensure all shortcuts are shown
    // This handles cases where new shortcuts are added or saved state is partial
    const shortcuts = { ...setting.default, ...(setting.value || {}) };

    Object.entries(shortcuts).forEach(([actionId, shortcut]) => {
        const row = createShortcutRow(actionId, shortcut, key);
        container.appendChild(row);
    });

    return container;
}

/**
 * Create a single shortcut row with key capture
 */
function createShortcutRow(actionId, shortcut, settingKey) {
    const row = document.createElement('div');
    row.className = 'shortcut-row';

    // Description
    const desc = document.createElement('span');
    desc.className = 'shortcut-description';
    desc.textContent = shortcut.description;

    // Key display/capture button
    const keyBtn = document.createElement('button');
    keyBtn.className = 'shortcut-key-btn';
    keyBtn.textContent = formatShortcut(shortcut);
    keyBtn.type = 'button';

    let capturing = false;

    keyBtn.addEventListener('click', () => {
        if (capturing) return;

        capturing = true;
        const originalShortcut = { ...shortcut };
        keyBtn.textContent = 'Press keys... (Esc to cancel)';
        keyBtn.classList.add('capturing');

        const handleKeyCapture = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Allow Escape to cancel
            if (e.key === 'Escape') {
                keyBtn.textContent = formatShortcut(originalShortcut);
                keyBtn.classList.remove('capturing');
                capturing = false;
                document.removeEventListener('keydown', handleKeyCapture, true);
                return;
            }

            // Ignore modifier-only presses
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                return;
            }

            const newShortcut = {
                key: e.code,
                ctrl: e.ctrlKey || e.metaKey,
                shift: e.shiftKey,
                alt: e.altKey,
                description: shortcut.description
            };

            // Check for conflicts
            const conflict = findShortcutConflict(actionId, newShortcut, settingKey);
            if (conflict) {
                showToast(`Conflict with "${conflict.description}"`, 'error');
                keyBtn.textContent = formatShortcut(originalShortcut);
            } else {
                // Update setting
                if (!settings[settingKey].value || Object.keys(settings[settingKey].value).length === 0) {
                    settings[settingKey].value = { ...settings[settingKey].default };
                }
                settings[settingKey].value[actionId] = newShortcut;
                keyBtn.textContent = formatShortcut(newShortcut);
                showToast('Shortcut updated', 'success');
            }

            capturing = false;
            keyBtn.classList.remove('capturing');
            document.removeEventListener('keydown', handleKeyCapture, true);
        };

        document.addEventListener('keydown', handleKeyCapture, true);
    });

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'shortcut-reset-btn';
    resetBtn.innerHTML = '↺';
    resetBtn.title = 'Reset to default';
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', () => {
        const defaultShortcut = settings[settingKey].default[actionId];
        if (!settings[settingKey].value) {
            settings[settingKey].value = { ...settings[settingKey].default };
        }
        settings[settingKey].value[actionId] = { ...defaultShortcut };
        keyBtn.textContent = formatShortcut(defaultShortcut);
        showToast('Shortcut reset to default', 'success');
    });

    row.appendChild(desc);
    row.appendChild(keyBtn);
    row.appendChild(resetBtn);

    return row;
}

/**
 * Format shortcut for display
 */
function formatShortcut(shortcut) {
    const parts = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');

    // Convert key code to readable name
    let keyName = shortcut.key;
    if (keyName.startsWith('Key')) {
        keyName = keyName.substring(3);
    } else if (keyName === 'Space') {
        keyName = 'Space';
    } else if (keyName.startsWith('Digit')) {
        keyName = keyName.substring(5);
    }
    parts.push(keyName);

    return parts.join(' + ');
}

/**
 * Find if a shortcut conflicts with existing ones
 */
function findShortcutConflict(excludeActionId, newShortcut, settingKey) {
    const shortcuts = settings[settingKey].value && Object.keys(settings[settingKey].value).length > 0
        ? settings[settingKey].value
        : settings[settingKey].default;

    for (const [actionId, shortcut] of Object.entries(shortcuts)) {
        if (actionId === excludeActionId) continue;

        if (shortcut.key === newShortcut.key &&
            shortcut.ctrl === newShortcut.ctrl &&
            shortcut.shift === newShortcut.shift &&
            shortcut.alt === newShortcut.alt) {
            return shortcut;
        }
    }

    return null;
}


