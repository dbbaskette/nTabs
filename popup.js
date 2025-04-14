document.addEventListener('DOMContentLoaded', async () => {
    // Initialize elements
    const fetchTabsBtn = document.getElementById('fetchTabs');
    const closeSelectedBtn = document.getElementById('closeSelected');
    const openSelectedBtn = document.getElementById('openSelected');
    const syncToNotionBtn = document.getElementById('syncToNotion');
    const addToCollectionBtn = document.getElementById('addToCollection');
    const viewCollectionsBtn = document.getElementById('viewCollections');
    const collectionNameInput = document.getElementById('collectionName');
    const tabsList = document.getElementById('tabsList');
    const status = document.getElementById('status');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    // Load saved settings
    const savedSettings = await chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId']);
    if (savedSettings.notionApiKey) {
        document.getElementById('notionApiKey').value = savedSettings.notionApiKey;
    }
    if (savedSettings.notionDatabaseId) {
        document.getElementById('notionDatabaseId').value = savedSettings.notionDatabaseId;
    }

    // Fetch and display tabs
    async function fetchAndDisplayTabs() {
        const tabs = await chrome.tabs.query({});
        const collectionsData = await chrome.storage.sync.get('collections');
        const collections = collectionsData.collections || {};
        tabsList.innerHTML = '';
        
        tabs.forEach(tab => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="checkbox-column">
                    <input type="checkbox" class="tab-checkbox" data-tab-id="${tab.id}">
                </td>
                <td class="title-column">${tab.title}</td>
                <td class="url-column">${tab.url}</td>
                <td class="collection-column">${collections[tab.id] || ''}</td>
            `;
            tabsList.appendChild(row);
        });
    }

    // Initial fetch of tabs
    await fetchAndDisplayTabs();

    // Event listeners for buttons
    fetchTabsBtn.addEventListener('click', fetchAndDisplayTabs);

    closeSelectedBtn.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        const tabIds = Array.from(selectedCheckboxes).map(checkbox => parseInt(checkbox.dataset.tabId));
        await chrome.tabs.remove(tabIds);
        await fetchAndDisplayTabs();
    });

    openSelectedBtn.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        for (const checkbox of selectedCheckboxes) {
            const tabId = parseInt(checkbox.dataset.tabId);
            const tab = await chrome.tabs.get(tabId);
            await chrome.tabs.create({ url: tab.url });
        }
    });

    // Settings functionality
    document.getElementById('settingsButton').addEventListener('click', () => {
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('settingsContent').style.display = 'block';
    });

    document.getElementById('closeSettings').addEventListener('click', () => {
        document.getElementById('settingsContent').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    });

    document.getElementById('saveSettings').addEventListener('click', async () => {
        const notionApiKey = document.getElementById('notionApiKey').value;
        const notionDatabaseId = document.getElementById('notionDatabaseId').value;
        
        await chrome.storage.sync.set({
            notionApiKey,
            notionDatabaseId
        });
        
        status.textContent = 'Settings saved successfully!';
        setTimeout(() => {
            status.textContent = '';
        }, 3000);
    });

    // Collections functionality
    viewCollectionsBtn.addEventListener('click', async () => {
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('collectionsContent').style.display = 'block';
        await displayCollections();
    });

    document.getElementById('closeCollections').addEventListener('click', () => {
        document.getElementById('collectionsContent').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    });

    async function displayCollections() {
        const collectionsList = document.getElementById('collectionsList');
        collectionsList.innerHTML = '';

        // Get all tabs
        const tabs = await chrome.tabs.query({});
        
        // Extract unique collections
        const collections = new Set();
        tabs.forEach(tab => {
            if (tab.collection) {
                collections.add(tab.collection);
            }
        });

        // Sort collections alphabetically
        const sortedCollections = Array.from(collections).sort();

        // Display collections
        sortedCollections.forEach(collection => {
            const li = document.createElement('li');
            li.textContent = collection;
            collectionsList.appendChild(li);
        });

        if (collections.size === 0) {
            const li = document.createElement('li');
            li.textContent = 'No collections found';
            li.style.color = '#718096';
            li.style.fontStyle = 'italic';
            collectionsList.appendChild(li);
        }
    }

    // Add to collection functionality
    addToCollectionBtn.addEventListener('click', async () => {
        const collectionName = collectionNameInput.value.trim();
        if (!collectionName) {
            showStatus('Please enter a collection name');
            return;
        }

        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            showStatus('Please select at least one tab');
            return;
        }

        const tabIds = Array.from(selectedCheckboxes).map(checkbox => parseInt(checkbox.dataset.tabId));
        const collectionsData = await chrome.storage.sync.get('collections');
        const collections = collectionsData.collections || {};
        
        // Update collections for selected tabs while preserving existing collections
        tabIds.forEach(tabId => {
            collections[tabId] = collectionName;
        });
        
        await chrome.storage.sync.set({ collections });

        showStatus(`Added ${tabIds.length} tabs to collection "${collectionName}"`);
        await fetchAndDisplayTabs();
    });

    // Helper function to show status messages
    function showStatus(message) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.classList.add('show');
        setTimeout(() => {
            status.classList.remove('show');
        }, 3000);
    }

    // Select all functionality
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function(e) {
            const checkboxes = document.querySelectorAll('.tab-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        });
    }

    // Update select all checkbox when individual checkboxes change
    document.addEventListener('change', function(e) {
        if (e.target.matches('.tab-checkbox')) {
            const checkboxes = document.querySelectorAll('.tab-checkbox');
            const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = allChecked;
            }
        }
    });

    // Sync to Notion functionality
    syncToNotionBtn.addEventListener('click', async () => {
        const notionApiKey = document.getElementById('notionApiKey').value.trim();
        const notionDatabaseId = document.getElementById('notionDatabaseId').value.trim();

        if (!notionApiKey) {
            showStatus('Please enter your Notion API Key in settings');
            return;
        }

        if (!notionDatabaseId) {
            showStatus('Please enter your Notion Database ID in settings');
            return;
        }

        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            showStatus('Please select at least one tab to sync');
            return;
        }

        try {
            showStatus('Syncing to Notion...');
            const tabIds = Array.from(selectedCheckboxes).map(checkbox => parseInt(checkbox.dataset.tabId));
            const tabs = await Promise.all(tabIds.map(id => chrome.tabs.get(id)));
            const collectionsData = await chrome.storage.sync.get('collections');
            const collections = collectionsData.collections || {};
            
            for (const tab of tabs) {
                const response = await fetch('https://api.notion.com/v1/pages', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${notionApiKey}`,
                        'Content-Type': 'application/json',
                        'Notion-Version': '2022-06-28'
                    },
                    body: JSON.stringify({
                        parent: { database_id: notionDatabaseId },
                        properties: {
                            Name: {
                                title: [
                                    {
                                        text: {
                                            content: tab.title
                                        }
                                    }
                                ]
                            },
                            URL: {
                                url: tab.url
                            },
                            Collection: {
                                rich_text: [
                                    {
                                        text: {
                                            content: collections[tab.id] || 'Uncategorized'
                                        }
                                    }
                                ]
                            },
                            'Created Date': {
                                date: {
                                    start: new Date().toISOString().split('T')[0]
                                }
                            }
                        }
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to sync to Notion');
                }
            }

            showStatus(`Successfully synced ${tabs.length} tabs to Notion`);
        } catch (error) {
            console.error('Notion sync error:', error);
            showStatus(`Error syncing to Notion: ${error.message}`);
        }
    });
}); 