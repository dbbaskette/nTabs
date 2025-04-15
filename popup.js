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

    // --- Utility Functions ---
    function debounce(fn, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    function showStatus(message) {
        status.textContent = message;
        status.classList.add('show');
        setTimeout(() => {
            status.classList.remove('show');
        }, 3000);
    }
    function setSyncInProgress(inProgress) {
        syncToNotionBtn.disabled = inProgress;
        syncToNotionBtn.classList.toggle('loading', inProgress);
        syncToNotionBtn.innerHTML = inProgress ? '<i class="fas fa-spinner fa-spin"></i> Syncing...' : 'Sync to Notion';
    }
    function isValidCollectionName(name) {
        return /^[\w\s-]{1,50}$/.test(name);
    }
    function showSection(sectionId) {
        [mainContent, settingsContent, collectionsContent].forEach(sec => sec.style.display = 'none');
        document.getElementById(sectionId).style.display = 'block';
    }
    // --- End Utility Functions ---

    // --- Render Functions ---
    function createTabRow(tab, collections) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="checkbox-column">
                <input type="checkbox" class="tab-checkbox" data-tab-id="${tab.id}">
            </td>
            <td class="title-column">${escapeHtml(tab.title)}</td>
            <td class="url-column"><a href="${escapeHtml(tab.url)}" target="_blank">${escapeHtml(tab.url)}</a></td>
            <td class="collection-column">${escapeHtml(collections[tab.id] || '')}</td>
        `;
        return row;
    }
    // --- End Render Functions ---

    // --- Main Logic ---
    async function fetchAndDisplayTabs() {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const collectionsData = await chrome.storage.sync.get('collections');
        const collections = collectionsData.collections || {};
        tabsList.innerHTML = '';
        const fragment = document.createDocumentFragment();
        tabs.forEach(tab => fragment.appendChild(createTabRow(tab, collections)));
        tabsList.appendChild(fragment);
    }
    async function displayCollections() {
        collectionsList.innerHTML = '';
        const tabs = await chrome.tabs.query({});
        const collections = new Set();
        tabs.forEach(tab => {
            if (tab.collection) collections.add(tab.collection);
        });
        const sortedCollections = Array.from(collections).sort();
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
    // --- End Main Logic ---

    // --- Event Handlers ---
    fetchTabsBtn.addEventListener('click', fetchAndDisplayTabs);
    closeSelectedBtn.addEventListener('click', async () => {
        const tabIds = Array.from(document.querySelectorAll('.tab-checkbox:checked')).map(cb => parseInt(cb.dataset.tabId));
        await chrome.tabs.remove(tabIds);
        await fetchAndDisplayTabs();
    });
    openSelectedBtn.addEventListener('click', async () => {
        const tabIds = Array.from(document.querySelectorAll('.tab-checkbox:checked')).map(cb => parseInt(cb.dataset.tabId));
        const tabs = await chrome.tabs.query({});
        tabIds.forEach(tabId => {
            const tab = tabs.find(t => t.id === tabId);
            if (tab) chrome.tabs.create({ url: tab.url });
        });
    });
    settingsButton.addEventListener('click', () => showSection('settingsContent'));
    closeSettings.addEventListener('click', () => showSection('mainContent'));
    saveSettings.addEventListener('click', async () => {
        await chrome.storage.sync.set({
            notionApiKey: notionApiKeyInput.value,
            notionDatabaseId: notionDatabaseIdInput.value
        });
        showStatus('Settings saved successfully!');
    });
    viewCollectionsBtn.addEventListener('click', async () => {
        showSection('collectionsContent');
        await displayCollections();
    });
    closeCollections.addEventListener('click', () => showSection('mainContent'));
    addToCollectionBtn.addEventListener('click', async () => {
        const collectionName = collectionNameInput.value.trim();
        if (!isValidCollectionName(collectionName)) {
            showStatus('Invalid collection name. Only letters, numbers, spaces, dashes, and underscores allowed.');
            return;
        }
        const tabIds = Array.from(document.querySelectorAll('.tab-checkbox:checked')).map(cb => parseInt(cb.dataset.tabId));
        if (tabIds.length === 0) {
            showStatus('Please select at least one tab');
            return;
        }
        const collectionsData = await chrome.storage.sync.get('collections');
        const collections = collectionsData.collections || {};
        tabIds.forEach(tabId => { collections[tabId] = collectionName; });
        await chrome.storage.sync.set({ collections });
        showStatus(`Added ${tabIds.length} tabs to collection "${collectionName}"`);
        await fetchAndDisplayTabs();
    });
    const debouncedSyncToNotion = debounce(async function() {
        const tabIds = Array.from(document.querySelectorAll('.tab-checkbox:checked')).map(cb => parseInt(cb.dataset.tabId));
        if (tabIds.length === 0) {
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
        const tabs = await chrome.tabs.query({});
        const collectionsData = await chrome.storage.sync.get('collections');
        const collections = collectionsData.collections || {};
        const selectedTabs = tabs.filter(tab => tabIds.includes(tab.id));
        chrome.runtime.sendMessage({
            action: 'notionSync',
            payload: {
                notionApiKey,
                notionDatabaseId,
                tabs: selectedTabs,
                collections
            }
        }, (response) => {
            setSyncInProgress(false);
            if (!response || !response.success) {
                showStatus(`Failed to sync: ${response?.error || 'Unknown error'}`);
                return;
            }
            const results = response.results;
            const successCount = results.filter(r => r.ok).length;
            const errorCount = results.length - successCount;
            const lastErrorMsg = results.find(r => !r.ok)?.error || '';
            if (successCount > 0 && errorCount === 0) {
                showStatus(`Synced ${successCount} tab(s) to Notion.`);
            } else if (successCount > 0 && errorCount > 0) {
                showStatus(`Synced ${successCount} tab(s), ${errorCount} failed. Last error: ${lastErrorMsg}`);
            } else if (errorCount > 0) {
                showStatus(`Failed to sync: ${lastErrorMsg}`);
            }
        });
    }, 1200);
    syncToNotionBtn.addEventListener('click', debouncedSyncToNotion);
    document.addEventListener('change', function(e) {
        if (e.target.matches('.tab-checkbox')) {
            const checkboxes = document.querySelectorAll('.tab-checkbox');
            const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
            if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
        }
    });
    // Set logo to the default icon on load
    const logo = document.getElementById('ntabsLogo');
    if (logo) logo.src = 'icons/icon128.png';
    // Initial fetch of tabs when popup loads
    await fetchAndDisplayTabs();
});