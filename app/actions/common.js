/**
 * Retrieve object from Chrome's Local StorageArea
 * @param {string} key 
 */
export async function getObjectFromLocalStorage(key) {
    return await chrome.storage.local.get(key);
};

/**
 * Save Object in Chrome's Local StorageArea
 * @param {*} obj 
 */
export async function saveObjectInLocalStorage(obj) {
    await chrome.storage.local.set(obj);
};

/**
 * Get information from Chrome's Temporary Storage
 * @param {string} key 
 */
export async function getObjectFromTemporaryStorage(key) {
    return chrome.storage.session.get(key);
};

/**
 * Save Object in Chrome's Temporary Storage
 * @param {*} obj 
 */
export async function saveObjectInTemporaryStorage(obj) {
    return await chrome.storage.session.set(obj);
};

/**
 * Removes Object from Chrome Local StorageArea.
 *
 * @param {string or array of string keys} keys
 */
export async function removeObjectFromLocalStorage(keys) {
    return await chrome.storage.sync.remove(keys);
};

/**
 * Get user login time from Chrome's Local StorageArea
 * @returns {Date}
 */
export async function getUserLogInTime() {
    let { logTime } = await getObjectFromLocalStorage('logInTime');
    logTime = logTime === undefined ? "09:00" : logTime;
    const logInTimeInHours = Number.parseInt(logTime.split(':')[0]);
    const logInTimeInMinutes = Number.parseInt(logTime.split(':')[1]);
    return new Date(new Date().setHours(logInTimeInHours, logInTimeInMinutes, 0, 0));
};

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
};

/** Get current user's is and password from Chrome's Local StorageArea
 * @returns {object}
 */
export async function getUserCredentials() {
    const { huha, hahu } = await getObjectFromLocalStorage(['huha', 'hahu']);
    // const value = await getObjectFromLocalStorage(['huha', 'hahu']);
    return { id: huha, password: hahu };
}

// Check if today is a holiday or weekend
export async function isNonWorkingDay(date) {
    const { holidays } = (await getObjectFromLocalStorage('holidays')) || [];
    const today = date.toString().split('T')[0];
    return holidays.includes(today) || date.getDay() === 0 || date.getDay() === 6;
};