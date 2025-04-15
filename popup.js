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
    const settingsButton = document.getElementById('settingsButton');
    const closeSettings = document.getElementById('closeSettings');
    const saveSettings = document.getElementById('saveSettings');
    const notionApiKeyInput = document.getElementById('notionApiKey');
    const notionDatabaseIdInput = document.getElementById('notionDatabaseId');
    const mainContent = document.getElementById('mainContent');
    const settingsContent = document.getElementById('settingsContent');
    const collectionsContent = document.getElementById('collectionsContent');
    const closeCollections = document.getElementById('closeCollections');
    const collectionsList = document.getElementById('collectionsList');

    // Load saved settings
    const savedSettings = await chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId']);
    if (savedSettings.notionApiKey) {
        notionApiKeyInput.value = savedSettings.notionApiKey;
    }
    if (savedSettings.notionDatabaseId) {
        notionDatabaseIdInput.value = savedSettings.notionDatabaseId;
    }

    // Utility: debounce function to prevent rapid double clicks
    function debounce(fn, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Helper function to show status messages
    function showStatus(message) {
        status.textContent = message;
        status.classList.add('show');
        setTimeout(() => {
            status.classList.remove('show');
        }, 3000);
    }

    // UI/UX Improvement: show spinner/disable during long sync
    function setSyncInProgress(inProgress) {
        syncToNotionBtn.disabled = inProgress;
        syncToNotionBtn.classList.toggle('loading', inProgress);
        if (inProgress) {
            syncToNotionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
        } else {
            syncToNotionBtn.innerHTML = 'Sync to Notion';
        }
    }

    // Security: Validate collection name input
    function isValidCollectionName(name) {
        // Only allow letters, numbers, spaces, dashes, and underscores
        return /^[\w\s-]{1,50}$/.test(name);
    }

    // Fetch and display all open tabs in the current Chrome window.
    // For each tab, display its title, URL, and collection (if any).
    async function fetchAndDisplayTabs() {
        const tabs = await chrome.tabs.query({});
        // Retrieve collections mapping from storage
        const collectionsData = await chrome.storage.sync.get('collections');
        const collections = collectionsData.collections || {};
        tabsList.innerHTML = '';
        // Use a document fragment for efficient DOM updates
        const fragment = document.createDocumentFragment();
        tabs.forEach(tab => {
            // Create a table row for each tab
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="checkbox-column">
                    <input type="checkbox" class="tab-checkbox" data-tab-id="${tab.id}">
                </td>
                <td class="title-column">${tab.title}</td>
                <td class="url-column">${tab.url}</td>
                <td class="collection-column">${collections[tab.id] || ''}</td>
            `;
            fragment.appendChild(row);
        });
        tabsList.appendChild(fragment);
    }

    // Initial fetch of tabs when popup loads
    await fetchAndDisplayTabs();

    // Refresh the tab list when the user clicks 'Refresh Tabs'
    fetchTabsBtn.addEventListener('click', fetchAndDisplayTabs);

    // Close all selected tabs and refresh the list
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
    settingsButton.addEventListener('click', () => {
        mainContent.style.display = 'none';
        settingsContent.style.display = 'block';
    });

    closeSettings.addEventListener('click', () => {
        settingsContent.style.display = 'none';
        mainContent.style.display = 'block';
    });

    saveSettings.addEventListener('click', async () => {
        const notionApiKey = notionApiKeyInput.value;
        const notionDatabaseId = notionDatabaseIdInput.value;
        
        await chrome.storage.sync.set({
            notionApiKey,
            notionDatabaseId
        });
        
        showStatus('Settings saved successfully!');
        setTimeout(() => {
            showStatus('');
        }, 3000);
    });

    // Collections functionality
    viewCollectionsBtn.addEventListener('click', async () => {
        mainContent.style.display = 'none';
        collectionsContent.style.display = 'block';
        await displayCollections();
    });

    closeCollections.addEventListener('click', () => {
        collectionsContent.style.display = 'none';
        mainContent.style.display = 'block';
    });

    async function displayCollections() {
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
        if (!isValidCollectionName(collectionName)) {
            showStatus('Invalid collection name. Only letters, numbers, spaces, dashes, and underscores allowed.');
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
        await fetchAndDisplayTabs(); // Always refresh after updating collections
    });

    // Debounced sync handler
    const debouncedSyncToNotion = debounce(async function() {
        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            showStatus('Please select at least one tab to sync.');
            return;
        }
        const notionApiKey = notionApiKeyInput.value.trim();
        const notionDatabaseId = notionDatabaseIdInput.value.trim();
        if (!notionApiKey || !notionDatabaseId) {
            showStatus('Please enter your Notion API key and Database ID in Settings.');
            return;
        }
        setSyncInProgress(true);
        const tabIds = Array.from(selectedCheckboxes).map(checkbox => parseInt(checkbox.dataset.tabId));
        const tabs = await chrome.tabs.query({});
        const collectionsData = await chrome.storage.sync.get('collections');
        const collections = collectionsData.collections || {};
        const selectedTabs = tabs.filter(tab => tabIds.includes(tab.id));
        let successCount = 0;
        let errorCount = 0;
        let lastErrorMsg = '';
        for (const tab of selectedTabs) {
            const notionPayload = {
                parent: { database_id: notionDatabaseId },
                properties: {
                    Name: { title: [{ text: { content: tab.title || tab.url } }] },
                    URL: { url: tab.url },
                    Collection: { rich_text: [{ text: { content: collections[tab.id] || '' } }] },
                    'Created Date': {
                        date: {
                            start: new Date().toISOString().split('T')[0]
                        }
                    }
                }
            };
            try {
                const response = await fetch('https://api.notion.com/v1/pages', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${notionApiKey}`,
                        'Content-Type': 'application/json',
                        'Notion-Version': '2022-06-28'
                    },
                    body: JSON.stringify(notionPayload)
                });
                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                    const errorData = await response.json().catch(() => ({}));
                    lastErrorMsg = errorData.message || response.statusText || 'Unknown error';
                }
            } catch (err) {
                errorCount++;
                lastErrorMsg = err.message || err.toString();
            }
        }
        setSyncInProgress(false);
        if (successCount > 0 && errorCount === 0) {
            showStatus(`Synced ${successCount} tab(s) to Notion.`);
        } else if (successCount > 0 && errorCount > 0) {
            showStatus(`Synced ${successCount} tab(s), ${errorCount} failed. Last error: ${lastErrorMsg}`);
        } else if (errorCount > 0) {
            showStatus(`Failed to sync: ${lastErrorMsg}`);
        }
    }, 1200);

    // Attach debounced sync handler
    syncToNotionBtn.addEventListener('click', debouncedSyncToNotion);

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

    // Remove logo color scheme swapping logic (no longer needed)
    // Set logo to the default icon on load
    const logo = document.getElementById('ntabsLogo');
    if (logo) logo.src = 'icons/icon128.png';
}); 