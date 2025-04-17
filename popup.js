document.addEventListener('DOMContentLoaded', async () => {
    // Always clear collections on popup open
    chrome.storage.sync.set({ collections: {} });
    console.log('DEBUG: Collections cleared on popup open');

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
    const openCollectionBtn = document.getElementById('openCollectionBtn');
    const collectionsLoading = document.getElementById('collectionsLoading');

    // Load saved settings
    const savedSettings = await chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId']);
    if (savedSettings.notionApiKey) {
        notionApiKeyInput.value = savedSettings.notionApiKey;
    }
    if (savedSettings.notionDatabaseId) {
        notionDatabaseIdInput.value = savedSettings.notionDatabaseId;
    }

    // On extension startup, clear all collections
    chrome.runtime.onStartup.addListener(async () => {
        await chrome.storage.sync.set({ collections: {} });
        console.log('DEBUG: Collections cleared on startup');
    });

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
    function renderTabs(tabList) {
        tabsList.innerHTML = '';
        const fragment = document.createDocumentFragment();
        tabList.forEach(tab => {
            const row = document.createElement('tr');
            // Generate a unique ID for collection tabs using the URL
            const tabId = tab.id || `collection-${btoa(tab.url).replace(/[^a-zA-Z0-9]/g, '')}`;
            row.innerHTML = `
                <td class="checkbox-column">
                    <input type="checkbox" class="tab-checkbox" data-tab-id="${tabId}" data-url="${escapeHtml(tab.url)}">
                </td>
                <td class="title-column">${escapeHtml(tab.title)}</td>
                <td class="url-column"><a href="${escapeHtml(tab.url)}" target="_blank">${escapeHtml(tab.url)}</a></td>
                <td class="collection-column">${tab.collections ? tab.collections.map(name => `<span class="collection-badge">${escapeHtml(name)}</span>`).join(', ') : ''}</td>
            `;
            fragment.appendChild(row);
        });
        tabsList.appendChild(fragment);
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

    // --- View Collections Logic ---
    let selectedCollectionName = null;
    let allCollectionsCount = {};

    viewCollectionsBtn.addEventListener('click', async () => {
        // Show loading notification
        collectionsLoading.style.display = '';
        collectionsList.innerHTML = '';
        openCollectionBtn.disabled = true;
        selectedCollectionName = null;
        // Query Notion for all tabs and their collections via background script
        const settings = await chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId']);
        const notionApiKey = settings.notionApiKey;
        const notionDatabaseId = settings.notionDatabaseId;
        if (!notionApiKey || !notionDatabaseId) {
            alert('Notion API key and database ID must be set.');
            collectionsLoading.style.display = 'none';
            return;
        }
        chrome.runtime.sendMessage({
            action: 'queryAllCollectionsFromNotion',
            payload: { notionApiKey, notionDatabaseId }
        }, async (response) => {
            collectionsLoading.style.display = 'none';
            if (!response || !response.success) {
                alert('Failed to fetch collections from Notion.');
                return;
            }
            const collections = response.collections;
            await chrome.storage.sync.set({ collections });
            // Debug: print the collection value for every tab
            console.log('DEBUG: Per-tab collections after Notion sync:');
            Object.entries(collections).forEach(([tabId, val]) => {
                console.log(`Tab ${tabId}: [${val.join(', ')}]`);
            });
            // --- Now proceed as before ---
            // Map collection name -> Set of tab URLs
            const collectionTabSets = {};
            Object.entries(collections).forEach(([tabUrl, arr]) => {
                (arr || []).forEach(name => {
                    if (name) {
                        if (!collectionTabSets[name]) collectionTabSets[name] = new Set();
                        collectionTabSets[name].add(tabUrl);
                    }
                });
            });
            // Convert sets to counts and tab lists
            const counts = {};
            Object.entries(collectionTabSets).forEach(([name, tabSet]) => {
                counts[name] = tabSet.size;
            });
            allCollectionsCount = counts;
            // Populate the list
            collectionsList.innerHTML = '';
            Object.entries(counts).forEach(([name, count]) => {
                const li = document.createElement('li');
                li.className = 'collection-list-item';
                li.tabIndex = 0;
                li.innerHTML = `<span>${name}</span><span class="collection-count">${count}</span>`;
                li.dataset.collection = name;
                li.addEventListener('click', function() {
                    document.querySelectorAll('.collection-list-item.selected').forEach(el => el.classList.remove('selected'));
                    li.classList.add('selected');
                    selectedCollectionName = name;
                    openCollectionBtn.disabled = false;
                });
                li.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') li.click();
                });
                collectionsList.appendChild(li);
            });
            openCollectionBtn.disabled = true;
            selectedCollectionName = null;
            showSection('collectionsContent');
        });
    });

    closeCollections.addEventListener('click', () => showSection('mainContent'));

    openCollectionBtn.addEventListener('click', async () => {
        if (!selectedCollectionName) return;
        showSection('mainContent');
        // Query Notion for tabs in this collection
        setSyncInProgress(true);
        const notionApiKey = notionApiKeyInput.value.trim();
        const notionDatabaseId = notionDatabaseIdInput.value.trim();
        if (!notionApiKey || !notionDatabaseId) {
            showStatus('Please enter your Notion API key and Database ID in Settings.');
            setSyncInProgress(false);
            return;
        }
        chrome.runtime.sendMessage({
            action: 'queryCollectionTabs',
            payload: {
                notionApiKey,
                notionDatabaseId,
                collectionName: selectedCollectionName
            }
        }, (response) => {
            setSyncInProgress(false);
            if (!response || !response.success) {
                showStatus(`Failed to query Notion: ${response?.error || 'Unknown error'}`);
                return;
            }
            // Render tabs from response.tabs
            renderTabs(response.tabs || []);
        });
    });

    // Add: Sync local collections from Notion tabs (if available)
    async function syncLocalCollectionsFromNotion(notionTabs) {
        const collectionsData = await chrome.storage.sync.get('collections');
        const collections = collectionsData.collections || {};
        let changed = false;
        notionTabs.forEach(tab => {
            // Use URL as tab ID key (or adapt as needed)
            if (tab.url) {
                // Only update if Notion collections differ from local
                if (!Array.isArray(collections[tab.url]) || JSON.stringify(collections[tab.url]) !== JSON.stringify(tab.collections)) {
                    collections[tab.url] = tab.collections;
                    changed = true;
                }
            }
        });
        if (changed) {
            await chrome.storage.sync.set({ collections });
            console.log('DEBUG: Local collections updated from Notion.');
        }
    }

    // Refresh Tabs button resets view to open tabs
    fetchTabsBtn.addEventListener('click', async () => {
        status.textContent = 'Building list of open tabs...';
        try {
            await fetchAndDisplayTabs();
            status.textContent = '';
        } catch (e) {
            status.textContent = 'Failed to build tab list.';
        }
    });

    // --- Event Handlers ---
    closeSelectedBtn.addEventListener('click', async () => {
        const tabIds = Array.from(document.querySelectorAll('.tab-checkbox:checked')).map(cb => parseInt(cb.dataset.tabId));
        await chrome.tabs.remove(tabIds);
        await fetchAndDisplayTabs();
    });
    openSelectedBtn.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        const tabIds = Array.from(selectedCheckboxes).map(checkbox => {
            const tabId = checkbox.dataset.tabId;
            const url = checkbox.dataset.url;
            return { tabId, url };
        });
        
        // Get all current tabs first
        const currentTabs = await chrome.tabs.query({});
        
        // For each selected tab, try to find it in current tabs or create a new one
        for (const { tabId, url } of tabIds) {
            if (tabId.startsWith('collection-')) {
                // This is a collection tab, use the stored URL
                await chrome.tabs.create({ url });
            } else {
                // This is a current tab, find it by ID
                const currentTab = currentTabs.find(t => t.id === parseInt(tabId));
                if (currentTab) {
                    await chrome.tabs.create({ url: currentTab.url });
                }
            }
        }
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