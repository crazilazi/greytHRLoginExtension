(async () => {
    const src = chrome.runtime.getURL("/app/actions/common.js");
    const { log, getObjectFromLocalStorage, saveObjectInLocalStorage } = await import(src);

    log('App initialized', 'info');

    // Initialize Flatpickr for holidays
    const fpHolidays = flatpickr(document.querySelector('#holidays'), {
        mode: 'multiple',
        dateFormat: 'Y-m-d',
        defaultDate: [],
        inline: true,
        onChange: function (selectedDates, dateStr, instance) {
            log(`Selected holidays: ${dateStr}`, 'info');
        }
    });

    // Initialize Flatpickr for login/logout time
    const fpLogIn = flatpickr(document.querySelector('#loginTime'), {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        defaultDate: "09:00"
    });

    const fpLogOut = flatpickr(document.querySelector('#logOutTime'), {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        defaultDate: "18:00"
    });

    // Load saved settings
    const result = await getObjectFromLocalStorage([
        'logInTime', 'logOutTime', 'huha', 'hahu', 'holidays',
        'enableNotifications', 'enableLogging', 'autoLoginOnStartup',
        'enableSessionExtension', 'sessionExtensionTime'
    ]);
    log('Retrieved user settings from local storage', 'debug');

    if (result.logInTime) document.getElementById('loginTime').value = result.logInTime;
    if (result.logOutTime) document.getElementById('logOutTime').value = result.logOutTime;
    if (result.huha) document.getElementById('huha').value = result.huha;
    if (result.hahu) document.getElementById('hahu').value = result.hahu;
    if (result.holidays) {
        document.getElementById('holidays').value = result.holidays.join(', ');
        fpHolidays.setDate(result.holidays);
    }
    if (result.enableNotifications) document.getElementById('enableNotifications').checked = result.enableNotifications;
    if (result.enableLogging) document.getElementById('enableLogging').checked = result.enableLogging;
    if (result.autoLoginOnStartup) document.getElementById('autoLoginOnStartup').checked = result.autoLoginOnStartup;
    if (result.enableSessionExtension) document.getElementById('enableSessionExtension').checked = result.enableSessionExtension;
    if (result.sessionExtensionTime) document.getElementById('sessionExtensionTime').value = result.sessionExtensionTime;

    // Save settings
    document.getElementById('btnSave').addEventListener('click', async () => {
        const logInTime = document.getElementById('loginTime').value;
        const logOutTime = document.getElementById('logOutTime').value;
        const huha = document.getElementById('huha').value;
        const hahu = document.getElementById('hahu').value;
        const holidays = fpHolidays.selectedDates.map(date => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        });
        const enableNotifications = document.getElementById('enableNotifications').checked;
        const enableLogging = document.getElementById('enableLogging').checked;
        const autoLoginOnStartup = document.getElementById('autoLoginOnStartup').checked;
        const enableSessionExtension = document.getElementById('enableSessionExtension').checked;
        const sessionExtensionTime = document.getElementById('sessionExtensionTime').value;

        await saveObjectInLocalStorage({
            logInTime, logOutTime, huha, hahu, holidays,
            enableNotifications, enableLogging, autoLoginOnStartup,
            enableSessionExtension, sessionExtensionTime
        });
        log('Saved user settings to local storage', 'info');

        chrome.runtime.sendMessage({ action: 'reset' }, (response) => {
            if (chrome.runtime.lastError) {
                log(`Error sending message: ${chrome.runtime.lastError.message}`, 'error');
            } else {
                log('Message sent successfully', 'info');
            }
        });
        alert("Your settings have been saved.");
    });

    // Reset settings
    document.getElementById('btnReset').addEventListener('click', async () => {
        await chrome.storage.local.clear();
        log('Reset all settings', 'info');
        alert("Settings have been reset.");
        window.location.reload();
    });
})();