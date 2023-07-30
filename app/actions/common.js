/**
 * Retrieve object from Chrome's Local StorageArea
 * @param {string} key 
 */
export async function getObjectFromLocalStorage(key) {
    return new Promise((resolve, reject) => {
        try {
            // console.log('key', key);
            // console.log('chrome.storage', chrome.storage);
            chrome.storage.sync.get(key, function (value) {
                resolve(value[key]);
            });
        } catch (ex) {
            reject(ex);
        }
    });
};

/**
 * Save Object in Chrome's Local StorageArea
 * @param {*} obj 
 */
export async function saveObjectInLocalStorage(obj) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.sync.set(obj, function () {
                resolve();
            });
        } catch (ex) {
            reject(ex);
        }
    });
};

/**
 * Removes Object from Chrome Local StorageArea.
 *
 * @param {string or array of string keys} keys
 */
export async function removeObjectFromLocalStorage(keys) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.sync.remove(keys, function () {
                resolve();
            });
        } catch (ex) {
            reject(ex);
        }
    });
};

/**
 * Get user login time from Chrome's Local StorageArea
 * @returns {Date}
 */
export async function getUserLogInTime() {
    let logTime = await getObjectFromLocalStorage('logInTime');
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
    let logOutTime = await getObjectFromLocalStorage('logOutTime');
    logOutTime = logOutTime === undefined ? "18:00" : logOutTime;
    const logOutTimeInHours = Number.parseInt(logOutTime.split(':')[0]);
    const logOutTimeInMinutes = Number.parseInt(logOutTime.split(':')[1]);
    return new Date(new Date().setHours(logOutTimeInHours, logOutTimeInMinutes, 0, 0));
};