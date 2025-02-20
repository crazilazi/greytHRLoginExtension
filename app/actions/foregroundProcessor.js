(async () => {
    const src = chrome.runtime.getURL("/app/actions/common.js");
    const common = await import(src);
    const signOut = 'sign out';
    const signIn = 'sign in';
    const loggedInText = 'logged in';
    const loggedOutText = 'logged out';
    let lastSignalFromBGP = undefined;

    // Array to store intervals for cleanup
    const intervals = [];
    const addInterval = (interval) => intervals.push(interval);
    const clearIntervals = () => intervals.forEach(clearInterval);

    // Cleanup intervals on page unload
    window.addEventListener('beforeunload', clearIntervals);

    // Message listener for background communication
    const messageListener = async (request, sender, sendResponse) => {
        if (request.message === signIn) {
            lastSignalFromBGP = signIn;
            console.log("last signal from BGP", lastSignalFromBGP);
        } else if (request.message === signOut) {
            lastSignalFromBGP = signOut;
            console.log("last signal from BGP", lastSignalFromBGP);
        }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Utility function to wait for an element to appear in the DOM
    const waitForElement = (selector, interval = 1000) => {
        return new Promise(resolve => {
            const checkExist = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(checkExist);
                    resolve(element);
                }
            }, interval);
            addInterval(checkExist);
        });
    };

    // Main bootstrap function
    const bootstrap = async () => {
        const todayDate = new Date();
        if (todayDate.getDay() === 6 || todayDate.getDay() === 0) {
            console.log('Working on weekend is not good for your health.');
            //return; // Commented out return for demonstration
        }

        console.log('**********************What the hack**********************');
        const tabLogInPathname = "/uas/portal/auth/login";
        const tabTitoPathName = "/v3/portal/ess/home";

        if (window.location.pathname === tabLogInPathname) {
            await doLoginCheck();
        } else if (window.location.pathname === tabTitoPathName) {
            await doSignInAndSignOutInAppCheck();
        }
    };

    // Check for login button
    const doLoginCheck = async () => {
        try {
            const loginBtn = await waitForElement('form button');
            console.log('Finally I have login button', loginBtn);
            await doLoginToGreyThr();
        } catch (error) {
            console.error('Error while checking for login:', error);
        }
    };

    // Check for signIn/SignOut button in the app
    const doSignInAndSignOutInAppCheck = async () => {
        try {
            const signInAndSignOutBtn = await waitForElement('.gt-widget-wrapper.bg-white.rounded-m.border-secondary-200.hover\\:shadow-lg.ng-star-inserted:nth-child(3) gt-button');
            console.log('Finally I have signIn and SignOut button', signInAndSignOutBtn);
            await doSignInAndSignOutInApp(signInAndSignOutBtn);
        } catch (error) {
            console.error('Error while checking for signIn/SignOut:', error);
        }
    };

    // Perform login action
    const doLoginToGreyThr = async () => {
        console.log('I am at login page');
        const user = await common.getUserCredentials();
        const { id: userId, password } = user;
        const loginBtn = document.querySelector('form button');

        if (!loginBtn) {
            console.log('Login button not found, retrying...');
            await doLoginCheck();
            return;
        }

        const event = new Event('input', { bubbles: true });
        document.getElementById('username').value = userId;
        document.getElementById('username').dispatchEvent(event);
        document.getElementById('password').value = password;
        document.getElementById('password').dispatchEvent(event);
        console.log('**********************Login to greytHR**********************');
        loginBtn.click();
    };

    // Handle sign in or sign out in the app
    const doSignInAndSignOutInApp = async (buttonElement) => {
        if (!buttonElement.shadowRoot) {
            console.log('Sign in/out button not ready, retrying...');
            await doSignInAndSignOutInAppCheck();
            return;
        }

        const buttonText = buttonElement.shadowRoot.childNodes[0].innerText.trim().toLowerCase();
        console.log("last signal from BGP", lastSignalFromBGP);

        if (buttonText === signOut) {
            if (lastSignalFromBGP === signOut) {
                buttonElement.click();
                await common.saveObjectInTemporaryStorage({ "lastSignalFromFGP": loggedOutText });
                chrome.runtime.sendMessage({ message: loggedOutText });
            } else if (lastSignalFromBGP === signIn) {
                await common.saveObjectInTemporaryStorage({ "lastSignalFromFGP": loggedInText });
                chrome.runtime.sendMessage({ message: loggedInText });
            } else {
                chrome.runtime.sendMessage({ message: "close the tab" });
            }
        } else if (buttonText === signIn) {
            if (lastSignalFromBGP === signOut) {
                await common.saveObjectInTemporaryStorage({ "lastSignalFromFGP": loggedOutText });
                chrome.runtime.sendMessage({ message: loggedOutText });
            } else if (lastSignalFromBGP === signIn) {
                buttonElement.click();
                await common.saveObjectInTemporaryStorage({ "lastSignalFromFGP": loggedInText });
                chrome.runtime.sendMessage({ message: loggedInText });
            } else {
                chrome.runtime.sendMessage({ message: "close the tab" });
            }
        }

        const lastSignalSavedFromFGP = await common.getObjectFromTemporaryStorage('lastSignalFromFGP');
        console.log("last signal saved from FGP", lastSignalSavedFromFGP);
    };

    bootstrap();

    // Cleanup on script unload or page navigation
    window.addEventListener('unload', () => {
        chrome.runtime.onMessage.removeListener(messageListener);
        clearIntervals();
    });
})();