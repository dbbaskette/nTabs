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
        if (tab.url && tab.url.startsWith('chrome://')) return null;
        const row = document.createElement('tr');
        // Defensive: handle legacy array or string
        let mostRecent = '';
        if (Array.isArray(collections[tab.id])) {
            mostRecent = collections[tab.id].length > 0 ? collections[tab.id][collections[tab.id].length - 1] : '';
        } else if (typeof collections[tab.id] === 'string') {
            mostRecent = collections[tab.id];
        }
        const collectionsHtml = mostRecent ? `<span class="collection-badge">${escapeHtml(mostRecent)}</span>` : '';
        row.innerHTML = `
            <td class="checkbox-column">
                <input type="checkbox" class="tab-checkbox" data-tab-id="${tab.id}">
            </td>
            <td class="title-column">${escapeHtml(tab.title)}</td>
            <td class="url-column"><a href="${escapeHtml(tab.url)}" target="_blank">${escapeHtml(tab.url)}</a></td>
            <td class="collection-column">${collectionsHtml}</td>
        `;
        return row;
    }
    // --- End Render Functions ---

    // --- Main Logic ---
    async function fetchAndDisplayTabs(checkedTabIds = []) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const collectionsData = await chrome.storage.sync.get('collections');
        const collections = collectionsData.collections || {};
        tabsList.innerHTML = '';
        const fragment = document.createDocumentFragment();
        tabs.forEach(tab => {
            const row = createTabRow(tab, collections);
            if (row) fragment.appendChild(row);
        });
        tabsList.appendChild(fragment);
        // Restore checked state
        if (checkedTabIds.length > 0) {
            document.querySelectorAll('.tab-checkbox').forEach(cb => {
                if (checkedTabIds.includes(parseInt(cb.dataset.tabId))) {
                    cb.checked = true;
                }
            });
        }
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
    const collectionNameInputEl = collectionNameInput;
    addToCollectionBtn.addEventListener('click', async function() {
        const tabIds = Array.from(document.querySelectorAll('.tab-checkbox:checked')).map(cb => parseInt(cb.dataset.tabId));
        const collectionNameInput = collectionNameInputEl.value.trim();
        if (!collectionNameInput) {
            showStatus('Please enter a collection name.');
            return;
        }
        if (!isValidCollectionName(collectionNameInput)) {
            showStatus('Invalid collection name. Only letters, numbers, spaces, dashes, and underscores allowed.');
            return;
        }
        const collectionsData = await chrome.storage.sync.get('collections');
        const collections = collectionsData.collections || {};
        for (const tabId of tabIds) {
            collections[tabId] = collectionNameInput;
        }
        await chrome.storage.sync.set({ collections });
        showStatus('Added to collection.');
        await fetchAndDisplayTabs(tabIds);
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
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function(e) {
            const checkboxes = document.querySelectorAll('.tab-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        });
    }
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