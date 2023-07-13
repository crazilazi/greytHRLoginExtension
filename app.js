const btnSave = document.getElementById('btnSave');
btnSave.addEventListener('click', () => {
    const logInTime = document.getElementById('loginTime').value;
    const logOutTime = document.getElementById('logOutTime').value;
    const huha = document.getElementById('huha').value;
    const hahu = document.getElementById('hahu').value;

    chrome.storage.sync.set({ 'logInTime': logInTime, 'logOutTime': logOutTime, 'hahu': hahu, 'huha': huha }, () => {
        console.log("Setting logIn and logOut time.", { 'logInTime': logInTime, 'logOutTime': logOutTime });
        chrome.runtime.sendMessage({ message: 'reset' });
        alert("Your log in and log out time is set.")
    });
})

const btnReset = document.getElementById('btnReset');
btnReset.addEventListener('click', () => {
    chrome.storage.sync.remove(['logInTime', 'logOutTime', 'loggedIn', 'loggedOut', 'hahu', 'huha'], () => {
        console.log('removed', ['loginTime', 'logOutTime', 'loggedIn', 'loggedOut']);
        document.getElementById('loginTime').value = "09:00";
        document.getElementById('logOutTime').value = "18:00";
        document.getElementById('hahu').value = "";
        document.getElementById('huha').value = "";
        alert("You are free to fly.")
    });
})

chrome.storage.sync.get(['logInTime'], (result) => {
    console.log("GET", result);
    if (Object.keys(result).length !== 0) {
        document.getElementById('loginTime').value = result.logInTime;
    }
});

chrome.storage.sync.get(['logOutTime'], (result) => {
    console.log("GET", result);
    if (Object.keys(result).length !== 0) {
        document.getElementById('logOutTime').value = result.logOutTime;
    }
});

chrome.storage.sync.get(['huha'], (result) => {
    console.log("GET", result);
    if (Object.keys(result).length !== 0) {
        document.getElementById('huha').value = result.huha;
    }
});

chrome.storage.sync.get(['hahu'], (result) => {
    console.log("GET", result);
    if (Object.keys(result).length !== 0) {
        document.getElementById('hahu').value = result.hahu;
    }
});

const fpLogIn = flatpickr(document.querySelector('#loginTime'), {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    defaultDate: "09:00",
    onChange: function (selectedDates, dateStr, instance) {
        console.log('date: ', dateStr);
    }
});

const fpLogOut = flatpickr(document.querySelector('#logOutTime'), {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    defaultDate: "18:00",
    onChange: function (selectedDates, dateStr, instance) {
        console.log('date: ', dateStr);
    }
});


