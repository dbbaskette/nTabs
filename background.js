// Background script for handling tab operations
chrome.runtime.onInstalled.addListener(() => {
    console.log('nTabs extension installed');
});

// Function to refresh tabs list
function refreshTabsList() {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
        chrome.runtime.sendMessage({ action: 'refreshTabs', tabs: tabs }).catch(() => {
            // Ignore errors when popup is not open
        });
    });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTabs') {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
            sendResponse({ tabs: tabs });
        });
        return true; // Required for async response
    }
});

// Listen for tab events
chrome.tabs.onCreated.addListener((tab) => {
    if (!tab.url?.includes('settings.html')) {
        refreshTabsList();
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab.url?.includes('settings.html') && changeInfo.status === 'complete') {
        refreshTabsList();
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (!removeInfo.windowId) {
        refreshTabsList();
    }
}); 