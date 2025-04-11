document.addEventListener('DOMContentLoaded', function() {
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const notionApiKeyInput = document.getElementById('notionApiKey');
    const notionDatabaseIdInput = document.getElementById('notionDatabaseId');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const closeSettingsBtn = document.getElementById('closeSettings');

    // Load saved settings
    chrome.storage.local.get(['geminiApiKey', 'notionApiKey', 'notionDatabaseId'], function(result) {
        if (result.geminiApiKey) geminiApiKeyInput.value = result.geminiApiKey;
        if (result.notionApiKey) notionApiKeyInput.value = result.notionApiKey;
        if (result.notionDatabaseId) notionDatabaseIdInput.value = result.notionDatabaseId;
    });

    // Save settings
    saveSettingsBtn.addEventListener('click', function() {
        const settings = {
            geminiApiKey: geminiApiKeyInput.value,
            notionApiKey: notionApiKeyInput.value,
            notionDatabaseId: notionDatabaseIdInput.value
        };

        chrome.storage.local.set(settings, function() {
            // Notify the popup that settings have been updated
            chrome.runtime.sendMessage({ action: 'settingsUpdated' });
            window.close();
        });
    });

    // Close settings window
    closeSettingsBtn.addEventListener('click', function() {
        window.close();
    });
}); 