
async function init() {

    let loginTime = await getObjectFromLocalStorage('logInTime');
    loginTime = loginTime === undefined ? "09:00" : loginTime;

    const logInTimeInHours = Number.parseInt(loginTime.split(':')[0]);
    const logInTimeInMinutes = Number.parseInt(loginTime.split(':')[1]);

    let logOutTime = await getObjectFromLocalStorage('logOutTime');
    logOutTime = logOutTime === undefined ? "18:00" : logOutTime;

    const logOutTimeInHours = Number.parseInt(logOutTime.split(':')[0]);
    const logOutTimeInMinutes = Number.parseInt(logOutTime.split(':')[1]);

    const hours = new Date().getHours();
    const minutes = new Date().getMinutes()

    const loggedIn = await getObjectFromLocalStorage('loggedIn');
    const loggedOut = await getObjectFromLocalStorage('loggedOut');

    const popupTitle = "greytHR";

    if ((loggedIn === undefined || !loggedIn) && (hours >= logInTimeInHours && minutes >= logInTimeInMinutes) && (hours < logOutTimeInHours)) {
        chrome.tabs.create("")

        // const confirmMsg = 'Did you logged in to greytHR attendance?.';
        // Swal.fire({
        //     title: popupTitle,
        //     text: confirmMsg,
        //     showDenyButton: true,
        //     showCancelButton: true,
        //     confirmButtonText: 'No, let me login',
        //     denyButtonText: 'I have already logged in',
        // }).then((result) => {
        //     /* Read more about isConfirmed, isDenied below */
        //     if (result.isConfirmed) {
        //         Swal.fire(popupTitle, 'Redirecting you to the greytHR', 'success');
        //         // chrome.tabs.create({ url: "https://mri.greythr.com/v3/portal/ess/home" });
        //         window.open("https://mri.greythr.com/v3/portal/ess/home", '_blank').focus();
        //     } else if (result.isDenied) {
        //         chrome.storage.sync.set({ loggedIn: true, loggedOut: false }, () => {
        //             console.log("SET", { loggedIn: true, loggedOut: false });
        //             Swal.fire(popupTitle, 'Superb, You are the employee of the year', 'info')
        //         });
        //     } else if (result.isDismissed) {
        //         Swal.fire(popupTitle, 'Please login asap', 'info');
        //     }
        // });
        // window.open("https://mri.greythr.com/v3/portal/ess/home", '_blank').focus();
    } else if ((loggedOut === undefined || !loggedOut) && (hours >= logOutTimeInHours && minutes >= logOutTimeInMinutes)) {
        // const confirmMsg = `Did you logged out from mri grey HR attendance?.`;
        // Swal.fire({
        //     title: popupTitle,
        //     text: confirmMsg,
        //     showDenyButton: true,
        //     showCancelButton: true,
        //     confirmButtonText: 'No, let me logout',
        //     denyButtonText: 'I have already logged out',
        // }).then((result) => {
        //     /* Read more about isConfirmed, isDenied below */
        //     if (result.isConfirmed) {
        //         Swal.fire(popupTitle, 'Redirecting you to the greytHR', 'success');
        //         // chrome.tabs.create({ url: "https://mri.greythr.com/v3/portal/ess/home" });
        //         window.open("https://mri.greythr.com/v3/portal/ess/home", '_blank').focus();
        //     } else if (result.isDenied) {
        //         chrome.storage.sync.set({ loggedIn: false, loggedOut: true }, () => {
        //             console.log("SET", { loggedIn: false, loggedOut: true });
        //             Swal.fire(popupTitle, 'Superb, You are the employee of the year', 'info')
        //         });
        //     } else if (result.isDismissed) {
        //         Swal.fire(popupTitle, 'Please logout asap', 'info');
        //     }
        // });
        // window.open("https://mri.greythr.com/v3/portal/ess/home", '_blank').focus();
    } else {
        console.log(`${popupTitle} login notification by Rajeev.`);
    };
};

/**
 * Retrieve active popup
 */
getActivePopUp = async () => {
    return new Promise((resolve, reject) => {
        try {
            const gtPopupModal = document.getElementsByTagName('gt-popup-modal');
            let activePopUp = undefined;
            for (let i = 0; i < gtPopupModal.length; i++) {
                if (gtPopupModal[i].hasAttribute('open')) {
                    activePopUp = gtPopupModal[i];
                    break;
                }
            }
            resolve(activePopUp);
        } catch (ex) {
            reject(ex);
        }
    });
}

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

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log(request);
    const isloggedIn = await getObjectFromLocalStorage('loggedIn');
    const isloggedOut = await getObjectFromLocalStorage('loggedOut');
    if (request.message === "login") {
        // alert(request.message);
        // const huha = await getObjectFromLocalStorage('huha');
        // const hahu = await getObjectFromLocalStorage('hahu');
        // const btn = document.getElementsByTagName('form')[0].getElementsByTagName("button")[0];
        // const event = new Event('input', { bubbles: true });
        // document.getElementById('username').value = huha;
        // document.getElementById('username').dispatchEvent(event);
        // document.getElementById('password').value = hahu;
        // document.getElementById('password').dispatchEvent(event);
        // btn.click();
        chrome.runtime.sendMessage({ message: "create" });
        // sendResponse({ message: "create" });
        // chrome.tabs.create({
        //     url: 'https://developer.chrome.com/docs/extensions/reference/tabs/'
        // });
    } else if (request.message === "doMagic") {

        const shadowBtn = document.getElementsByClassName("gt-widget-wrapper bg-white rounded-m border-secondary-200 hover:shadow-lg ng-star-inserted")[1].getElementsByTagName("gt-button")[0];
        if (shadowBtn.shadowRoot.childNodes[0].innerText === "Sign Out" && !isloggedOut) {
            shadowBtn.click();
        } else if (shadowBtn.shadowRoot.childNodes[0].innerText === "Sign In" && isloggedOut) {
            shadowBtn.click();
        }
    }
    // alert(request.message);
})
// chrome.runtime.onInstalled.addListener(function (details) {
//     chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//         console.log(request.message);
//         console.log(sender);
//     });
// });

init();