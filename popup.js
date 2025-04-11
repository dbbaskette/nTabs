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
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const notionApiKeyInput = document.getElementById('notionApiKey');
    const notionDatabaseIdInput = document.getElementById('notionDatabaseId');

    // Load saved collection name
    const savedCollection = await chrome.storage.sync.get('collectionName');
    if (savedCollection.collectionName) {
        collectionNameInput.value = savedCollection.collectionName;
    }

    // Load saved settings
    const savedSettings = await chrome.storage.sync.get(['geminiApiKey', 'notionApiKey', 'notionDatabaseId']);
    if (savedSettings.geminiApiKey) {
        geminiApiKeyInput.value = savedSettings.geminiApiKey;
    }
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
        const apiKey = geminiApiKeyInput.value;
        const notionApiKey = notionApiKeyInput.value;
        const notionDatabaseId = notionDatabaseIdInput.value;
        
        await chrome.storage.sync.set({
            'geminiApiKey': apiKey,
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
            
            const summaryCell = document.createElement('td');
            summaryCell.textContent = 'Loading...';
            row.appendChild(summaryCell);
            
            tabsTableBody.appendChild(row);
            
            // Get summary for the tab
            getTabSummary(tab.url, summaryCell);
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
            
            const summaryCell = document.createElement('td');
            summaryCell.textContent = 'Loading...';
            row.appendChild(summaryCell);
            
            tabsTableBody.appendChild(row);
            
            // Get summary for the tab
            getTabSummary(tab.url, summaryCell);
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

    async function getTabSummary(url, summaryCell) {
        try {
            const result = await chrome.storage.sync.get(['geminiApiKey']);
            const apiKey = result.geminiApiKey;

            if (!apiKey) {
                summaryCell.textContent = 'API Key not set';
                return;
            }

            // Check if URL is a Google Doc/Sheet/Slides
            if (url.includes('docs.google.com') || url.includes('sheets.google.com') || url.includes('slides.google.com')) {
                summaryCell.textContent = 'Google Doc/Sheet/Slides';
                return;
            }

            // Check if URL is internal or private
            if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || 
                url.startsWith('file://') || url.startsWith('about:')) {
                summaryCell.textContent = 'Private';
                return;
            }

            try {
                const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `Please provide a brief summary of the content at this URL: ${url}`
                            }]
                        }]
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                    summaryCell.textContent = data.candidates[0].content.parts[0].text;
                } else {
                    summaryCell.textContent = 'Unable to generate summary';
                }
            } catch (error) {
                console.error('Error fetching summary:', error);
                summaryCell.textContent = 'Error generating summary';
            }
        } catch (error) {
            console.error('Error:', error);
            summaryCell.textContent = 'Error';
        }
    }

    // Only refresh tabs when the popup becomes visible, not when it loses focus
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            await refreshTabsList();
        }
    });
}); 