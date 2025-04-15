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
    if (request.action === 'notionSync') {
        (async () => {
            try {
                const { notionApiKey, notionDatabaseId, tabs, collections } = request.payload;
                let results = [];
                for (const tab of tabs) {
                    const notionPayload = {
                        parent: { database_id: notionDatabaseId },
                        properties: {
                            Name: { title: [{ text: { content: tab.title || tab.url } }] },
                            URL: { url: tab.url },
                            Collection: { rich_text: [{ text: { content: collections[tab.id] || '' } }] },
                            'Created Date': { date: { start: new Date().toISOString().split('T')[0] } }
                        }
                    };
                    const response = await fetch('https://api.notion.com/v1/pages', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${notionApiKey}`,
                            'Content-Type': 'application/json',
                            'Notion-Version': '2022-06-28'
                        },
                        body: JSON.stringify(notionPayload)
                    });
                    let result = { tabId: tab.id, ok: response.ok };
                    if (!response.ok) {
                        try {
                            const errorData = await response.json();
                            result.error = errorData.message || response.statusText;
                        } catch (e) {
                            result.error = response.statusText;
                        }
                    }
                    results.push(result);
                }
                sendResponse({ success: true, results });
            } catch (err) {
                sendResponse({ success: false, error: err.message || err.toString() });
            }
        })();
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