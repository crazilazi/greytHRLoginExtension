// app/actions/backgroundProcessor.js
import {
    getUserLogInTime,
    getUserLogOutTime,
    getUserCredentials,
    getObjectFromLocalStorage,
    saveObjectInLocalStorage,
    removeObjectFromLocalStorage,
    isNonWorkingDay,
    log
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
let currentSignal = null; // Store the current signal

// Signal constants
const SIGNALS = {
    LOGGED_IN: 'logged in',
    LOGGED_OUT: 'logged out',
    SIGN_IN: 'sign in',
    SIGN_OUT: 'sign out',
    RESET: 'reset'
};

const constants = {
    Login: 'Login',
    Logout: 'Logout',
    Notify: 'Notify'
}

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
    const tab = await chrome.tabs.create({
        url: MAIN_URL,
        active: false,
        // Add this to ensure the tab is fully loaded before processing
        selected: false
    });
    greyThrTabId = tab.id;
    currentSignal = signal;
    log(`Tab created with ID: ${tab.id} for signal: ${signal}`);

    // Add a listener to ensure the tab is fully loaded
    const loadListener = (tabId, changeInfo, tab) => {
        if (tabId === greyThrTabId && changeInfo.status === 'complete') {
            injectForegroundScript(tabId, currentSignal);
        }
    };

    chrome.tabs.onUpdated.addListener(loadListener);

    return signal;
};

// Handle messages from foreground
const handleMessage = async (message, action, sender) => {
    const currentTabId = sender.tab.id;
    log(`Message received: ${message}, action: ${action}, currentTabId: ${currentTabId}`);
    if (action === SIGNALS.RESET) {
        lastSignalFromFGP = SIGNALS.RESET;
        await scheduleDay();
    } else if (action === SIGNALS.LOGGED_IN || action === SIGNALS.LOGGED_OUT) {
        lastSignalFromFGP = action;
        notify(`${action === SIGNALS.LOGGED_IN ? 'Login' : 'Logout'} Successful`, `You have been ${action} successfully.`);
        chrome.tabs.remove(currentTabId);
        log(`${action} successful. Tab closed.`);
    } else if (action === 'close the tab') {
        notify('Error', message);
        log(`Error: ${message}`, 'error');
        chrome.tabs.remove(currentTabId);
    }
};

// Ensure foreground script injection
const injectForegroundScript = (tabId, currentSignal) => {
    log(`Injecting script for tab: ${tabId} signal: ${currentSignal}`);
    chrome.scripting.executeScript({
        target: { tabId },
        files: ['./app/actions/foregroundProcessor.js'],

    }).then(() => {
        // Add a small delay before sending the message
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: currentSignal }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                } else {
                    console.log('Message sent successfully:', response);
                }
            });
            log(`Script injected successfully for signal: ${currentSignal}`);
            setTimeout(() => {
                chrome.tabs.update(tabId, { active: true });
                log(`updated tab: ${tabId} to active mode`);
            }, 10000);
        }, 1000);
    }).catch(error => {
        log(`Script injection failed: ${error}`, 'error');
    });
};

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

    const now = today.getTime();

    // Handle login
    if (lastSignalFromFGP !== SIGNALS.LOGGED_IN) {
        if (loginDateTime.getTime() > now) {
            // Schedule login for the future
            chrome.alarms.create(constants.Login, { when: loginDateTime.getTime() });
            log(`Login scheduled for: ${loginDateTime.toString()}`);
        } else {
            // Execute login immediately (with a small delay)
            chrome.alarms.create(constants.Login, { when: now + 5000 }); // 5-second delay
            log(`Login executed immediately.`);
        }
    }

    // Handle logout
    if (lastSignalFromFGP !== SIGNALS.LOGGED_OUT) {
        if (logoutDateTime.getTime() > now) {
            // Schedule logout for the future
            chrome.alarms.create(constants.Logout, { when: logoutDateTime.getTime() });
            chrome.alarms.create(constants.Notify, { when: logoutDateTime.getTime() - TEN_MINUTES_MS });
            log(`Logout scheduled for: ${logoutDateTime.toString()}`);
        } else {
            // Execute logout immediately (with a small delay)
            chrome.alarms.create(constants.Logout, { when: now + 30000 }); // 30-second delay
            log(`Logout executed immediately.`);
        }
    }
};

// Schedule next day after successful logout
const scheduleNextDay = () => {
    const tomorrow = new Date(Date.now() + ONE_DAY_MS);
    scheduleDay(tomorrow);
    log(`Next day scheduled for: ${tomorrow.toString()}`);
};

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    log(`Alarm triggered: ${alarm.name}`);

    if (alarm.name === constants.Login) {
        loginAttempts = await attemptAction(SIGNALS.SIGN_IN, loginAttempts, SIGNALS.LOGGED_IN);
    } else if (alarm.name === constants.Logout) {
        logoutAttempts = await attemptAction(SIGNALS.SIGN_OUT, logoutAttempts, SIGNALS.LOGGED_OUT);
    } else if (alarm.name === constants.Notify) {
        const logoutTime = await getUserLogOutTime();
        await promptExtension(new Date(logoutTime));
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
        log(`Session extended by ${extensionMs / 60000} minutes.`);
    });
};

// Initialization
const INITIALIZED_KEY = 'isInitialized';

const init = async () => {
    // Check if already initialized
    const { [INITIALIZED_KEY]: isInitialized = false } = await getObjectFromLocalStorage(INITIALIZED_KEY);
    if (isInitialized) {
        log('Extension already initialized.');
        return;
    }

    // Mark as initialized
    await saveObjectInLocalStorage({ INITIALIZED_KEY: true });

    // Perform initialization
    try {
        await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
        const { _lastSignalFromFGP } = await getObjectFromLocalStorage("lastSignalFromFGP");
        lastSignalFromFGP = _lastSignalFromFGP;
        log('Background script loaded. Last signal: ' + lastSignalFromFGP);
        await scheduleDay();
    } catch (ex) {
        log('Initialization failed: ' + ex.message, 'error');
    }
};

// // Handle storage changes
// chrome.storage.onChanged.addListener((changes, area) => {
//     console.log(changes, area);
//     if (area === 'local' && changes.message && changes.action) {
//         const { message, action, sender } = changes.message.newValue;
//         log(`Received message from storage: ${message}, action: ${action}`);
//         handleMessage(message, action, sender);
//     }
// });

chrome.runtime.onMessage.addListener((packet, sender, sendResponse) => {
    const { message, action } = packet;
    log(`Received message from foreground: ${JSON.stringify(packet)}`);
    handleMessage(message, action, sender);
});

// Clear flag on extension install/update or browser startup
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install' || details.reason === 'update') {
        await removeObjectFromLocalStorage(INITIALIZED_KEY);
        await init();
        log('Extension installed/updated. Initialization flag cleared.');
    }
});

// Clear INITIALIZED_KEY on enable/disable
chrome.management.onEnabled.addListener(async (info) => {
    if (info.id === chrome.runtime.id) {
        log('Extension enabled.');
        await removeObjectFromLocalStorage(INITIALIZED_KEY);
        await init();
        log('Extension enabled. INITIALIZED_KEY cleared.');
    }
});

chrome.runtime.onStartup.addListener(async () => {
    await removeObjectFromLocalStorage(INITIALIZED_KEY);
    await init();
    log('Browser started. Initialization flag cleared.');
});