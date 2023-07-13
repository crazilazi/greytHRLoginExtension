const signOut = 'sign out';
const signIn = 'sign in';
/**
 * Retrieve object from Chrome's Local StorageArea
 * @param {string} key 
 */
getObjectFromLocalStorage = async function (key) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.sync.get(key, function (value) {
                resolve(value[key]);
            });
        } catch (ex) {
            reject(ex);
        }
    });
};

/**
 * Save Object in Chrome's Local StorageArea
 * @param {*} obj 
 */
saveObjectInLocalStorage = async function (obj) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.sync.set(obj, function () {
                resolve();
            });
        } catch (ex) {
            reject(ex);
        }
    });
};

/**
 * Removes Object from Chrome Local StorageArea.
 *
 * @param {string or array of string keys} keys
 */
removeObjectFromLocalStorage = async function (keys) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.sync.remove(keys, function () {
                resolve();
            });
        } catch (ex) {
            reject(ex);
        }
    });
};

bootstrap = async () => {
    const todayDate = new Date();
    if (todayDate.getDay() === 6 || todayDate.getDay() === 0) {
        console.log('Working on weekend is not good for your health.');
        //return;
    }

    console.log('**********************What the hack**********************');
    const tabLogInPathname = "/uas/portal/auth/login";
    const tabTitoPathName = "/v3/portal/ess/home";

    if (window.location.pathname === tabLogInPathname) {
        doLoginCheck();

    } else if (window.location.pathname === tabTitoPathName) {
        doSignInAndSignOutInAppCheck();
    }
};

doLoginCheck = async () => {
    const doLoginInterVal = setInterval(async () => {
        let loginBtn = undefined;
        try {
            loginBtn = document.getElementsByTagName('form')[0].getElementsByTagName("button")[0];
        } catch (error) {
            console.error(error);
        }
        console.log('Im still looking for login button...');
        if (loginBtn !== undefined) {
            console.log('Finally i have login button', loginBtn);
            clearInterval(doLoginInterVal);
            await doLoginToGreyThr();
        }
    }, 1000);
};

const doSignInAndSignOutInAppCheck = async () => {
    const doSignInAndSignOutInAppInterval = setInterval(async () => {
        let signInAndSignOutBtn = undefined;
        try {
            signInAndSignOutBtn = document.getElementsByClassName("gt-widget-wrapper bg-white rounded-m border-secondary-200 hover:shadow-lg ng-star-inserted")[2].getElementsByTagName("gt-button")[0];
        } catch (error) {
            console.error(error);
        }
        console.log('Im still looking for signIn and SignOut button...');
        if (signInAndSignOutBtn !== undefined && signInAndSignOutBtn.shadowRoot && signInAndSignOutBtn.shadowRoot.childNodes[0]) {
            console.log('Finally i have signIn and SignOut button', signInAndSignOutBtn);
            clearInterval(doSignInAndSignOutInAppInterval);
            await doSignInAndSignOutInApp();
        }
    }, 1000);
};

doLoginToGreyThr = async () => {
    console.log('Im at login page');
    const userId = await getObjectFromLocalStorage('huha');
    const password = await getObjectFromLocalStorage('hahu');
    let loginBtn = undefined;
    try {
        loginBtn = document.getElementsByTagName('form')[0].getElementsByTagName("button")[0];
    } catch (error) {
        console.error(error);
    }
    console.log('Im still looking for login button...');
    if (loginBtn === undefined) {
        doLoginCheck();
        return;
    }
    const event = new Event('input', { bubbles: true });
    document.getElementById('username').value = userId;
    document.getElementById('username').dispatchEvent(event);
    document.getElementById('password').value = password;
    document.getElementById('password').dispatchEvent(event);
    console.log('**********************Login to greytHR**********************');
    loginBtn.click();
};

doSignInAndSignOutInApp = async () => {
    let signInAndSignOutBtn = undefined;
    try {
        signInAndSignOutBtn = document.getElementsByClassName("gt-widget-wrapper bg-white rounded-m border-secondary-200 hover:shadow-lg ng-star-inserted")[2].getElementsByTagName("gt-button")[0];
    } catch (error) {
        console.error(error);
    }
    console.log('Im still looking for signIn and SignOut button...');
    if (signInAndSignOutBtn === undefined) {
        doSignInAndSignOutInAppCheck();
        return;
    }

    console.log('Im in app');

    let isUserLoggedIn = await getObjectFromLocalStorage('loggedIn');
    isUserLoggedIn = isUserLoggedIn === undefined ? false : isUserLoggedIn;
    console.log(`User is ${isUserLoggedIn ? 'logged in' : 'Not logged in'}`);

    const userLogInTime = await getUserLogInTime();
    const userLogOutTime = await getUserLogOutTime();
    const timeNow = new Date();
    if (signInAndSignOutBtn.shadowRoot.childNodes[0].innerText.trim().toLowerCase() === signOut) {
        if (!isUserLoggedIn && timeNow.getTime() < userLogOutTime.getTime()) {
            await saveObjectInLocalStorage({ 'loggedIn': true, 'loggedOut': false, 'lastUpdated': Date.now() });
            chrome.runtime.sendMessage({ message: "close the tab" });
        } else if (!isUserLoggedIn && userLogOutTime.getTime() >= timeNow.getTime()) {
            console.log('Signing Out');
            signInAndSignOutBtn.click();
            await saveObjectInLocalStorage({ 'loggedOut': true, 'loggedIn': false, 'lastUpdated': Date.now() });
            chrome.runtime.sendMessage({ message: "close the tab" });
        }
        else if (userLogOutTime.getTime() <= timeNow.getTime()) {
            console.log('Signing Out');
            signInAndSignOutBtn.click();
            await saveObjectInLocalStorage({ 'loggedOut': true, 'loggedIn': false, 'lastUpdated': Date.now() });
            chrome.runtime.sendMessage({ message: "close the tab" });
        } else {
            chrome.runtime.sendMessage({ message: "close the tab" });
        }
    } else if (signInAndSignOutBtn.shadowRoot.childNodes[0].innerText.trim().toLowerCase() === signIn) {
        if (userLogInTime.getTime() <= timeNow.getTime() && userLogOutTime.getTime() <= timeNow.getTime()) {
            console.log('Signing In');
            signInAndSignOutBtn.click();
            chrome.runtime.sendMessage({ message: "close the tab" });
            await saveObjectInLocalStorage({ 'loggedIn': true, 'loggedOut': false, 'lastUpdated': Date.now() });
        } else {
            chrome.runtime.sendMessage({ message: "close the tab" });
        }
    }
}

getUserLogInTime = async () => {
    let logTime = await getObjectFromLocalStorage('logInTime');
    console.log(logTime);
    logTime = logTime === undefined ? "09:00" : logTime;
    const logInTimeInHours = Number.parseInt(logTime.split(':')[0]);
    const logInTimeInMinutes = Number.parseInt(logTime.split(':')[1]);
    return new Date(new Date().setHours(logInTimeInHours, logInTimeInMinutes, 0, 0));
}

getUserLogOutTime = async () => {
    let logOutTime = await getObjectFromLocalStorage('logOutTime');
    console.log(logOutTime);
    logOutTime = logOutTime === undefined ? "18:00" : logOutTime;
    const logOutTimeInHours = Number.parseInt(logOutTime.split(':')[0]);
    const logOutTimeInMinutes = Number.parseInt(logOutTime.split(':')[1]);
    return new Date(new Date().setHours(logOutTimeInHours, logOutTimeInMinutes, 0, 0));
}

bootstrap();