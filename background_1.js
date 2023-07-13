let greyThrTabId = 0;
const maxLoginOrLogOutTry = 3;
let loginTryCount = 0;
let logOutTryCount = 0;
let loginProcessInterval = undefined;
let logOutProcessInterval = undefined;
let loginScheduler = undefined;
let logOutScheduler = undefined;
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

createNetTabAndLoginOrLogOut = async () => {
    const tab = await chrome.tabs.create({
        url: 'https://mri.greythr.com/',
        active: false,
    });
    greyThrTabId = tab.id;
    // setTimeout(() => {
    //     chrome.scripting.executeScript(
    //         {
    //             target: { tabId: greyThrTabId },
    //             files: ['./foreground_1.js'],
    //         },
    //         () => { console.log("Don't worry, The middle man is here...") });
    // }, 20000);
};

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    // console.log(request);
    if (request.message === "reset") {
        await bootstrap();
    } else if (request.message === "close the tab") {
        chrome.tabs.remove(sender.tab.id);
    }
});

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

chrome.tabs.onUpdated.addListener((tabId, updateInfo, tab) => {
    if (tabId === greyThrTabId) {
        // console.log(tabId, updateInfo, tab);
        if (updateInfo.status === 'complete' && tab.url === 'https://mri.greythr.com/v3/portal/ess/home') {
            chrome.scripting.executeScript(
                {
                    target: { tabId: greyThrTabId },
                    files: ['./foreground_1.js'],
                },
                () => { console.log("Don't worry, The middle man is here...") });
        } else if (updateInfo.status === 'complete' && tab.url.startsWith('https://mri.greythr.com/uas/portal/auth/login')) {
            chrome.scripting.executeScript(
                {
                    target: { tabId: greyThrTabId },
                    files: ['./foreground_1.js'],
                },
                () => { console.log("Don't worry, The middle man is here...") });
        }
    }
});

async function bootstrap() {
    console.log("Initialized");
    let isUserLoggedIn = await getObjectFromLocalStorage('loggedIn');
    let isUserLoggedOut = await getObjectFromLocalStorage('loggedOut');
    const lastUpdated = await getObjectFromLocalStorage('lastUpdated');
    console.log('isUserLoggedIn', isUserLoggedIn);
    console.log('lastUpdated', lastUpdated);
    const timeNow = new Date();
    if (lastUpdated === undefined || new Date(lastUpdated).getDay() < timeNow.getDay()) {
        isUserLoggedIn = false;
    }
    const userLogInTime = await getUserLogInTime();
    const userLogOutTime = await getUserLogOutTime();

    if (isUserLoggedIn === undefined || isUserLoggedIn === false) {

        if (loginScheduler) {
            clearTimeout(loginScheduler);
        }

        if (userLogInTime.getTime() > timeNow.getTime()) {
            loginScheduler = setTimeout(() => {
                initiateLogInProcess();
            }, userLogInTime.getTime() - timeNow.getTime());
        } else {
            createNetTabAndLoginOrLogOut();
            initiateLogInProcess();
        }
    } else {
        if (logOutScheduler) {
            clearTimeout(logOutScheduler);
        }

        if (userLogOutTime.getTime() > timeNow.getTime()) {
            logOutScheduler = setTimeout(() => {
                initiateLogOutProcess();
            }, userLogOutTime.getTime() - timeNow.getTime());
        } else {
            createNetTabAndLoginOrLogOut();
            initiateLogOutProcess();
        }
    }
};

initiateLogInProcess = async () => {
    if (loginProcessInterval) {
        clearInterval(loginProcessInterval);
    }

    loginProcessInterval = setInterval(async () => {
        const isUserLoggedIn = await getObjectFromLocalStorage('loggedIn');
        const lastUpdated = await getObjectFromLocalStorage('lastUpdated');
        const timeNow = new Date();
        if (loginTryCount === 3 || (isUserLoggedIn === true && lastUpdated !== undefined
            && new Date(lastUpdated).getTime() >= timeNow.getTime())) {
            clearInterval(loginProcessInterval);
            loginTryCount = 0;
        } else {
            loginTryCount++;
            // create new tab and login
            createNetTabAndLoginOrLogOut();
        }
    }, 60000);
};

initiateLogOutProcess = async () => {
    if (logOutProcessInterval) {
        clearInterval(logOutProcessInterval);
    }

    logOutProcessInterval = setInterval(async () => {
        const isUserLoggedIn = await getObjectFromLocalStorage('loggedIn');
        if (logOutTryCount === 3 || isUserLoggedIn === false) {
            clearInterval(logOutProcessInterval);
            logOutTryCount = 0;

        } else {
            logOutTryCount++;
            // create new tab and login
            createNetTabAndLoginOrLogOut();
        }
    }, 60000);
};

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



