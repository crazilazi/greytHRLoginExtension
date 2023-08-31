import { getUserLogInTime, getUserLogOutTime, getUserCredentials, getObjectFromTemporaryStorage } from './common.js';

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
const reset = 'reset';
let lastSignalFromFGP = undefined;
let setSignalForFGP = undefined;

async function createNetTabAndLoginOrLogOut(signal) {
    const tab = await chrome.tabs.create({
        url: 'https://mri.greythr.com/',
        active: true,
    });
    greyThrTabId = tab.id;
    // set signal for foreground processor
    setSignalForFGP = signal;
};

const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log(request);
    if (request.message === reset) {
        lastSignalFromFGP = reset;
        await bootstrap();
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
    const user = await getUserCredentials();
    const lastSignalSavedFromFGP = await getObjectFromTemporaryStorage('lastSignalFromFGP');
    console.log("last signal saved from FGP", lastSignalSavedFromFGP);
    if (user.id === undefined || user.password === undefined) {
        chrome.runtime.openOptionsPage();
        return;
    }
    const timeNow = new Date();

    if (timeNow.getDay() === 6 || timeNow.getDay() === 0) {
        console.log('Working on weekend is not good for your health.');
        return;
    }

    const userLogInTime = await getUserLogInTime();
    const userLogOutTime = await getUserLogOutTime();

    // if (timeNow.getTime() > userLogOutTime.getTime() && lastSignalFromFGP !== reset) {
    //     console.log('Your log out time is expired.');
    //     return;
    // }

    if (lastSignalSavedFromFGP === undefined) {

        if (userLogInTime.getTime() > timeNow.getTime()) {
            console.log(`login scheduled at ${new Date(userLogInTime.getTime())}`);
            setTimeout(() => {
                initiateLogInProcess();
            }, userLogInTime.getTime() - timeNow.getTime());
        } else {
            console.log("login now");
            createNetTabAndLoginOrLogOut(signIn);
        }
    }

    if (lastSignalSavedFromFGP === undefined || lastSignalSavedFromFGP === loggedInText) {

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
    }
};

async function initiateLogInProcess() {
    if (loginProcessInterval) {
        clearInterval(loginProcessInterval);
    }

    loginProcessInterval = setInterval(async () => {
        if (loginTryCount === maxLoginOrLogOutTry || lastSignalFromFGP?.trim() === loggedInText) {
            clearInterval(loginProcessInterval);
            loginTryCount = 0;
        } else {
            loginTryCount++;
            // create new tab and login
            createNetTabAndLoginOrLogOut(signIn);
        }
    }, 60000);
};

async function initiateLogOutProcess() {
    if (logOutProcessInterval) {
        clearInterval(logOutProcessInterval);
    }

    logOutProcessInterval = setInterval(async () => {
        if (logOutTryCount === maxLoginOrLogOutTry || lastSignalFromFGP?.trim() === loggedOutText) {
            clearInterval(logOutProcessInterval);
            logOutTryCount = 0;

        } else {
            logOutTryCount++;
            // create new tab and login
            createNetTabAndLoginOrLogOut(signOut);
        }
    }, 60000);
};

async function sendMessageToActiveTab(message) {
    let queryOptions = { active: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    const [tab] = await chrome.tabs.query(queryOptions);
    const response = await chrome.tabs.sendMessage(tab.id, message);
    console.log("I'm up and running", response);
};

async function defaultSettings() {
    await chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
    })
    keepAlive();
};

defaultSettings();
bootstrap();
