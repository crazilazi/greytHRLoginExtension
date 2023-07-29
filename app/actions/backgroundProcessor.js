let greyThrTabId = 0;
const maxLoginOrLogOutTry = 3;
let loginTryCount = 0;
let logOutTryCount = 0;
let loginProcessInterval = undefined;
let logOutProcessInterval = undefined;
const loggedInText = 'logged in';
const loggedOutText = 'logged out';
const signOut = 'sign out';
const signIn = 'sign in';
let lastSignalFromFGP = undefined;
let setSignalForFGP = undefined;


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

createNetTabAndLoginOrLogOut = async (signal) => {
    const tab = await chrome.tabs.create({
        url: 'https://mri.greythr.com/',
        active: true,
    });
    greyThrTabId = tab.id;
    // set signal for foreground processor
    setSignalForFGP = signal;
};

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    // console.log(request);
    if (request.message === "reset") {
        await bootstrap();
        lastSignalFromFGP = undefined;
    } else if (request.message === loggedInText) {
        lastSignalFromFGP = loggedInText;
        chrome.tabs.remove(sender.tab.id);
    } else if (request.message === loggedOutText) {
        lastSignalFromFGP = loggedOutText;
        chrome.tabs.remove(sender.tab.id);
    }
    else if (request.message === "close the tab") {
        chrome.tabs.remove(sender.tab.id);
    }
    console.log("last signal from FGP", lastSignalFromFGP);
});

chrome.tabs.onUpdated.addListener((tabId, updateInfo, tab) => {
    if (tabId === greyThrTabId) {
        // console.log(tabId, updateInfo, tab);
        if (updateInfo.status === 'complete' && tab.url === 'https://mri.greythr.com/v3/portal/ess/home') {
            chrome.scripting.executeScript(
                {
                    target: { tabId: greyThrTabId },
                    files: ['./app/actions/foregroundProcessor.js'],
                },
                () => {
                    console.log("Don't worry, The middle man is here...");
                    chrome.tabs.sendMessage(greyThrTabId, { message: setSignalForFGP });
                });
        } else if (updateInfo.status === 'complete' && tab.url.startsWith('https://mri.greythr.com/uas/portal/auth/login')) {
            chrome.scripting.executeScript(
                {
                    target: { tabId: greyThrTabId },
                    files: ['./app/actions/foregroundProcessor.js'],
                },
                () => {
                    console.log("Don't worry, The middle man is here...");
                });
        }
    }
});

async function bootstrap() {
    console.log("Initialized");
    const timeNow = new Date();
    const userLogInTime = await getUserLogInTime();
    const userLogOutTime = await getUserLogOutTime();
    if (userLogInTime.getTime() > timeNow.getTime()) {
        console.log(`login scheduled at ${new Date(userLogInTime.getTime())}`);
        setTimeout(() => {
            initiateLogInProcess();
        }, userLogInTime.getTime() - timeNow.getTime());
    } else {
        console.log("login now");
        createNetTabAndLoginOrLogOut(signIn);
    }

    if (userLogOutTime.getTime() > timeNow.getTime()) {
        console.log(`logout scheduled at ${new Date(userLogOutTime.getTime())}`);
        setTimeout(() => {
            initiateLogOutProcess();
        }, userLogOutTime.getTime() - timeNow.getTime());
    } else {
        console.log("logout after 20 seconds.");
        setTimeout(() => {
            createNetTabAndLoginOrLogOut(signOut);
        }, 20000);
    }
};

initiateLogInProcess = async () => {
    if (loginProcessInterval) {
        clearInterval(loginProcessInterval);
    }

    loginProcessInterval = setInterval(async () => {
        if (loginTryCount === 3 || lastSignalFromFGP?.trim() === loggedInText) {
            clearInterval(loginProcessInterval);
            loginTryCount = 0;
        } else {
            loginTryCount++;
            // create new tab and login
            createNetTabAndLoginOrLogOut(signIn);
        }
    }, 60000);
};

initiateLogOutProcess = async () => {
    if (logOutProcessInterval) {
        clearInterval(logOutProcessInterval);
    }

    logOutProcessInterval = setInterval(async () => {
        if (logOutTryCount === 3 || lastSignalFromFGP?.trim() === loggedOutText) {
            clearInterval(logOutProcessInterval);
            logOutTryCount = 0;

        } else {
            logOutTryCount++;
            // create new tab and login
            createNetTabAndLoginOrLogOut(signOut);
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
