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

    // Save holidays when the user clicks "Save"
    const btnSave = document.getElementById('btnSave');
    btnSave.addEventListener('click', async () => {
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

        await saveObjectInLocalStorage({ logInTime, logOutTime, huha, hahu, holidays });
        log('Saved user settings to local storage', 'info');

        chrome.runtime.sendMessage({ action: 'reset' }, (response) => {
            if (chrome.runtime.lastError) {
                log(`Error sending message: ${chrome.runtime.lastError.message}`, 'error');
            } else {
                log('Message sent successfully', 'info');
            }
        });
        alert("Your log in and log out time is set.");
    });
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
    const result = await getObjectFromLocalStorage(['logInTime', 'logOutTime', 'huha', 'hahu', 'holidays']);
    log('Retrieved user settings from local storage', 'debug');
    console.log('result', result);
    if (result.logInTime) document.getElementById('loginTime').value = result.logInTime;
    if (result.logOutTime) document.getElementById('logOutTime').value = result.logOutTime;
    if (result.huha) document.getElementById('huha').value = result.huha;
    if (result.hahu) document.getElementById('hahu').value = result.hahu;
    if (result.holidays) {
        document.getElementById('holidays').value = result.holidays.join(', ');
        fpHolidays.setDate(result.holidays);
    }
})();