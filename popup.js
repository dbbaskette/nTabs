document.addEventListener('DOMContentLoaded', async () => {
    const fetchTabsBtn = document.getElementById('fetchTabs');
    const closeSelectedBtn = document.getElementById('closeSelected');
    const openSelectedBtn = document.getElementById('openSelected');
    const selectAllCheckbox = document.getElementById('selectAll');
    const tabsTableBody = document.getElementById('tabsTableBody');
    const settingsButton = document.getElementById('settingsButton');
    const collectionNameInput = document.getElementById('collectionName');
    const status = document.getElementById('status');
    const mainContent = document.getElementById('mainContent');
    const settingsContent = document.getElementById('settingsContent');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const closeSettingsBtn = document.getElementById('closeSettings');
    const notionApiKeyInput = document.getElementById('notionApiKey');
    const notionDatabaseIdInput = document.getElementById('notionDatabaseId');
    const syncToNotionBtn = document.getElementById('syncToNotion');
    const addToCollectionBtn = document.getElementById('addToCollection');

    // Load saved collection name
    const savedCollection = await chrome.storage.sync.get('collectionName');
    if (savedCollection.collectionName) {
        collectionNameInput.value = savedCollection.collectionName;
    }

    // Load saved settings
    const savedSettings = await chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId']);
    if (savedSettings.notionApiKey) {
        notionApiKeyInput.value = savedSettings.notionApiKey;
    }
    if (savedSettings.notionDatabaseId) {
        notionDatabaseIdInput.value = savedSettings.notionDatabaseId;
    }

    // Function to show settings
    function showSettings() {
        document.querySelector('.header').style.display = 'none';
        mainContent.style.display = 'none';
        settingsContent.style.display = 'block';
    }

    // Function to show main content
    function showMainContent() {
        document.querySelector('.header').style.display = 'flex';
        settingsContent.style.display = 'none';
        mainContent.style.display = 'block';
        refreshTabsList();
    }

    // Open settings
    settingsButton.addEventListener('click', showSettings);

    // Close settings
    closeSettingsBtn.addEventListener('click', showMainContent);

    // Save settings
    saveSettingsBtn.addEventListener('click', async () => {
        const notionApiKey = notionApiKeyInput.value;
        const notionDatabaseId = notionDatabaseIdInput.value;
        
        await chrome.storage.sync.set({
            'notionApiKey': notionApiKey,
            'notionDatabaseId': notionDatabaseId
        });
        
        status.textContent = 'Settings saved successfully!';
        setTimeout(() => {
            status.textContent = '';
            showMainContent();
        }, 3000);
    });

    // Function to refresh tabs list
    async function refreshTabsList() {
        // Get the latest tabs from the background script
        const response = await chrome.runtime.sendMessage({ action: 'getTabs' });
        const tabs = response.tabs;
        
        tabsTableBody.innerHTML = '';
        
        for (const tab of tabs) {
            // Only skip the settings page
            if (tab.url.includes('settings.html')) {
                continue;
            }

            const row = document.createElement('tr');
            const checkboxCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'tab-checkbox';
            checkbox.dataset.tabId = tab.id;
            checkbox.dataset.url = tab.url;
            
            checkbox.addEventListener('change', function() {
                updateRowSelection(this);
            });
            
            checkboxCell.appendChild(checkbox);
            row.appendChild(checkboxCell);
            
            const titleCell = document.createElement('td');
            titleCell.textContent = tab.title;
            row.appendChild(titleCell);
            
            const urlCell = document.createElement('td');
            urlCell.className = 'url-cell';
            urlCell.textContent = tab.url;
            row.appendChild(urlCell);

            const collectionCell = document.createElement('td');
            collectionCell.className = 'collection-cell';
            collectionCell.textContent = tab.collection || '';
            row.appendChild(collectionCell);
            
            tabsTableBody.appendChild(row);
        }
    }

    // Refresh tabs list when popup opens
    await refreshTabsList();

    // Listen for refresh messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'refreshTabs' && !sender.url?.includes('settings.html')) {
            refreshTabsList();
        }
    });

    // Save collection name
    collectionNameInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const collectionName = collectionNameInput.value.trim();
            if (collectionName) {
                await chrome.storage.sync.set({ 'collectionName': collectionName });
                status.textContent = 'Collection name saved successfully!';
                setTimeout(() => {
                    status.textContent = '';
                }, 3000);
            }
        }
    });

    // Select all functionality
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.tab-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
            updateRowSelection(checkbox);
        });
    });

    async function fetchAndDisplayTabs() {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabs = await chrome.tabs.query({ currentWindow: true });
        
        tabsTableBody.innerHTML = '';
        
        for (const tab of tabs) {
            const row = document.createElement('tr');
            const checkboxCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'tab-checkbox';
            checkbox.dataset.tabId = tab.id;
            checkbox.dataset.url = tab.url;
            
            checkbox.addEventListener('change', function() {
                updateRowSelection(this);
            });
            
            checkboxCell.appendChild(checkbox);
            row.appendChild(checkboxCell);
            
            const titleCell = document.createElement('td');
            titleCell.textContent = tab.title;
            row.appendChild(titleCell);
            
            const urlCell = document.createElement('td');
            urlCell.className = 'url-cell';
            urlCell.textContent = tab.url;
            row.appendChild(urlCell);

            const collectionCell = document.createElement('td');
            collectionCell.className = 'collection-cell';
            collectionCell.textContent = tab.collection || '';
            row.appendChild(collectionCell);
            
            tabsTableBody.appendChild(row);
        }
    }

    // Automatically fetch and display tabs when popup opens
    fetchAndDisplayTabs();

    // Close selected tabs
    closeSelectedBtn.addEventListener('click', function() {
        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        const tabIds = Array.from(selectedCheckboxes).map(checkbox => parseInt(checkbox.dataset.tabId));
        
        // Remove the rows from the table before closing the tabs
        selectedCheckboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            row.remove();
        });

        // Update select-all checkbox state
        const remainingCheckboxes = document.querySelectorAll('.tab-checkbox');
        const allChecked = remainingCheckboxes.length > 0 && Array.from(remainingCheckboxes).every(cb => cb.checked);
        selectAllCheckbox.checked = allChecked;

        // Close the tabs
        chrome.tabs.remove(tabIds);
    });

    // Open selected tabs
    openSelectedBtn.addEventListener('click', function() {
        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        selectedCheckboxes.forEach(checkbox => {
            chrome.tabs.create({ url: checkbox.dataset.url });
        });
    });

    function updateRowSelection(checkbox) {
        const row = checkbox.closest('tr');
        if (checkbox.checked) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    }

    // Only refresh tabs when the popup becomes visible, not when it loses focus
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            await refreshTabsList();
        }
    });

    // Function to sync selected tabs to Notion
    async function syncToNotion() {
        console.log('Starting sync to Notion...');
        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        console.log('Selected tabs:', selectedCheckboxes.length);
        
        if (selectedCheckboxes.length === 0) {
            status.textContent = 'Please select at least one tab to sync';
            setTimeout(() => { status.textContent = ''; }, 3000);
            return;
        }

        const savedSettings = await chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId', 'collectionName']);
        console.log('Retrieved settings:', {
            hasApiKey: !!savedSettings.notionApiKey,
            hasDatabaseId: !!savedSettings.notionDatabaseId,
            collectionName: savedSettings.collectionName
        });
        
        // Enhanced API key validation
        if (!savedSettings.notionApiKey) {
            console.error('No Notion API key found');
            status.textContent = 'Notion API key is missing. Please set it in settings.';
            setTimeout(() => { status.textContent = ''; }, 3000);
            return;
        }

        if (!savedSettings.notionDatabaseId) {
            console.error('No Notion Database ID found');
            status.textContent = 'Notion Database ID is missing. Please set it in settings.';
            setTimeout(() => { status.textContent = ''; }, 3000);
            return;
        }

        // Verify API key format
        if (!savedSettings.notionApiKey.startsWith('ntn_')) {
            console.error('Invalid API key format:', savedSettings.notionApiKey);
            status.textContent = 'Invalid Notion API key format. API key should start with "ntn_"';
            setTimeout(() => { status.textContent = ''; }, 3000);
            return;
        }

        status.textContent = 'Syncing to Notion...';
        let successCount = 0;
        let errorCount = 0;

        for (const checkbox of selectedCheckboxes) {
            try {
                const tabTitle = checkbox.closest('tr').querySelector('td:nth-child(2)').textContent;
                const tabUrl = checkbox.dataset.url;
                console.log('Syncing tab:', { title: tabTitle, url: tabUrl });

                const requestBody = {
                    parent: { database_id: savedSettings.notionDatabaseId.trim() },
                    properties: {
                        Name: {
                            title: [
                                {
                                    text: {
                                        content: tabTitle
                                    }
                                }
                            ]
                        },
                        Collection: {
                            rich_text: [
                                {
                                    text: {
                                        content: savedSettings.collectionName || 'Default'
                                    }
                                }
                            ]
                        },
                        'Created Date': {
                            date: {
                                start: new Date().toISOString()
                            }
                        },
                        URL: {
                            url: tabUrl
                        }
                    }
                };

                console.log('Sending request to Notion API...');
                const response = await fetch(`https://api.notion.com/v1/pages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${savedSettings.notionApiKey.trim()}`,
                        'Content-Type': 'application/json',
                        'Notion-Version': '2022-06-28'
                    },
                    body: JSON.stringify(requestBody)
                });

                console.log('Notion API response status:', response.status);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Notion API Error:', {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorData
                    });
                    
                    if (response.status === 401) {
                        throw new Error('Invalid Notion API key. Please check your API key in settings.');
                    } else if (response.status === 404) {
                        throw new Error('Database not found. Please check your Database ID in settings.');
                    } else {
                        throw new Error(`Notion API Error: ${response.status} ${response.statusText}`);
                    }
                }

                const responseData = await response.json();
                console.log('Successfully created page:', responseData);
                successCount++;
            } catch (error) {
                console.error('Error syncing to Notion:', error);
                errorCount++;
                if (error.message.includes('Invalid Notion API key')) {
                    status.textContent = error.message;
                    setTimeout(() => { status.textContent = ''; }, 5000);
                    return;
                }
            }
        }

        const resultMessage = `Synced ${successCount} tabs to Notion${errorCount > 0 ? ` (${errorCount} failed)` : ''}`;
        console.log(resultMessage);
        status.textContent = resultMessage;
        setTimeout(() => { status.textContent = ''; }, 5000);
    }

    // Add event listener for sync button
    syncToNotionBtn.addEventListener('click', syncToNotion);

    // Function to add selected tabs to collection
    async function addToCollection() {
        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            status.textContent = 'Please select at least one tab to add to collection';
            setTimeout(() => { status.textContent = ''; }, 3000);
            return;
        }

        const collectionName = collectionNameInput.value.trim();
        if (!collectionName) {
            status.textContent = 'Please enter a collection name';
            setTimeout(() => { status.textContent = ''; }, 3000);
            return;
        }

        for (const checkbox of selectedCheckboxes) {
            const row = checkbox.closest('tr');
            const collectionCell = row.querySelector('.collection-cell');
            collectionCell.textContent = collectionName;
        }

        status.textContent = `Added ${selectedCheckboxes.length} tabs to collection "${collectionName}"`;
        setTimeout(() => { status.textContent = ''; }, 3000);
    }

    // Add event listener for add to collection button
    addToCollectionBtn.addEventListener('click', addToCollection);
}); 