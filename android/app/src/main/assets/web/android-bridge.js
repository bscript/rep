/**
 * Android Bridge - Provides Chrome extension API compatibility
 * This file bridges the existing Chrome extension code to Android native functions
 */

(function() {
    'use strict';

    // Check if Android interface is available
    if (typeof Android === 'undefined') {
        console.warn('Android interface not available');
        return;
    }

    // Polyfill chrome.storage API
    window.chrome = window.chrome || {};
    window.chrome.storage = {
        local: {
            get: function(keys, callback) {
                try {
                    const stored = localStorage.getItem('chrome_storage_local') || '{}';
                    const data = JSON.parse(stored);

                    if (typeof keys === 'string') {
                        callback({ [keys]: data[keys] });
                    } else if (Array.isArray(keys)) {
                        const result = {};
                        keys.forEach(key => result[key] = data[key]);
                        callback(result);
                    } else {
                        callback(data);
                    }
                } catch (e) {
                    console.error('Storage get error:', e);
                    callback({});
                }
            },
            set: function(items, callback) {
                try {
                    const stored = localStorage.getItem('chrome_storage_local') || '{}';
                    const data = JSON.parse(stored);
                    Object.assign(data, items);
                    localStorage.setItem('chrome_storage_local', JSON.stringify(data));
                    if (callback) callback();
                } catch (e) {
                    console.error('Storage set error:', e);
                }
            }
        }
    };

    // Capture control functions
    window.repAndroid = {
        startCapture: function() {
            Android.startCapture();
        },

        stopCapture: function() {
            Android.stopCapture();
        },

        sendRequest: function(request) {
            return new Promise((resolve, reject) => {
                try {
                    const requestJson = JSON.stringify(request);
                    const responseJson = Android.sendRequest(requestJson);
                    const response = JSON.parse(responseJson);

                    if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        },

        saveRequest: function(request) {
            try {
                Android.saveRequest(JSON.stringify(request));
            } catch (e) {
                console.error('Save request error:', e);
            }
        },

        getRequests: function() {
            try {
                const json = Android.getRequests();
                return JSON.parse(json);
            } catch (e) {
                console.error('Get requests error:', e);
                return [];
            }
        },

        clearRequests: function() {
            Android.clearRequests();
        },

        showToast: function(message) {
            Android.showToast(message);
        }
    };

    // Listen for captured requests
    window.onCaptureStarted = function() {
        console.log('Capture started');
        // Trigger UI update
        if (typeof window.onCaptureStatusChanged === 'function') {
            window.onCaptureStatusChanged(true);
        }
    };

    // Override fetch to intercept and save requests
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const request = args[0];
        const options = args[1] || {};

        // Log request
        console.log('Fetch intercepted:', request, options);

        return originalFetch.apply(this, args);
    };

    console.log('Android bridge initialized');

    // Notify app that bridge is ready
    if (typeof window.onAndroidBridgeReady === 'function') {
        window.onAndroidBridgeReady();
    }
})();
