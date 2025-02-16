// app/actions/backgroundProcessor.js
import { getUserLogInTime, getUserLogOutTime, getUserCredentials, getObjectFromTemporaryStorage, getObjectFromLocalStorage } from './common.js';

// Read MAIN_URL from manifest.json
const MAIN_URL = chrome.runtime.getManifest().config.main_url;

// Constants
const MAX_ATTEMPTS = 3;
const ONE_MINUTE_MS = 60000;
const TEN_MINUTES_MS = 600000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// State
let greyThrTabId = 0;
let loginAttempts = 0;
let logoutAttempts = 0;
let lastSignalFromFGP = null;
let intervals = { retry: null };
let timeouts = { login: null, logout: null, notify: null };

// Signal constants
const SIGNALS = {
    LOGGED_IN: 'logged in',
    LOGGED_OUT: 'logged out',
    SIGN_IN: 'sign in',
    SIGN_OUT: 'sign out',
    RESET: 'reset'
};

// Utility to clear resources
const clearResources = () => {
    if (intervals.retry) clearInterval(intervals.retry);
    Object.values(timeouts).forEach(clearTimeout);
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
const createTab = async signal => {
    const tab = await chrome.tabs.create({ url: MAIN_URL, active: true });
    greyThrTabId = tab.id;
    return signal;
};

// Handle messages from foreground
const handleMessage = async (request, sender) => {
    const { message, action } = request;
    if (action === SIGNALS.RESET) {
        lastSignalFromFGP = null;
        await bootstrap();
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
        });
    }
});

// Check if today is a holiday or weekend
const isNonWorkingDay = async date => {
    const holidays = (await getObjectFromLocalStorage('holidays')) || [];
    const today = date.toISOString().split('T')[0];
    return holidays.includes(today) || date.getDay() === 0 || date.getDay() === 6;
};

// Retry logic for login/logout
const attemptAction = async (signal, attempts, successSignal) => {
    clearResources();
    intervals.retry = setInterval(async () => {
        if (attempts >= MAX_ATTEMPTS || lastSignalFromFGP === successSignal) {
            clearInterval(intervals.retry);
            attempts = 0;
            if (signal === SIGNALS.SIGN_OUT && successSignal === lastSignalFromFGP) {
                scheduleNextDay(); // Schedule next day only after successful logout
            }
        } else {
            attempts++;
            await createTab(signal);
        }
    }, ONE_MINUTE_MS);
    return attempts;
};

// Schedule login/logout for a specific day
const scheduleDay = async (baseDate = new Date()) => {
    clearResources();
    const loginTime = await getUserLogInTime();
    const logoutTime = await getUserLogOutTime();
    const today = new Date(baseDate.toDateString());
    const loginDateTime = new Date(today.getTime() + loginTime.getTime() - loginTime.setHours(0, 0, 0, 0));
    const logoutDateTime = new Date(today.getTime() + logoutTime.getTime() - logoutTime.setHours(0, 0, 0, 0));
    const now = Date.now();

    if (await isNonWorkingDay(today)) {
        notify('Holiday/Weekend', 'No login/logout today.');
        return;
    }

    // if (loginDateTime > now && (!lastSignalFromFGP || lastSignalFromFGP !== SIGNALS.LOGGED_IN)) {
    //     timeouts.login = setTimeout(() => {
    //         loginAttempts = attemptAction(SIGNALS.SIGN_IN, loginAttempts, SIGNALS.LOGGED_IN);
    //     }, loginDateTime - now);
    // }
    if (!lastSignalFromFGP || lastSignalFromFGP !== SIGNALS.LOGGED_IN) {
        timeouts.login = setTimeout(() => {
            loginAttempts = attemptAction(SIGNALS.SIGN_IN, loginAttempts, SIGNALS.LOGGED_IN);
        }, loginDateTime - now);
    }

    if (logoutDateTime > now && (!lastSignalFromFGP || lastSignalFromFGP === SIGNALS.LOGGED_IN)) {
        timeouts.logout = setTimeout(() => {
            logoutAttempts = attemptAction(SIGNALS.SIGN_OUT, logoutAttempts, SIGNALS.LOGGED_OUT);
        }, logoutDateTime - now);
        timeouts.notify = setTimeout(() => promptExtension(logoutDateTime), Math.max(logoutDateTime - now - TEN_MINUTES_MS, 0));
    }
};

// Schedule next day after successful logout
const scheduleNextDay = () => {
    const tomorrow = new Date(Date.now() + ONE_DAY_MS);
    scheduleDay(tomorrow);
};

// Prompt for session extension
const promptExtension = async userLogOutTime => {
    const id = await notify('Logout Reminder', 'Logout in 10 minutes. Extend session?', [
        { title: 'Extend by 30 minutes' },
        { title: 'Extend by 1 hour' }
    ]);

    chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
        if (notifId !== id) return;
        const extensionMs = (btnIdx === 0 ? 30 : 60) * 60000;
        const newLogOutTime = new Date(userLogOutTime.getTime() + extensionMs);
        clearResources();
        timeouts.logout = setTimeout(() => {
            logoutAttempts = attemptAction(SIGNALS.SIGN_OUT, logoutAttempts, SIGNALS.LOGGED_OUT);
        }, newLogOutTime - Date.now());
        notify('Session Extended', `Extended by ${extensionMs / 60000} minutes.`);
        chrome.notifications.clear(id);
    });
};

// Core logic
const bootstrap = async () => {
    if (!(await getUserCredentials()).id) {
        chrome.runtime.openOptionsPage();
        return;
    }
    scheduleDay(); // Schedule current day
};

// Periodic check for new day (low frequency)
const startDailyCheck = () => {
    setInterval(async () => {
        const now = new Date();
        const lastRun = new Date(await getObjectFromTemporaryStorage('lastScheduled') || 0);
        if (now.toDateString() !== lastRun.toDateString()) {
            await scheduleDay();
            await chrome.storage.session.set({ lastScheduled: now.toISOString() });
        }
    }, ONE_HOUR_MS); // Check hourly to minimize memory usage
};

// Initialization
const init = async () => {
    await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    chrome.runtime.onStartup.addListener(bootstrap);
    chrome.runtime.onMessage.addListener(handleMessage);
    startDailyCheck();
    bootstrap();
};

init();