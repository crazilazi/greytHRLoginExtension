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

async function createNetTabAndLoginOrLogOut(signal) {
    const tab = await chrome.tabs.create({
        url: 'https://advtsoftware.greythr.com/',
        active: true,
    });
    greyThrTabId = tab.id;
    setSignalForFGP = signal;
};

const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
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
    } else if (request.message === loggedOutText) {
        lastSignalFromFGP = loggedOutText;
        chrome.tabs.remove(sender.tab.id);
    } else if (request.message === "close the tab") {
        chrome.tabs.remove(sender.tab.id);
    }
});

chrome.tabs.onUpdated.addListener((tabId, updateInfo, tab) => {
    if (tabId === greyThrTabId) {
        if (updateInfo.status === 'complete' && tab.url === 'https://advtsoftware.greythr.com/v3/portal/ess/home') {
            chrome.scripting.executeScript(
                {
                    target: { tabId: greyThrTabId },
                    files: ['./app/actions/foregroundProcessor.js'],
                },
                () => {
                    chrome.tabs.sendMessage(greyThrTabId, { message: setSignalForFGP });
                });
        } else if (updateInfo.status === 'complete' && tab.url.startsWith('https://advtsoftware.greythr.com/uas/portal/auth/login')) {
            chrome.scripting.executeScript(
                {
                    target: { tabId: greyThrTabId },
                    files: ['./app/actions/foregroundProcessor.js'],
                },
                () => { });
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

// Example: Notify user when login is successful
async function handleLogin() {
    sendNotification('Login Successful', 'You have been logged in successfully.');
}

// Example: Notify user when logout is successful
async function handleLogout() {
    sendNotification('Logout Successful', 'You have been logged out successfully.');
}

// Example: Notify user when session is extended
async function handleSessionExtension(extensionTime) {
    sendNotification('Session Extended', `Your session has been extended by ${extensionTime} minutes.`);
}

// Example: Notify user 10 minutes before logout
async function notifyBeforeLogout() {
    sendNotification('Logout Reminder', 'You will be logged out in 10 minutes.');
}

// Modify the bootstrap function to include notifications
async function bootstrap() {
    const user = await getUserCredentials();
    const lastSignalSavedFromFGP = await getObjectFromTemporaryStorage('lastSignalFromFGP');
    if (user.id === undefined || user.password === undefined) {
        chrome.runtime.openOptionsPage();
        return;
    }
    const timeNow = new Date();
    const holidays = await getObjectFromLocalStorage('holidays') || [];
    const today = timeNow.toISOString().split('T')[0];

    // Check if today is a holiday or weekend
    if (holidays.includes(today) || timeNow.getDay() === 6 || timeNow.getDay() === 0) {
        sendNotification('Holiday/Weekend', 'Today is a holiday or weekend. No login/logout will occur.');
        return;
    }

    const userLogInTime = await getUserLogInTime();
    const userLogOutTime = await getUserLogOutTime();

    if (lastSignalSavedFromFGP === undefined) {
        if (userLogInTime.getTime() > timeNow.getTime()) {
            setTimeout(() => initiateLogInProcess(), userLogInTime.getTime() - timeNow.getTime());
        } else {
            createNetTabAndLoginOrLogOut(signIn);
            handleLogin(); // Notify user about login
        }
    }

    if (lastSignalSavedFromFGP === undefined || lastSignalSavedFromFGP === loggedInText) {
        if (userLogOutTime.getTime() > timeNow.getTime()) {
            const notifyTime = new Date(userLogOutTime.getTime() - 600000); // Notify 10 minutes before
            if (notifyTime > timeNow) {
                setTimeout(() => promptForExtension(userLogOutTime), notifyTime.getTime() - timeNow.getTime());
            }

            // Schedule the initial logout process
            let logoutTimeout = setTimeout(() => initiateLogOutProcess(), userLogOutTime.getTime() - timeNow.getTime());

            // Store the timeout ID so it can be cleared later
            chrome.storage.session.set({ logoutTimeoutId: logoutTimeout });
        } else {
            setTimeout(() => {
                createNetTabAndLoginOrLogOut(signOut);
                handleLogout(); // Notify user about logout
            }, 20000);
        }
    }
}

// Example: Notify user when session is extended
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
            let extensionTime = 0;
            if (buttonIndex === 0) {
                extensionTime = 30; // 30 minutes
            } else if (buttonIndex === 1) {
                extensionTime = 60; // 1 hour
            }

            if (extensionTime > 0) {
                // Calculate the new logout time
                const newLogOutTime = new Date(userLogOutTime.getTime() + extensionTime * 60 * 1000);

                // Save the new logout time in Chrome's storage
                await chrome.storage.sync.set({ 'logOutTime': newLogOutTime.toTimeString().split(' ')[0] });

                // Clear the existing logout timeout
                const { logoutTimeoutId } = await chrome.storage.session.get('logoutTimeoutId');
                if (logoutTimeoutId) {
                    clearTimeout(logoutTimeoutId);
                }

                // Schedule a new logout process
                const timeNow = new Date();
                const newLogoutTimeout = setTimeout(() => initiateLogOutProcess(), newLogOutTime.getTime() - timeNow.getTime());

                // Save the new timeout ID
                await chrome.storage.session.set({ logoutTimeoutId: newLogoutTimeout });

                // Notify the user about the session extension
                handleSessionExtension(extensionTime);

                // Clear the notification
                chrome.notifications.clear(response);
            }
        }
    });
}

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
