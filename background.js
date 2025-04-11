// Background script for handling tab operations
chrome.runtime.onInstalled.addListener(() => {
    console.log('nTabs extension installed');
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTabs') {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
            sendResponse({ tabs: tabs });
        });
        return true; // Required for async response
    }
}); 