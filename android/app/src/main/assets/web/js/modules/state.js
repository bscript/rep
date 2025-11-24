// State Management

export const state = {
    requests: [],
    selectedRequest: null,
    currentFilter: 'all',
    currentSearchTerm: '',
    useRegex: false,
    requestHistory: [],
    historyIndex: -1,
    undoStack: [],
    redoStack: [],
    // Bulk Replay State
    positionConfigs: [],
    currentAttackType: 'sniper',
    shouldStopBulk: false,
    shouldPauseBulk: false,
    // Diff State
    regularRequestBaseline: null,
    currentResponse: null
};

export function addRequest(request) {
    state.requests.push(request);
    return state.requests.length - 1; // Return index
}

export function clearRequests() {
    state.requests = [];
    state.selectedRequest = null;
    state.requestHistory = [];
    state.historyIndex = -1;
    state.regularRequestBaseline = null;
    state.currentResponse = null;
}

export function addToHistory(rawText, useHttps) {
    // Don't add if same as current
    if (state.historyIndex >= 0) {
        const current = state.requestHistory[state.historyIndex];
        if (current.rawText === rawText && current.useHttps === useHttps) {
            return;
        }
    }

    // If we are in the middle of history and make a change, discard future history
    if (state.historyIndex < state.requestHistory.length - 1) {
        state.requestHistory = state.requestHistory.slice(0, state.historyIndex + 1);
    }

    state.requestHistory.push({ rawText, useHttps });
    state.historyIndex = state.requestHistory.length - 1;
}
