// app/actions/backgroundProcessor.js
import {
    getUserLogInTime,
    getUserLogOutTime,
    getUserCredentials,
    getObjectFromLocalStorage,
    saveObjectInLocalStorage,
    removeObjectFromLocalStorage,
    isNonWorkingDay
} from './common.js';

// Read MAIN_URL from manifest.json
const MAIN_URL = chrome.runtime.getManifest().config.main_url;

// Constants
const MAX_ATTEMPTS = 3;
const TEN_MINUTES_MS = 600000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// State
let greyThrTabId = 0;
let loginAttempts = 0;
let logoutAttempts = 0;
let lastSignalFromFGP = null;

// Signal constants
const SIGNALS = {
    LOGGED_IN: 'logged in',
    LOGGED_OUT: 'logged out',
    SIGN_IN: 'sign in',
    SIGN_OUT: 'sign out',
    RESET: 'reset'
};

// Notification helper
const notify = (title, message, buttons = []) => chrome.notifications.create({
    type: 'basic',
    iconUrl: '/app/styles/icons/48.png',
    title,
    message,
    buttons,
    priority: 2
});

// Create tab and send signal
const createTab = async (signal) => {
    const tab = await chrome.tabs.create({ url: MAIN_URL, active: true });
    greyThrTabId = tab.id;
    return signal;
};

// Handle messages from foreground
const handleMessage = async (request, sender) => {
    const { message, action } = request;
    if (action === SIGNALS.RESET) {
        lastSignalFromFGP = SIGNALS.RESET;
        await scheduleDay();
    } else if (action === SIGNALS.LOGGED_IN || action === SIGNALS.LOGGED_OUT) {
        lastSignalFromFGP = action;
        notify(`${action === SIGNALS.LOGGED_IN ? 'Login' : 'Logout'} Successful`, `You have been ${action} successfully.`);
        chrome.tabs.remove(sender.tab.id);
    } else if (action === 'close the tab') {
        notify('Error', message);
        console.error(action, message);
        chrome.tabs.remove(sender.tab.id);
    }
};

// Inject foreground script when tab loads
chrome.tabs.onUpdated.addListener((tabId, { status }, tab) => {
    if (tabId !== greyThrTabId || status !== 'complete') return;
    const url = tab.url;
    if (url === `${MAIN_URL}v3/portal/ess/home`) {
        chrome.scripting.executeScript({
            target: { tabId },
            files: ['./app/actions/foregroundProcessor.js']
        }).then(() => chrome.tabs.sendMessage(tabId, { action: SIGNALS.SIGN_IN }));
    } else if (url.startsWith(`${MAIN_URL}uas/portal/auth/login`)) {
        chrome.scripting.executeScript({
            target: { tabId },
            files: ['./app/actions/foregroundProcessor.js']
        }).then(() => chrome.tabs.sendMessage(tabId, { action: SIGNALS.SIGN_IN }));
    }
});


// Retry logic for login/logout
const attemptAction = async (signal, attempts, successSignal) => {
    if (attempts >= MAX_ATTEMPTS || lastSignalFromFGP === successSignal) {
        if (signal === SIGNALS.SIGN_OUT && successSignal === lastSignalFromFGP) {
            scheduleNextDay(); // Schedule next day only after successful logout
        }
        return;
    }
    attempts++;
    await createTab(signal);
};

// Schedule login/logout for a specific day
const scheduleDay = async (baseDate = new Date()) => {
    if (!(await getUserCredentials()).id) {
        chrome.runtime.openOptionsPage();
        return;
    }

    const today = new Date(baseDate.toDateString());
    if (await isNonWorkingDay(today)) {
        notify('Holiday/Weekend', 'No login/logout today.');
        await saveObjectInLocalStorage({ lastSignalFromFGP: SIGNALS.RESET });
        return;
    }

    const loginTime = await getUserLogInTime();
    const logoutTime = await getUserLogOutTime();
    const loginDateTime = new Date(today.getTime() + loginTime.getTime() - loginTime.setHours(0, 0, 0, 0));
    const logoutDateTime = new Date(today.getTime() + logoutTime.getTime() - logoutTime.setHours(0, 0, 0, 0));

    // Schedule login alarm
    if (lastSignalFromFGP !== SIGNALS.LOGGED_IN) {
        chrome.alarms.create('login', { when: loginDateTime.getTime() });
    }

    // Schedule logout alarm
    if (lastSignalFromFGP !== SIGNALS.LOGGED_OUT) {
        chrome.alarms.create('logout', { when: logoutDateTime.getTime() });
        chrome.alarms.create('notify', { when: logoutDateTime.getTime() - TEN_MINUTES_MS });
    }
};

// Schedule next day after successful logout
const scheduleNextDay = () => {
    const tomorrow = new Date(Date.now() + ONE_DAY_MS);
    scheduleDay(tomorrow);
};

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'login') {
        loginAttempts = await attemptAction(SIGNALS.SIGN_IN, loginAttempts, SIGNALS.LOGGED_IN);
    } else if (alarm.name === 'logout') {
        logoutAttempts = await attemptAction(SIGNALS.SIGN_OUT, logoutAttempts, SIGNALS.LOGGED_OUT);
    } else if (alarm.name === 'notify') {
        const logoutTime = await getUserLogOutTime();
        promptExtension(new Date(logoutTime));
    }
});

// Prompt for session extension
const promptExtension = async (userLogOutTime) => {
    const id = await notify('Logout Reminder', 'Logout in 10 minutes. Extend session?', [
        { title: 'Extend by 30 minutes' },
        { title: 'Extend by 1 hour' }
    ]);

    chrome.notifications.onButtonClicked.addListener(async (notifyId, btnIdx) => {
        if (notifyId !== id) return;
        const extensionMs = (btnIdx === 0 ? 30 : 60) * 60000;
        const newLogOutTime = new Date(userLogOutTime.getTime() + extensionMs);
        chrome.alarms.create('logout', { when: newLogOutTime.getTime() });
        notify('Session Extended', `Extended by ${extensionMs / 60000} minutes.`);
        chrome.notifications.clear(id);
    });
};

// Initialization
const INITIALIZED_KEY = 'isInitialized';

const init = async () => {
    // Check if already initialized
    const storedInitializedKey = await getObjectFromLocalStorage(INITIALIZED_KEY);
    console.log(storedInitializedKey);
    if (storedInitializedKey) {
        console.log('Extension already initialized.');
        return;
    }

    // Perform initialization
    try {
        await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
        lastSignalFromFGP = await getObjectFromLocalStorage("lastSignalFromFGP");
        console.log('Background script loaded.', lastSignalFromFGP);
        chrome.runtime.onMessage.addListener(handleMessage);
        await scheduleDay();
        // Mark as initialized
        await saveObjectInLocalStorage({ INITIALIZED_KEY: true });
    } catch (ex) {
        console.error('Initialization failed.', ex);
    }
};

// Clear flag on extension install/update or browser startup
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install' || details.reason === 'update') {
        await removeObjectFromLocalStorage(INITIALIZED_KEY);
        console.log('Extension installed/updated. Initialization flag cleared.');
    }
});

chrome.runtime.onStartup.addListener(async () => {
    await removeObjectFromLocalStorage(INITIALIZED_KEY);
    console.log('Browser started. Initialization flag cleared.');
});

init();