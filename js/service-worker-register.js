'use strict';

(function () {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    function isLocalhost() {
        try {
            const host = window.location.hostname;
            return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';
        } catch {
            return false;
        }
    }

    if (isLocalhost()) {
        return;
    }

    function emitEvent(name, detail) {
        if (typeof window.dispatchEvent !== 'function') {
            return;
        }

        if (typeof window.CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent(name, { detail: detail || null }));
            return;
        }

        if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
            const event = document.createEvent('CustomEvent');
            event.initCustomEvent(name, false, false, detail || null);
            window.dispatchEvent(event);
        }
    }

    function register() {
        navigator.serviceWorker
            .register('/sw.js')
            .then(function (registration) {
                emitEvent('serviceWorker:registered', {
                    scope: registration && registration.scope ? registration.scope : null,
                });
            })
            .catch(function (error) {
                emitEvent('serviceWorker:registrationError', {
                    message: error && error.message ? error.message : '',
                });
            });
    }

    if (document.readyState === 'complete') {
        register();
    } else {
        window.addEventListener('load', register);
    }
})();
