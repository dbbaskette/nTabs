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
                    // Defensive: handle legacy array or string for collection
                    let collectionName = '';
                    if (Array.isArray(collections[tab.id])) {
                        collectionName = collections[tab.id].length > 0 ? collections[tab.id][collections[tab.id].length - 1] : '';
                    } else if (typeof collections[tab.id] === 'string') {
                        collectionName = collections[tab.id];
                    }
                    if (!collectionName) {
                        results.push({ tabId: tab.id, ok: false, error: 'No collection assigned.' });
                        continue;
                    }
                    // 1. Query Notion for existing page with this URL
                    let pageId = null;
                    let existingCollections = [];
                    try {
                        const queryResp = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}/query`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${notionApiKey}`,
                                'Content-Type': 'application/json',
                                'Notion-Version': '2022-06-28'
                            },
                            body: JSON.stringify({
                                filter: {
                                    property: 'URL',
                                    url: {
                                        equals: tab.url
                                    }
                                }
                            })
                        });
                        if (queryResp.ok) {
                            const queryData = await queryResp.json();
                            if (queryData.results && queryData.results.length > 0) {
                                pageId = queryData.results[0].id;
                                // Extract existing collection values
                                const props = queryData.results[0].properties;
                                if (props && props.Collection && props.Collection.multi_select) {
                                    existingCollections = props.Collection.multi_select.map(ms => ms.name);
                                }
                            }
                        }
                    } catch (e) {
                        // If query fails, fallback to create
                    }
                    if (pageId) {
                        // 2. Update the collection if needed
                        let newCollections = existingCollections.includes(collectionName)
                            ? existingCollections
                            : [...existingCollections, collectionName];
                        try {
                            const updateResp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
                                method: 'PATCH',
                                headers: {
                                    'Authorization': `Bearer ${notionApiKey}`,
                                    'Content-Type': 'application/json',
                                    'Notion-Version': '2022-06-28'
                                },
                                body: JSON.stringify({
                                    properties: {
                                        Collection: { multi_select: newCollections.map(name => ({ name })) }
                                    }
                                })
                            });
                            results.push({ tabId: tab.id, ok: updateResp.ok });
                        } catch (e) {
                            results.push({ tabId: tab.id, ok: false, error: e.message || e.toString() });
                        }
                    } else {
                        // 3. Create new page
                        const notionPayload = {
                            parent: { database_id: notionDatabaseId },
                            properties: {
                                Name: { title: [{ text: { content: tab.title || tab.url } }] },
                                URL: { url: tab.url },
                                Collection: { multi_select: [{ name: collectionName }] },
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
                }
                sendResponse({ success: true, results });
            } catch (err) {
                sendResponse({ success: false, error: err.message || err.toString() });
            }
        })();
        return true; // Required for async response
    }
    if (request.action === 'queryCollectionTabs') {
        (async () => {
            try {
                const { notionApiKey, notionDatabaseId, collectionName } = request.payload;
                // Query Notion for all pages with the given collection
                const queryResp = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}/query`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${notionApiKey}`,
                        'Content-Type': 'application/json',
                        'Notion-Version': '2022-06-28'
                    },
                    body: JSON.stringify({
                        filter: {
                            property: 'Collection',
                            multi_select: {
                                contains: collectionName
                            }
                        }
                    })
                });
                if (!queryResp.ok) {
                    const err = await queryResp.json().catch(() => ({}));
                    sendResponse({ success: false, error: err.message || queryResp.statusText });
                    return;
                }
                const data = await queryResp.json();
                // Debug: print out all collection values for each returned page
                (data.results || []).forEach(page => {
                    const props = page.properties;
                    const allCollections = (props.Collection && props.Collection.multi_select && props.Collection.multi_select.map(ms => ms.name)) || [];
                    console.log(`DEBUG: Page title='${(props.Name && props.Name.title && props.Name.title[0] && props.Name.title[0].plain_text) || ''}', url='${(props.URL && props.URL.url) || ''}', collections=`, allCollections);
                });
                // Extract tabs: {title, url, collections (array)}
                const tabs = (data.results || []).map(page => {
                    const props = page.properties;
                    return {
                        title: (props.Name && props.Name.title && props.Name.title[0] && props.Name.title[0].plain_text) || '',
                        url: (props.URL && props.URL.url) || '',
                        collections: (props.Collection && props.Collection.multi_select && props.Collection.multi_select.map(ms => ms.name)) || []
                    };
                });
                sendResponse({ success: true, tabs });
            } catch (err) {
                sendResponse({ success: false, error: err.message || err.toString() });
            }
        })();
        return true; // Required for async response
    }
    if (request.action === 'queryAllCollectionsFromNotion') {
        (async () => {
            try {
                const { notionApiKey, notionDatabaseId } = request.payload;
                const resp = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}/query`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${notionApiKey}`,
                        'Content-Type': 'application/json',
                        'Notion-Version': '2022-06-28'
                    },
                    body: JSON.stringify({}) // No filter: get all
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    sendResponse({ success: false, error: err.message || resp.statusText });
                    return;
                }
                const data = await resp.json();
                // Build local collections mapping: url -> array of collections
                const collections = {};
                (data.results || []).forEach(page => {
                    const props = page.properties;
                    const url = (props.URL && props.URL.url) || '';
                    const collectionsArr = (props.Collection && props.Collection.multi_select && props.Collection.multi_select.map(ms => ms.name)) || [];
                    if (url) collections[url] = collectionsArr;
                });
                sendResponse({ success: true, collections });
            } catch (err) {
                sendResponse({ success: false, error: err.message || err.toString() });
            }
        })();
        return true; // Required for async response
    }
});

// On extension startup, clear all collections
chrome.runtime.onStartup.addListener(async () => {
    await chrome.storage.sync.set({ collections: {} });
    console.log('DEBUG: Collections cleared on startup');
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