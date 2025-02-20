// app/actions/backgroundProcessor.js
import { getUserLogInTime, getUserLogOutTime, getUserCredentials, getObjectFromTemporaryStorage, getObjectFromLocalStorage } from './common.js';

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
let keepAliveInterval;

// Constants for time intervals
const TEN_MINUTES_MS = 600000;
const ONE_MINUTE_MS = 60000;

// Helper to clear all intervals
function clearAllIntervals() {
    if (loginProcessInterval) clearInterval(loginProcessInterval);
    if (logOutProcessInterval) clearInterval(logOutProcessInterval);
    if (keepAliveInterval) clearInterval(keepAliveInterval);
}

async function createNetTabAndLoginOrLogOut(signal) {
    const tab = await chrome.tabs.create({
        url: 'https://advtsoftware.greythr.com/',
        active: true,
    });
    greyThrTabId = tab.id;
    setSignalForFGP = signal;
};

function keepAlive() {
    keepAliveInterval = setInterval(chrome.runtime.getPlatformInfo, 20e3);
}

function startKeepAlive() {
    keepAlive();
    chrome.runtime.onSuspend.addListener(() => {
        clearInterval(keepAliveInterval);
        chrome.runtime.onMessage.removeListener(handleMessage);
    });
}

chrome.runtime.onStartup.addListener(startKeepAlive);

// Message handler
const handleMessage = async (request, sender, sendResponse) => {
    if (request.message === reset) {
        // Clear the existing logout timeout
        const { logoutTimeoutId } = await chrome.storage.session.get('logoutTimeoutId');
        if (logoutTimeoutId) {
            clearTimeout(logoutTimeoutId);
        }
        lastSignalFromFGP = reset;
        await bootstrap();
    } else if (request.message === loggedInText) {
        lastSignalFromFGP = loggedInText;
        chrome.tabs.remove(sender.tab.id);
        handleLogin();
    } else if (request.message === loggedOutText) {
        lastSignalFromFGP = loggedOutText;
        chrome.tabs.remove(sender.tab.id);
        handleLogout()
    } else if (request.message === "close the tab") {
        chrome.tabs.remove(sender.tab.id);
    }
};

chrome.runtime.onMessage.addListener(handleMessage);

chrome.tabs.onUpdated.addListener((tabId, updateInfo, tab) => {
    if (tabId === greyThrTabId) {
        if (updateInfo.status === 'complete' && tab.url === 'https://advtsoftware.greythr.com/v3/portal/ess/home') {
            chrome.scripting.executeScript({
                target: { tabId: greyThrTabId },
                files: ['./app/actions/foregroundProcessor.js'],
            }, () => {
                chrome.tabs.sendMessage(greyThrTabId, { message: setSignalForFGP });
            });
        } else if (updateInfo.status === 'complete' && tab.url.startsWith('https://advtsoftware.greythr.com/uas/portal/auth/login')) {
            chrome.scripting.executeScript({
                target: { tabId: greyThrTabId },
                files: ['./app/actions/foregroundProcessor.js'],
            }, () => { });
        }
    }
});

// Function to send notifications
function sendNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: '/app/styles/icons/48.png', // Path to your extension's icon
        title: title,
        message: message,
        priority: 2 // High priority
    });
}

// Notification handlers
async function handleLogin() { sendNotification('Login Successful', 'You have been logged in successfully.'); }
async function handleLogout() { sendNotification('Logout Successful', 'You have been logged out successfully.'); }
async function handleSessionExtension(extensionTime) {
    sendNotification('Session Extended', `Your session has been extended by ${extensionTime} minutes.`);
}

// Bootstrap logic split into smaller functions
async function setupUserCredentials() {
    const user = await getUserCredentials();
    if (user.id === undefined || user.password === undefined) {
        chrome.runtime.openOptionsPage();
        return false;
    }
    return true;
}

async function checkHolidayOrWeekend(timeNow) {
    const holidays = await getObjectFromLocalStorage('holidays') || [];
    const today = timeNow.toISOString().split('T')[0];
    if (holidays.includes(today) || timeNow.getDay() === 6 || timeNow.getDay() === 0) {
        sendNotification('Holiday/Weekend', 'Today is a holiday or weekend. No login/logout will occur.');
        return true;
    }
    return false;
}

async function scheduleLogin(userLogInTime, timeNow) {
    if (userLogInTime.getTime() > timeNow.getTime()) {
        setTimeout(() => initiateLogInProcess(), userLogInTime.getTime() - timeNow.getTime());
    } else {
        initiateLogInProcess();
    }
}

async function scheduleLogout(userLogOutTime, timeNow) {
    const notifyTime = new Date(userLogOutTime.getTime() - TEN_MINUTES_MS);
    if (notifyTime > timeNow) {
        setTimeout(() => promptForExtension(userLogOutTime), notifyTime.getTime() - timeNow.getTime());
    }
    let logoutTimeout = setTimeout(() => initiateLogOutProcess(), userLogOutTime.getTime() - timeNow.getTime());
    await chrome.storage.session.set({ logoutTimeoutId: logoutTimeout });
}

async function bootstrap() {
    clearAllIntervals();

    if (!(await setupUserCredentials())) return;

    const timeNow = new Date();
    if (await checkHolidayOrWeekend(timeNow)) return;

    const userLogInTime = await getUserLogInTime();
    const userLogOutTime = await getUserLogOutTime();
    const lastSignalSavedFromFGP = await getObjectFromTemporaryStorage('lastSignalFromFGP');

    if (lastSignalSavedFromFGP === undefined) {
        await scheduleLogin(userLogInTime, timeNow);
    }

    if (lastSignalSavedFromFGP === undefined || lastSignalSavedFromFGP === loggedInText) {
        await scheduleLogout(userLogOutTime, timeNow);
    }
}

// Prompt for session extension
async function promptForExtension(userLogOutTime) {
    const response = await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/app/styles/icons/48.png',
        title: 'Logout Reminder',
        message: 'You will be logged out in 10 minutes. Do you want to extend your session?',
        buttons: [
            { title: 'Extend by 30 minutes' },
            { title: 'Extend by 1 hour' }
        ],
        priority: 2
    });

    chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
        if (notificationId === response) {
            let extensionTime = buttonIndex === 0 ? 30 : 60; // 30 minutes or 1 hour

            const newLogOutTime = new Date(userLogOutTime.getTime() + extensionTime * 60000);
            // await chrome.storage.sync.set({ 'logOutTime': newLogOutTime.toTimeString().split(' ')[0] });

            const { logoutTimeoutId } = await chrome.storage.session.get('logoutTimeoutId');
            if (logoutTimeoutId) {
                clearTimeout(logoutTimeoutId);
            }

            const newLogoutTimeout = setTimeout(() => initiateLogOutProcess(), newLogOutTime.getTime() - Date.now());
            await chrome.storage.session.set({ logoutTimeoutId: newLogoutTimeout });

            handleSessionExtension(extensionTime);
            chrome.notifications.clear(response);
        }
    });
}

async function initiateLogInProcess() {
    clearInterval(loginProcessInterval);
    loginProcessInterval = setInterval(async () => {
        console.log("loginTryCount", loginTryCount);
        console.log("lastSignalFromFGP", lastSignalFromFGP);
        if (loginTryCount === maxLoginOrLogOutTry || lastSignalFromFGP?.trim() === loggedInText) {
            clearInterval(loginProcessInterval);
            loginTryCount = 0;
        } else {
            loginTryCount++;
            createNetTabAndLoginOrLogOut(signIn);
        }
    }, ONE_MINUTE_MS);
};

async function initiateLogOutProcess() {
    clearInterval(logOutProcessInterval);
    logOutProcessInterval = setInterval(async () => {
        if (logOutTryCount === maxLoginOrLogOutTry || lastSignalFromFGP?.trim() === loggedOutText) {
            clearInterval(logOutProcessInterval);
            logOutTryCount = 0;
        } else {
            logOutTryCount++;
            createNetTabAndLoginOrLogOut(signOut);
        }
    }, ONE_MINUTE_MS);
};

async function sendMessageToActiveTab(message) {
    const [tab] = await chrome.tabs.query({ active: true });
    const response = await chrome.tabs.sendMessage(tab.id, message);
    console.log("I'm up and running", response);
};

async function defaultSettings() {
    await chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
    });
    startKeepAlive();
};

defaultSettings();
bootstrap();