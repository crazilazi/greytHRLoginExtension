(async () => {
    const src = chrome.runtime.getURL("/app/actions/common.js");
    const { getUserCredentials, saveObjectInTemporaryStorage, getObjectFromTemporaryStorage, getObjectFromLocalStorage } = await import(src);

    // Read MAIN_URL from manifest.json
    const MAIN_URL = chrome.runtime.getManifest().config.main_url;
    const LOGIN_PATH = '/uas/portal/auth/login';
    const APP_HOME_PATH = '/v3/portal/ess/home';

    // Constants
    const SIGNALS = {
        SIGN_OUT: 'sign out',
        SIGN_IN: 'sign in',
        LOGGED_IN: 'logged in',
        LOGGED_OUT: 'logged out'
    };
    const POLL_INTERVAL_MS = 1000;
    const MAX_POLL_ATTEMPTS = 30; // 30 seconds max polling

    // State
    let lastSignalFromBGP = null;
    let activeInterval = null;

    // Common method for sending messages to the background
    const sendMessageToBackgroundProcessor = (message, action = "close the tab") => {
        chrome.runtime.sendMessage({ message: message, action: action });
    };

    // Message listener
    const handleMessage = (request) => {
        const { action } = request;
        if (action === SIGNALS.SIGN_IN || action === SIGNALS.SIGN_OUT) {
            lastSignalFromBGP = action;
            console.log("last signal from BGP", lastSignalFromBGP);
            bootstrap();
        }
    };
    chrome.runtime.onMessage.addListener(handleMessage);

    // Utility to wait for an element with timeout
    const waitForElement = (selector, maxAttempts = MAX_POLL_ATTEMPTS) => {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            activeInterval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(activeInterval);
                    activeInterval = null;
                    resolve(element);
                } else if (++attempts >= maxAttempts) {
                    clearInterval(activeInterval);
                    activeInterval = null;
                    reject(new Error(`Element ${selector} not found after ${maxAttempts} attempts`));
                }
            }, POLL_INTERVAL_MS);
        });
    };

    // Check if today is a holiday or weekend
    const isNonWorkingDay = async (date) => {
        const holidays = (await getObjectFromLocalStorage('holidays')) || [];
        const today = date.toISOString().split('T')[0];
        return holidays.includes(today) || date.getDay() === 0 || date.getDay() === 6;
    };

    // Perform login
    const doLogin = async () => {
        console.log('I am at login page');
        const user = await getUserCredentials();
        const { id: userId, password } = user;

        let loginBtn;
        try {
            loginBtn = await waitForElement('form button');
            console.log('Found login button', loginBtn);
        } catch (error) {
            sendMessageToBackgroundProcessor('Login button not found: ' + error);
            return;
        }

        const event = new Event('input', { bubbles: true });
        const usernameField = document.getElementById('username');
        const passwordField = document.getElementById('password');
        if (usernameField && passwordField) {
            usernameField.value = userId;
            usernameField.dispatchEvent(event);
            passwordField.value = password;
            passwordField.dispatchEvent(event);
            console.log('**********************Login to greytHR**********************');
            loginBtn.click();
        } else {
            sendMessageToBackgroundProcessor('Username or password field missing');
        }
    };

    // Handle sign in or sign out
    const doSignInOrOut = async () => {
        let button;
        try {
            button = await waitForElement('.gt-widget-wrapper.bg-white.rounded-m.border-secondary-200.hover\\:shadow-lg.ng-star-inserted:nth-child(3) gt-button');
            console.log('Found sign in/out button', button);
        } catch (error) {
            sendMessageToBackgroundProcessor('Sign in/out button not found: ' + error);
            return;
        }

        let buttonText;
        try {
            // Wait for shadowRoot and its child nodes to be ready
            const shadowReady = await new Promise((resolve, reject) => {
                let attempts = 0;
                const checkShadow = setInterval(() => {
                    if (button.shadowRoot && button.shadowRoot.childNodes[0] && button.shadowRoot.childNodes[0].innerText) {
                        clearInterval(checkShadow);
                        resolve(true);
                    } else if (++attempts >= MAX_POLL_ATTEMPTS) {
                        clearInterval(checkShadow);
                        reject(new Error('Shadow DOM not ready'));
                    }
                }, POLL_INTERVAL_MS);
                activeInterval = checkShadow; // Track this interval
            });

            if (shadowReady) {
                buttonText = button.shadowRoot.childNodes[0].innerText.trim().toLowerCase();
                console.log("Button text:", buttonText);
            }
        } catch (error) {
            sendMessageToBackgroundProcessor('Failed to access shadowRoot or innerText: ' + error);
            return;
        }

        console.log("last signal from BGP", lastSignalFromBGP);

        const actions = {
            [SIGNALS.SIGN_OUT]: {
                [SIGNALS.SIGN_OUT]: () => {
                    button.click();
                    return SIGNALS.LOGGED_OUT;
                },
                [SIGNALS.SIGN_IN]: () => SIGNALS.LOGGED_IN
            },
            [SIGNALS.SIGN_IN]: {
                [SIGNALS.SIGN_IN]: () => {
                    button.click();
                    return SIGNALS.LOGGED_IN;
                },
                [SIGNALS.SIGN_OUT]: () => SIGNALS.LOGGED_OUT
            }
        };

        const action = actions[buttonText]?.[lastSignalFromBGP];
        if (action) {
            const result = action();
            await saveObjectInTemporaryStorage({ "lastSignalFromFGP": result });
            sendMessageToBackgroundProcessor(result, result);
        } else {
            sendMessageToBackgroundProcessor('No matching action for buttonText and signal: ' + buttonText + ', ' + lastSignalFromBGP);
        }
    };

    // Main logic
    const bootstrap = async () => {
        const today = new Date();
        if (await isNonWorkingDay(today)) {
            console.log('Today is a holiday or weekend; no actions will be performed.');
            sendMessageToBackgroundProcessor("Today is a holiday or weekend; no actions will be performed.", "close the tab");
            return;
        }

        console.log('**********************What the hack**********************');
        const { pathname } = window.location;
        if (pathname === LOGIN_PATH) {
            await doLogin();
        } else if (pathname === APP_HOME_PATH) {
            await doSignInOrOut();
        }
    };

    // Run and cleanup
    // try {
    //     await bootstrap();
    // } finally {
    //     window.addEventListener('unload', () => {
    //         if (activeInterval) clearInterval(activeInterval);
    //         chrome.runtime.onMessage.removeListener(handleMessage);
    //     }, { once: true });
    // }
    window.addEventListener('unload', () => {
        if (activeInterval) clearInterval(activeInterval);
        chrome.runtime.onMessage.removeListener(handleMessage);
    }, { once: true });
})();