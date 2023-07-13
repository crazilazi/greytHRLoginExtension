let active_tab_id = 0;

chrome.tabs.onActivated.addListener(tab => {
    chrome.tabs.get(tab.tabId, current_tab_info => {
        active_tab_id = tab.tabId;
        chrome.scripting.executeScript(
            {
                target: { tabId: active_tab_id },
                files: ['./sweetalert2.all.min.js', './foreground.js'],
            },
            () => { console.log("I'm sweet.") });

        chrome.scripting.insertCSS(
            {
                target: { tabId: active_tab_id },
                files: ["./sweetalert2.min.css"]
            },
            () => { console.log("I'm salty.") });

        if (/^https:\/.mri.greythr.com\/uas\/portal\/auth\/login/.test(current_tab_info.url)) {

            chrome.tabs.sendMessage(active_tab_id, { message: 'login' });
        } else if (/^https:\/.mri.greythr.com\/v3\/portal\/ess\/home/.test(current_tab_info.url)) {

            chrome.tabs.sendMessage(active_tab_id, { message: 'doMagic' });
        }
        // if (/^https:\/.mri.greythr.com/.test(current_tab_info.url)) {

        //     chrome.tabs.sendMessage(active_tab_id, { message: 'login' });
        //     // chrome.scripting.executeScript(
        //     //     {
        //     //         target: { tabId: active_tab_id },
        //     //         files: ['./greytHR-notification.js'],
        //     //     },
        //     //     () => { console.log("I'm going to login asap.") });
        // }

    });
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log(request);
    if (request.message === "create") {
        setTimeout(function () {
            chrome.tabs.create({
                url: 'https://developer.chrome.com/docs/extensions/reference/tabs/',
                active: false
            });
        }, 500);
    }
});

chrome.webNavigation.onCompleted.addListener(function (details) {
    if (details.frameId !== 0) return; // Only process top-frame requests
    const tabId = details.tabId;
    chrome.tabs.get(tabId, current_tab_info => {
        console.log('I fire when navigation finish', current_tab_info);
    });
});

/**
 * Retrieve object from Chrome's Local StorageArea
 * @param {string} key 
 */
getObjectFromLocalStorage = async function (key) {
    return new Promise((resolve, reject) => {
        try {
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
saveObjectInLocalStorage = async function (obj) {
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
removeObjectFromLocalStorage = async function (keys) {
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