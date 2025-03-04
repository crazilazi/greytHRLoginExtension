// app/app.js
(async () => {
    const src = chrome.runtime.getURL("/app/actions/common.js");
    const { getUserCredentials, getObjectFromLocalStorage, saveObjectInLocalStorage } = await import(src);
    // Initialize Flatpickr for holidays
    const fpHolidays = flatpickr(document.querySelector('#holidays'), {
        mode: 'multiple', // Allow multiple date selections
        dateFormat: 'Y-m-d', // Format as YYYY-MM-DD
        defaultDate: [], // No default dates
        inline: true, // Show calendar inline
        onChange: function (selectedDates, dateStr, instance) {
            console.log('Selected holidays:', dateStr);
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
            // Format the date manually to avoid timezone issues
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        });

        await saveObjectInLocalStorage({ 'logInTime': logInTime, 'logOutTime': logOutTime, 'hahu': hahu, 'huha': huha, 'holidays': holidays });
        console.log("Setting logIn and logOut time.", { 'logInTime': logInTime, 'logOutTime': logOutTime });
        chrome.runtime.sendMessage({ action: 'reset' });
        alert("Your log in and log out time is set.");
    });

    // Load saved holidays when the page loads
    const { holidays } = await getObjectFromLocalStorage(['holidays'])
    fpHolidays.setDate(holidays);

    const result = await getObjectFromLocalStorage(['logInTime', 'logOutTime', 'huha', 'hahu', 'holidays']);

    if (result.logInTime) document.getElementById('loginTime').value = result.logInTime;
    if (result.logOutTime) document.getElementById('logOutTime').value = result.logOutTime;
    if (result.huha) document.getElementById('huha').value = result.huha;
    if (result.hahu) document.getElementById('hahu').value = result.hahu;
    if (result.holidays) document.getElementById('holidays').value = result.holidays.join(', ');

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
})();