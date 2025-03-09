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
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// State
let greyThrTabId = 0;
let loginAttempts = 0;
let logoutAttempts = 0;
let lastSignalFromFGP = null;
let currentSignal = null;
let loadListenerMap = new Map();
let timeoutMap = new Map(); // Map to store timeout IDs per tabId for cleanup

// Signal constants
const SIGNALS = Object.freeze({
    LOGGED_IN: 'logged in',
    LOGGED_OUT: 'logged out',
    SIGN_IN: 'sign in',
    SIGN_OUT: 'sign out',
    RESET: 'reset'
});

const constants = Object.freeze({
    Login: 'Login',
    Logout: 'Logout',
    Notify: 'Notify'
});

// Centralized error handler
const handleError = (message, level = 'error', notifyUser = false) => {
    log(message, level);
    // if (notifyUser) {
    //     chrome.notifications.create({
    //         type: 'basic',
    //         iconUrl: '/app/styles/icons/48.png',
    //         title: level.charAt(0).toUpperCase() + level.slice(1),
    //         message,
    //         priority: 1
    //     });
    // }
};

// Notification helper
const notify = (title, message, buttons = []) => {
    return chrome.notifications.create({
        type: 'basic',
        iconUrl: '/app/styles/icons/48.png',
        title,
        message,
        buttons,
        priority: 2
    });
};

// Create tab and send signal
const createTab = async (signal) => {
    try {
        const tab = await chrome.tabs.create({
            url: MAIN_URL,
            active: false,
            selected: false
        });
        greyThrTabId = tab.id;
        currentSignal = signal;
        log(`Tab created with ID: ${tab.id} for signal: ${signal}`);

        const loadListener = (tabId, changeInfo) => {
            if (tabId === greyThrTabId && changeInfo.status === 'complete') {
                injectForegroundScript(tabId, currentSignal);
            }
        };

        chrome.tabs.onUpdated.addListener(loadListener);
        loadListenerMap.set(greyThrTabId, loadListener);
        return signal;
    } catch (error) {
        handleError(`Failed to create tab: ${error.message}`, 'error', true);
        throw error;
    }
};

// Handle messages from foreground
const handleMessage = async (message, action, sender) => {
    const currentTabId = sender?.tab?.id;
    log(`Message received: ${message}, action: ${action}, currentTabId: ${currentTabId}`);
    try {
        if (action === SIGNALS.RESET) {
            lastSignalFromFGP = SIGNALS.RESET;
            await scheduleDay();
        } else if (action === SIGNALS.LOGGED_IN || action === SIGNALS.LOGGED_OUT) {
            lastSignalFromFGP = action;
            notify(`${action === SIGNALS.LOGGED_IN ? 'Login' : 'Logout'} Successful`, `You have been ${action} successfully.`);
            await chrome.tabs.remove(currentTabId);
            log(`${action} successful. Tab closed.`);
            cleanupTabResources(currentTabId);
        } else if (action === 'close the tab') {
            notify('Error', message);
            handleError(`Error: ${message}`, 'error', true);
            await chrome.tabs.remove(currentTabId);
            cleanupTabResources(currentTabId);
        }
    } catch (error) {
        handleError(`Failed to handle message: ${error.message}`, 'error', true);
    }
    currentSignal = null;
    if (currentTabId === greyThrTabId) greyThrTabId = 0;
};

// Cleanup resources associated with a tab
const cleanupTabResources = (tabId) => {
    // Remove onUpdated listener
    const listener = loadListenerMap.get(tabId);
    if (listener) {
        chrome.tabs.onUpdated.removeListener(listener);
        loadListenerMap.delete(tabId);
        log(`Removed onUpdated listener for tab: ${tabId}`);
    }

    // Clear any pending timeouts
    const timeouts = timeoutMap.get(tabId);
    if (timeouts) {
        timeouts.forEach(timeoutId => clearTimeout(timeoutId));
        timeoutMap.delete(tabId);
        log(`Cleared timeouts for tab: ${tabId}`);
    }
};

// Ensure foreground script injection
const injectForegroundScript = async (tabId, signal) => {
    log(`Injecting script for tab: ${tabId} signal: ${signal}`);
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['./app/actions/foregroundProcessor.js']
        });

        const timeoutId = setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: signal }, (response) => {
                if (chrome.runtime.lastError) {
                    handleError(`Error sending message: ${chrome.runtime.lastError.message}`, 'error');
                } else {
                    log('Message sent successfully', 'info');
                }
            });
            log(`Script injected successfully for signal: ${signal}`);
            const activateTimeoutId = setTimeout(() => {
                chrome.tabs.update(tabId, { active: true });
                log(`Updated tab: ${tabId} to active mode`);
            }, 10000);

            // Store the activateTimeoutId in timeoutMap
            const currentTimeouts = timeoutMap.get(tabId) || [];
            currentTimeouts.push(activateTimeoutId);
            timeoutMap.set(tabId, currentTimeouts);
        }, 1000);

        // Store the timeoutId in timeoutMap
        const currentTimeouts = timeoutMap.get(tabId) || [];
        currentTimeouts.push(timeoutId);
        timeoutMap.set(tabId, currentTimeouts);
    } catch (error) {
        handleError(`Script injection failed: ${error.message}`, 'error', true);
    }
};

// Retry logic for login/logout
const attemptAction = async (signal, attempts, successSignal) => {
    if (attempts >= MAX_ATTEMPTS || lastSignalFromFGP === successSignal) {
        if (signal === SIGNALS.SIGN_OUT && successSignal === lastSignalFromFGP) {
            scheduleNextDay();
        }
        return attempts;
    }
    attempts++;
    await createTab(signal);
    return attempts;
};

// Schedule login/logout for a specific day
const scheduleDay = async (baseDate = new Date()) => {
    try {
        const credentials = await getUserCredentials();
        if (!credentials.id) {
            chrome.runtime.openOptionsPage();
            handleError('User credentials missing', 'warn', true);
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

        const now = Date.now();

        await chrome.alarms.clearAll();

        if (lastSignalFromFGP !== SIGNALS.LOGGED_IN && loginDateTime.getTime() > now) {
            chrome.alarms.create(constants.Login, { when: loginDateTime.getTime() });
            log(`Login scheduled for: ${loginDateTime.toString()}`);
        } else if (lastSignalFromFGP !== SIGNALS.LOGGED_IN) {
            chrome.alarms.create(constants.Login, { when: now + 5000 });
            log(`Login executed immediately.`);
        }

        if (lastSignalFromFGP !== SIGNALS.LOGGED_OUT && logoutDateTime.getTime() > now) {
            chrome.alarms.create(constants.Logout, { when: logoutDateTime.getTime() });
            chrome.alarms.create(constants.Notify, { when: logoutDateTime.getTime() - TEN_MINUTES_MS });
            log(`Logout scheduled for: ${logoutDateTime.toString()}`);
        } else if (lastSignalFromFGP !== SIGNALS.LOGGED_OUT) {
            chrome.alarms.create(constants.Logout, { when: now + 30000 });
            log(`Logout executed immediately.`);
        }
    } catch (error) {
        handleError(`Failed to schedule day: ${error.message}`, 'error', true);
    }
};

// Schedule next day after successful logout
const scheduleNextDay = () => {
    const tomorrow = new Date(Date.now() + ONE_DAY_MS);
    scheduleDay(tomorrow);
    log(`Next day scheduled for: ${tomorrow.toString()}`);
};

// Handle alarms
const handleAlarm = async (alarm) => {
    log(`Alarm triggered: ${alarm.name}`);
    try {
        if (alarm.name === constants.Login) {
            loginAttempts = await attemptAction(SIGNALS.SIGN_IN, loginAttempts, SIGNALS.LOGGED_IN);
        } else if (alarm.name === constants.Logout) {
            logoutAttempts = await attemptAction(SIGNALS.SIGN_OUT, logoutAttempts, SIGNALS.LOGGED_OUT);
        } else if (alarm.name === constants.Notify) {
            const logoutTime = await getUserLogOutTime();
            await promptExtension(new Date(logoutTime));
        }
    } catch (error) {
        handleError(`Failed to handle alarm ${alarm.name}: ${error.message}`, 'error', true);
    }
};

// Prompt for session extension
const promptExtension = async (userLogOutTime) => {
    try {
        const id = await notify('Logout Reminder', 'Logout in 10 minutes. Extend session?', [
            { title: 'Extend by 30 minutes' },
            { title: 'Extend by 1 hour' }
        ]);

        const buttonClickListener = (notifyId, btnIdx) => {
            if (notifyId !== id) return;
            const extensionMs = (btnIdx === 0 ? 30 : 60) * 60000;
            const newLogOutTime = new Date(userLogOutTime.getTime() + extensionMs);
            chrome.alarms.create(constants.Logout, { when: newLogOutTime.getTime() });
            notify('Session Extended', `Extended by ${extensionMs / 60000} minutes.`);
            chrome.notifications.clear(id);
            log(`Session extended by ${extensionMs / 60000} minutes.`);
            chrome.notifications.onButtonClicked.removeListener(buttonClickListener);
        };

        chrome.notifications.onButtonClicked.addListener(buttonClickListener);
    } catch (error) {
        handleError(`Failed to prompt extension: ${error.message}`, 'error', true);
    }
};

// Initialization
const INITIALIZED_KEY = 'isInitialized';

const init = async () => {
    try {
        const { [INITIALIZED_KEY]: isInitialized = false } = await getObjectFromLocalStorage(INITIALIZED_KEY);
        if (isInitialized) {
            log('Extension already initialized.');
            return;
        }

        await saveObjectInLocalStorage({ INITIALIZED_KEY: true });
        await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
        // const { lastSignalFromFGP: storedSignal } = await getObjectFromLocalStorage('lastSignalFromFGP');
        // lastSignalFromFGP = storedSignal || null;
        log('Background script loaded. Last signal: ' + lastSignalFromFGP);
        await scheduleDay();
    } catch (error) {
        handleError(`Initialization failed: ${error.message}`, 'error', true);
    }
};

// Event listeners
chrome.runtime.onStartup.addListener(async () => {
    log('Browser started, checking for missed alarms.');
    const alarms = await chrome.alarms.getAll();
    if (!alarms.length) {
        await scheduleDay();
    }
});

const messageListener = (packet, sender, sendResponse) => {
    const { message, action } = packet;
    log(`Received message from foreground: ${JSON.stringify(packet)}`);
    handleMessage(message, action, sender);
};
chrome.runtime.onMessage.addListener(messageListener);

chrome.alarms.onAlarm.addListener(handleAlarm);

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install' || details.reason === 'update') {
        await removeObjectFromLocalStorage(INITIALIZED_KEY);
        lastSignalFromFGP = SIGNALS.RESET;
        log('Extension installed/updated. Initialization flag cleared.');
        await init();
    }
});

chrome.management.onEnabled.addListener(async (info) => {
    if (info.id === chrome.runtime.id) {
        log('Extension enabled.');
        await removeObjectFromLocalStorage(INITIALIZED_KEY);
        lastSignalFromFGP = SIGNALS.RESET;
        log('Extension enabled. INITIALIZED_KEY cleared.');
        await init();
    }
});