document.addEventListener('DOMContentLoaded', function() {
    const fetchTabsBtn = document.getElementById('fetchTabs');
    const closeSelectedBtn = document.getElementById('closeSelected');
    const openSelectedBtn = document.getElementById('openSelected');
    const selectAllCheckbox = document.getElementById('selectAll');
    const tabsTableBody = document.getElementById('tabsTableBody');
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    const collectionNameInput = document.getElementById('collectionName');

    // Load saved API key
    chrome.storage.local.get(['geminiApiKey'], function(result) {
        if (result.geminiApiKey) {
            geminiApiKeyInput.value = result.geminiApiKey;
        }
    });

    // Save API key
    saveApiKeyBtn.addEventListener('click', function() {
        const apiKey = geminiApiKeyInput.value;
        chrome.storage.local.set({ geminiApiKey: apiKey }, function() {
            alert('API Key saved successfully!');
        });
    });

    // Select all functionality
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.tab-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
            updateRowSelection(checkbox);
        });
    });

    // Fetch tabs and create table
    fetchTabsBtn.addEventListener('click', async function() {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabs = await chrome.tabs.query({ currentWindow: true });
        
        tabsTableBody.innerHTML = '';
        
        for (const tab of tabs) {
            if (tab.id !== currentTab.id) {
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
    });

    // Close selected tabs
    closeSelectedBtn.addEventListener('click', function() {
        const selectedCheckboxes = document.querySelectorAll('.tab-checkbox:checked');
        const tabIds = Array.from(selectedCheckboxes).map(checkbox => parseInt(checkbox.dataset.tabId));
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
            const result = await chrome.storage.local.get(['geminiApiKey']);
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
}); 