// Logging helper (console-only)
const log = (message, level = 'info') => {
    const timestamp = new Date().toString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // Log to console
    switch (level) {
        case 'warn':
            console.warn(logEntry);
            break;
        case 'error':
            console.error(logEntry);
            break;
        case 'debug':
        case 'info':
        default:
            console.log(logEntry);
            break;
    }
};

/**
 * Retrieve object from Chrome's Local StorageArea
 * @param {string} key 
 */
export async function getObjectFromLocalStorage(key) {
    try {
        const result = await chrome.storage.local.get(key);
        log(`Retrieved data from local storage for key: ${key}`, 'debug');
        return result;
    } catch (error) {
        log(`Error retrieving data from local storage for key: ${key}`, 'error');
        return null;
    }
}

/**
 * Save Object in Chrome's Local StorageArea
 * @param {*} obj 
 */
export async function saveObjectInLocalStorage(obj) {
    try {
        await chrome.storage.local.set(obj);
        log('Data saved to local storage', 'debug');
    } catch (error) {
        log('Error saving data to local storage', 'error');
    }
}

/**
 * Get information from Chrome's Temporary Storage
 * @param {string} key 
 */
export async function getObjectFromTemporaryStorage(key) {
    try {
        const result = await chrome.storage.session.get(key);
        log(`Retrieved data from session storage for key: ${key}`, 'debug');
        return result;
    } catch (error) {
        log(`Error retrieving data from session storage for key: ${key}`, 'error');
        return null;
    }
}

/**
 * Save Object in Chrome's Temporary Storage
 * @param {*} obj 
 */
export async function saveObjectInTemporaryStorage(obj) {
    try {
        await chrome.storage.session.set(obj);
        log('Data saved to session storage', 'debug');
    } catch (error) {
        log('Error saving data to session storage', 'error');
    }
}

/**
 * Removes Object from Chrome Local StorageArea.
 * @param {string or array of string keys} keys
 */
export async function removeObjectFromLocalStorage(keys) {
    try {
        await chrome.storage.local.remove(keys);
        log(`Removed data from local storage for keys: ${keys}`, 'debug');
    } catch (error) {
        log(`Error removing data from local storage for keys: ${keys}`, 'error');
    }
}

/**
 * Get user login time from Chrome's Local StorageArea
 * @returns {Date}
 */
export async function getUserLogInTime() {
    let { logInTime } = await getObjectFromLocalStorage('logInTime');
    logInTime = logInTime === undefined ? "09:00" : logInTime;
    const logInTimeInHours = Number.parseInt(logInTime.split(':')[0]);
    const logInTimeInMinutes = Number.parseInt(logInTime.split(':')[1]);
    return new Date(new Date().setHours(logInTimeInHours, logInTimeInMinutes, 0, 0));
}

/**
 * Get user logout time from Chrome's Local StorageArea
 * @returns {Date}
 */
export async function getUserLogOutTime() {
    let { logOutTime } = await getObjectFromLocalStorage('logOutTime');
    logOutTime = logOutTime === undefined ? "18:00" : logOutTime;
    const logOutTimeInHours = Number.parseInt(logOutTime.split(':')[0]);
    const logOutTimeInMinutes = Number.parseInt(logOutTime.split(':')[1]);
    return new Date(new Date().setHours(logOutTimeInHours, logOutTimeInMinutes, 0, 0));
}

/** Get current user's id and password from Chrome's Local StorageArea
 * @returns {object}
 */
export async function getUserCredentials() {
    const { huha, hahu } = await getObjectFromLocalStorage(['huha', 'hahu']);
    log('Retrieved user credentials', 'debug');
    return { id: huha, password: hahu };
}

// Check if today is a holiday or weekend
export async function isNonWorkingDay(date) {
    const { holidays } = (await getObjectFromLocalStorage('holidays')) || { holidays: [] };
    const today = date.toString().split('T')[0];
    const isHoliday = holidays.includes(today) || date.getDay() === 0 || date.getDay() === 6;
    log(`Checked if today is a non-working day: ${isHoliday}`, 'debug');
    return isHoliday;
}

// Export the log function for use in other files
export { log };