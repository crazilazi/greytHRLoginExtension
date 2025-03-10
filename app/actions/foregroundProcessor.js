(async () => {
    const src = chrome.runtime.getURL("/app/actions/common.js");
    const { getUserCredentials, isNonWorkingDay, saveObjectInLocalStorage, log } = await import(src);

    // Read MAIN_URL from manifest.json
    const MAIN_URL = chrome.runtime.getManifest().config.main_url;
    const LOGIN_PATH = '/uas/portal/auth/login';
    const APP_HOME_PATH = '/v3/portal/ess/home';

    // Constants
    const SIGNALS = Object.freeze({
        SIGN_OUT: 'sign out',
        SIGN_IN: 'sign in',
        LOGGED_IN: 'logged in',
        LOGGED_OUT: 'logged out'
    });
    const TIMEOUT_MS = 30000;

    // State
    let lastSignalFromBGP = null;
    let isProcessing = false; // Flag to prevent duplicate processing

    log('Foreground script initialization.');

    // Centralized error handler
    const handleError = (message, level = 'error', notifyBackground = false) => {
        log(message, level);
        if (notifyBackground) {
            sendMessageToBackgroundProcessor(message, 'close the tab');
        }
    };

    // Common method for sending messages to the background
    const sendMessageToBackgroundProcessor = async (message, action = "close the tab") => {
        try {
            const packet = { message, action };
            chrome.runtime.sendMessage(packet);
            log(`Message sent to background: ${message}, action: ${action}`);
        } catch (error) {
            log(`Failed to send message to background: ${error.message}`, 'error');
        }
    };

    // Message listener
    const handleMessage = (request) => {
        const { action } = request;
        log(`Received message from background: ${action}`);
        if (action === SIGNALS.SIGN_IN || action === SIGNALS.SIGN_OUT) {
            if (isProcessing) {
                log(`Already processing a signal (${lastSignalFromBGP}), ignoring duplicate: ${action}`);
                return;
            }
            lastSignalFromBGP = action;
            log(`Last signal from BGP: ${lastSignalFromBGP}`);
            bootstrap();
        }
    };

    // Ensure listener is only added once
    chrome.runtime.onMessage.removeListener(handleMessage); // Remove any existing listener
    chrome.runtime.onMessage.addListener(handleMessage);

    // Cleanup function for foreground script
    const cleanupForegroundResources = () => {
        if (window.foregroundTimeouts) {
            window.foregroundTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            window.foregroundTimeouts = [];
            log('Cleared foreground timeouts.');
        }
    };

    // Utility to wait for an element using MutationObserver
    const waitForElement = (selector, timeoutMs = TIMEOUT_MS) => {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) return resolve(element);

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found after ${timeoutMs}ms`));
            }, timeoutMs);

            // Store the timeout ID for cleanup
            if (!window.foregroundTimeouts) window.foregroundTimeouts = [];
            window.foregroundTimeouts.push(timeoutId);
        });
    };

    // Optimized utility to wait for shadow DOM content
    const waitForShadowContent = (element, timeoutMs = TIMEOUT_MS) => {
        return new Promise((resolve, reject) => {
            log(`Waiting for shadow DOM content for element: ${element.tagName}`);

            const findTextContent = (root) => {
                if (!root) return null;
                for (const node of root.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                        return node.textContent.trim().toLowerCase();
                    }
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.shadowRoot) {
                            const text = findTextContent(node.shadowRoot);
                            if (text) return text;
                        }
                        const text = findTextContent(node);
                        if (text) return text;
                    }
                }
                return null;
            };

            if (element.shadowRoot) {
                const text = findTextContent(element.shadowRoot);
                if (text) {
                    log(`Shadow DOM content found immediately: ${text}`);
                    return resolve(text);
                }
            }

            const observer = new MutationObserver(() => {
                if (element.shadowRoot) {
                    const text = findTextContent(element.shadowRoot);
                    if (text) {
                        log(`Shadow DOM content found via observer: ${text}`);
                        observer.disconnect();
                        resolve(text);
                    }
                }
            });

            observer.observe(element, { childList: true, subtree: true, characterData: true });
            if (element.shadowRoot) {
                observer.observe(element.shadowRoot, { childList: true, subtree: true, characterData: true });
            }

            const timeoutId = setTimeout(() => {
                log('Shadow DOM content not found within timeout');
                observer.disconnect();
                reject(new Error('Shadow DOM content not found after timeout'));
            }, timeoutMs);

            // Store the timeout ID for cleanup
            if (!window.foregroundTimeouts) window.foregroundTimeouts = [];
            window.foregroundTimeouts.push(timeoutId);
        });
    };

    // Perform login
    const doLogin = async () => {
        log('At login page');
        try {
            if (window.location.origin !== new URL(MAIN_URL).origin) {
                throw new Error('Invalid origin, aborting login');
            }

            const user = await getUserCredentials();
            const { id: userId, password } = user;

            const loginBtn = await waitForElement('form button');
            log(`Found login button: ${loginBtn}`);

            const usernameField = document.getElementById('username');
            const passwordField = document.getElementById('password');
            if (usernameField && passwordField) {
                const event = new Event('input', { bubbles: true });
                usernameField.value = userId;
                usernameField.dispatchEvent(event);
                passwordField.value = password;
                passwordField.dispatchEvent(event);
                log('Attempting login to greytHR');
                loginBtn.click();
            } else {
                throw new Error('Username or password field missing');
            }
        } catch (error) {
            handleError(`Login failed: ${error.message}`, 'error', true);
        } finally {
            isProcessing = false; // Reset flag
        }
    };

    // Handle sign in or sign out
    const doSignInOrOut = async () => {
        try {
            if (window.location.origin !== new URL(MAIN_URL).origin) {
                throw new Error('Invalid origin, aborting sign in/out');
            }

            const button = await waitForElement('.gt-widget-wrapper.bg-white.rounded-m.border-secondary-200.hover\\:shadow-lg.ng-star-inserted:nth-child(3) gt-button');
            log(`Found sign in/out button: ${button}`);

            const buttonText = await waitForShadowContent(button);
            log(`Button text: ${buttonText}`);

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
                await saveObjectInLocalStorage({ lastSignalFromFGP: result });
                sendMessageToBackgroundProcessor(result, result);
            } else {
                throw new Error(`No matching action for buttonText and signal: ${buttonText}, ${lastSignalFromBGP}`);
            }
        } catch (error) {
            handleError(`Sign in/out failed: ${error.message}`, 'error', true);
        } finally {
            isProcessing = false; // Reset flag
        }
    };

    // Main logic
    const bootstrap = async () => {
        if (isProcessing) {
            log('Already processing a signal, skipping bootstrap');
            return;
        }
        isProcessing = true;
        try {
            const today = new Date();
            if (await isNonWorkingDay(today)) {
                log('Today is a holiday or weekend; no actions will be performed.');
                sendMessageToBackgroundProcessor("Today is a holiday or weekend; no actions will be performed.", "close the tab");
                return;
            }

            log('Starting bootstrap');
            const { pathname } = window.location;
            if (pathname === LOGIN_PATH) {
                await doLogin();
            } else if (pathname === APP_HOME_PATH) {
                await doSignInOrOut();
            }
        } catch (error) {
            handleError(`Bootstrap failed: ${error.message}`, 'error', true);
        } finally {
            isProcessing = false; // Ensure flag is reset even on error
        }
    };

    // Clean up on unload
    const unloadHandler = () => {
        cleanupForegroundResources();
        chrome.runtime.onMessage.removeListener(handleMessage);
        window.removeEventListener('unload', unloadHandler);
    };
    window.addEventListener('unload', unloadHandler, { once: true });

    log('Foreground script loaded and initialized.');
})();