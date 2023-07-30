(async () => {
    const src = chrome.runtime.getURL("/app/actions/common.js");
    const common = await import(src);
    const signOut = 'sign out';
    const signIn = 'sign in';
    const loggedInText = 'logged in';
    const loggedOutText = 'logged out';
    let lastSignalFromBGP = undefined;

    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        // console.log(request);
        if (request.message === signIn) {
            lastSignalFromBGP = signIn;
            console.log("last signal from BGP", lastSignalFromBGP);
        } else if (request.message === signOut) {
            lastSignalFromBGP = signOut;
            console.log("last signal from BGP", lastSignalFromBGP);
        }
    });

    bootstrap = async () => {
        const todayDate = new Date();
        if (todayDate.getDay() === 6 || todayDate.getDay() === 0) {
            console.log('Working on weekend is not good for your health.');
            //return;
        }

        console.log('**********************What the hack**********************');
        const tabLogInPathname = "/uas/portal/auth/login";
        const tabTitoPathName = "/v3/portal/ess/home";

        if (window.location.pathname === tabLogInPathname) {
            doLoginCheck();

        } else if (window.location.pathname === tabTitoPathName) {
            doSignInAndSignOutInAppCheck();
        }
    };

    doLoginCheck = async () => {
        const doLoginInterVal = setInterval(async () => {
            let loginBtn = undefined;
            try {
                loginBtn = document.getElementsByTagName('form')[0].getElementsByTagName("button")[0];
            } catch (error) {
                console.error(error);
            }
            console.log('Im still looking for login button...');
            if (loginBtn !== undefined) {
                console.log('Finally i have login button', loginBtn);
                clearInterval(doLoginInterVal);
                await doLoginToGreyThr();
            }
        }, 1000);
    };

    const doSignInAndSignOutInAppCheck = async () => {
        const doSignInAndSignOutInAppInterval = setInterval(async () => {
            let signInAndSignOutBtn = undefined;
            try {
                signInAndSignOutBtn = document.getElementsByClassName("gt-widget-wrapper bg-white rounded-m border-secondary-200 hover:shadow-lg ng-star-inserted")[2].getElementsByTagName("gt-button")[0];
            } catch (error) {
                console.error(error);
            }
            console.log('Im still looking for signIn and SignOut button...');
            if (signInAndSignOutBtn !== undefined && signInAndSignOutBtn.shadowRoot && signInAndSignOutBtn.shadowRoot.childNodes[0]) {
                console.log('Finally i have signIn and SignOut button', signInAndSignOutBtn);
                clearInterval(doSignInAndSignOutInAppInterval);
                await doSignInAndSignOutInApp();
            }
        }, 1000);
    };

    doLoginToGreyThr = async () => {
        console.log('Im at login page');
        const user = await common.getUserCredentials();
        const userId = user.id;
        const password = user.password;
        let loginBtn = undefined;
        try {
            loginBtn = document.getElementsByTagName('form')[0].getElementsByTagName("button")[0];
        } catch (error) {
            console.error(error);
        }
        console.log('Im still looking for login button...');
        if (loginBtn === undefined) {
            doLoginCheck();
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

    doSignInAndSignOutInApp = async () => {
        let signInAndSignOutBtn = undefined;
        try {
            signInAndSignOutBtn = document.getElementsByClassName("gt-widget-wrapper bg-white rounded-m border-secondary-200 hover:shadow-lg ng-star-inserted")[2].getElementsByTagName("gt-button")[0];
        } catch (error) {
            console.error(error);
        }
        console.log('Im still looking for signIn and SignOut button...');
        if (signInAndSignOutBtn === undefined) {
            doSignInAndSignOutInAppCheck();
            return;
        }
        console.log("last signal from BGP", lastSignalFromBGP);
        if (signInAndSignOutBtn.shadowRoot.childNodes[0].innerText.trim().toLowerCase() === signOut) {

            if (lastSignalFromBGP === signOut) {
                signInAndSignOutBtn.click();
                chrome.runtime.sendMessage({ message: loggedOutText });
            } else if (lastSignalFromBGP === signIn) {
                chrome.runtime.sendMessage({ message: loggedInText });
            }
            else {
                chrome.runtime.sendMessage({ message: "close the tab" });
            }
        } else if (signInAndSignOutBtn.shadowRoot.childNodes[0].innerText.trim().toLowerCase() === signIn) {

            if (lastSignalFromBGP === signOut) {
                chrome.runtime.sendMessage({ message: loggedOutText });
            } else if (lastSignalFromBGP === signIn) {
                signInAndSignOutBtn.click();
                chrome.runtime.sendMessage({ message: loggedInText });
            }
            else {
                chrome.runtime.sendMessage({ message: "close the tab" });
            }
        }
    }
    bootstrap();
})();
