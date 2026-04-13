(function () {
    'use strict';
    const LINK_ATTR = 'data-page-transition';
    const TRANSITION_PARAM = '__pt';

    // Exit: the content steps back — scale, fade, blur.
    // Navigate fires almost immediately. The browser fetches
    // while the visual exit completes. No overlay. No shape.
    // Just the content itself, moving.
    const NAVIGATE_DELAY = 80;

    // Entrance: content arrives slightly oversized and settles
    // into place. Like opening an app on iOS — the thing you
    // tapped zooms up and decelerates to fill the viewport.
    const ENTRANCE_DURATION = 280;
    const ENTRANCE_STAGGER = 50;

    function logWarning(msg, e) {
        if (
            typeof window !== 'undefined' &&
            window !== null &&
            window.console &&
            typeof window.console.warn === 'function'
        ) {
            window.console.warn(msg, e);
        }
    }

    function logError(msg, e) {
        if (
            typeof window !== 'undefined' &&
            window !== null &&
            window.console &&
            typeof window.console.error === 'function'
        ) {
            if (e) {
                window.console.error(msg, e);
            } else {
                window.console.error(msg);
            }
        }
    }

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    /**
     * Bolt Optimization:
     * - What: Cache `MediaQueryList` object from `window.matchMedia`.
     * - Why: Calling `window.matchMedia` repeatedly incurs unnecessary main-thread parsing and garbage collection overhead. The cached object's `.matches` property is reactive.
     * - Impact: Eliminates main-thread re-evaluation for subsequent checks.
     */
    let prefersReducedMotionMediaQuery = null;

    function prefersReducedMotion() {
        if (typeof window.matchMedia !== 'function') {
            return false;
        }
        try {
            if (prefersReducedMotionMediaQuery === null) {
                prefersReducedMotionMediaQuery = window.matchMedia(
                    '(prefers-reduced-motion: reduce)'
                );
            }
            return prefersReducedMotionMediaQuery ? prefersReducedMotionMediaQuery.matches : false;
        } catch (e) {
            logWarning('[page-transition] prefersReducedMotion error:', e);
            return false;
        }
    }

    function hasTransitionParam() {
        if (typeof window === 'undefined' || typeof window.location === 'undefined') {
            return false;
        }
        try {
            const url = new window.URL(window.location.href);
            return url.searchParams.has(TRANSITION_PARAM);
        } catch (e) {
            logWarning('[page-transition] URL parse error:', e);
            return false;
        }
    }

    function updateHistoryUrl(url) {
        if (window.history && typeof window.history.replaceState === 'function') {
            const newUrl = url.pathname + url.search + url.hash;
            window.history.replaceState({}, document.title, newUrl);
        }
    }

    function clearTransitionParam() {
        if (typeof window === 'undefined' || typeof window.location === 'undefined') {
            return;
        }
        try {
            const url = new window.URL(window.location.href);
            if (!url.searchParams.has(TRANSITION_PARAM)) {
                return;
            }
            url.searchParams.delete(TRANSITION_PARAM);
            updateHistoryUrl(url);
        } catch (e) {
            logWarning('[page-transition] clear transition param error:', e);
        }
    }

    function clampUnit(value) {
        return Math.min(1, Math.max(0, value));
    }

    // Store cursor position for the destination page.
    // Uses the same sessionStorage key that cursor.js reads on init,
    // so the custom cursor picks up exactly where the user clicked.
    const CURSOR_STORAGE_KEY = 'customCursorPosition';

    function storeCursorPositionForTransition(x, y) {
        try {
            if (typeof window.sessionStorage === 'undefined') {
                return;
            }
            const payload = JSON.stringify({
                x: Math.round(x),
                y: Math.round(y),
            });
            window.sessionStorage.setItem(CURSOR_STORAGE_KEY, payload);
        } catch (e) {
            // sessionStorage may be unavailable (private browsing, quota)
            logWarning('[page-transition] cursor position store failed:', e);
        }
    }

    // --- Exit: content steps back ---
    //
    // No overlay. No circle. No wipe. The content itself
    // scales down, fades, and blurs — it's receding from you.
    // Like minimizing a window on macOS, or switching away
    // from an app on iOS. The thing you were looking at
    // gently moves away.

    function exitPage(done) {
        document.documentElement.classList.add('page-transition--exiting');

        // Navigate while the exit is still running.
        // The browser starts fetching the next page
        // during the visual fadeout.
        if (typeof done === 'function') {
            window.setTimeout(done, NAVIGATE_DELAY);
        }
    }

    // --- Entrance: content arrives and settles ---
    //
    // The destination page content starts slightly oversized
    // (scale 1.02) and transparent, then eases down to 1.0
    // and full opacity. Deceleration. The content arrives
    // fast and slows down, like it's landing.
    //
    // Two groups: the header, then the body. One beat.

    function applyStaggeredEntrance() {
        const groups = [
            ['.intro-header', '.post-heading h1'],
            ['.post-content']
        ];

        let delay = 0;
        const allElements = [];

        for (let g = 0; g < groups.length; g += 1) {
            const groupDelay = delay;
            for (let i = 0; i < groups[g].length; i += 1) {
                const el = document.querySelector(groups[g][i]);
                if (el) {
                    el.style.opacity = '0';
                    el.style.transform = 'scale(1.02) translateY(6px)';
                    el.style.transition =
                        'opacity ' + ENTRANCE_DURATION + 'ms ease-out ' + groupDelay + 'ms, ' +
                        'transform ' + ENTRANCE_DURATION + 'ms ease-out ' + groupDelay + 'ms';
                    allElements.push(el);
                }
            }
            delay += ENTRANCE_STAGGER;
        }

        // Commit starting state, then reveal
        void document.body.offsetHeight;

        for (let j = 0; j < allElements.length; j += 1) {
            allElements[j].style.opacity = '1';
            allElements[j].style.transform = 'scale(1) translateY(0)';
        }
    }

    // --- URL validation (preserved from original) ---

    function isValidProtocol(parsedUrl) {
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            logError('[page-transition] Blocked potentially malicious URL scheme');
            return false;
        }
        return true;
    }

    function isValidOrigin(parsedUrl) {
        if (parsedUrl.origin !== window.location.origin) {
            logError('[page-transition] Blocked cross-origin navigation');
            return false;
        }
        return true;
    }

    function getValidatedUrl(url) {
        if (typeof url !== 'string') {
            return null;
        }
        const cleanUrl = url.replace(/^[\s\u0000-\u001F]+/g, '');
        try {
            const parsedUrl = new window.URL(cleanUrl, window.location.href);
            if (!isValidProtocol(parsedUrl)) {
                return null;
            }
            if (!isValidOrigin(parsedUrl)) {
                return null;
            }
            return cleanUrl;
        } catch (e) {
            logError('[page-transition] Blocked invalid URL', e);
            return null;
        }
    }

    function buildTransitionUrl(url) {
        try {
            const nextUrl = new window.URL(url, window.location.href);
            nextUrl.searchParams.set(TRANSITION_PARAM, '1');
            return nextUrl.toString();
        } catch (e) {
            logWarning('[page-transition] buildTransitionUrl error:', e);
            return url;
        }
    }

    // --- Navigation ---

    function navigate(url) {
        const validatedUrl = getValidatedUrl(url);
        if (!validatedUrl) {
            return false;
        }
        const targetUrl = buildTransitionUrl(validatedUrl);

        if (prefersReducedMotion()) {
            window.location.assign(targetUrl);
            return true;
        }

        exitPage(function () {
            window.location.assign(targetUrl);
        });
        return true;
    }

    // --- Click handling (event delegation) ---

    function shouldSkipNavBack(element) {
        if (!element) {
            return false;
        }
        if (!element.classList || !element.classList.contains('nav-back')) {
            return false;
        }
        return true;
    }

    function isStandardMouseEvent(event) {
        return (
            event.button === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
        );
    }

    function isEligibleAnchor(anchor) {
        const target = anchor.getAttribute('target');
        if (target && target !== '_self') {
            return false;
        }
        if (anchor.hasAttribute('download')) {
            return false;
        }
        const href = anchor.getAttribute('href');
        if (!href || href.indexOf('#') === 0) {
            return false;
        }
        const url = anchor.href;
        if (!url || url === window.location.href) {
            return false;
        }
        return true;
    }

    function isValidTransitionClick(event, anchor) {
        if (event.defaultPrevented) {
            return false;
        }
        if (!isStandardMouseEvent(event)) {
            return false;
        }
        if (shouldSkipNavBack(anchor)) {
            return false;
        }
        return isEligibleAnchor(anchor);
    }

    // --- Init ---

    ready(function () {
        if (!document.body) {
            return;
        }

        const isReducedMotion = prefersReducedMotion();
        const pendingReveal = hasTransitionParam();

        // Handle incoming transition (destination page)
        if (pendingReveal) {
            clearTransitionParam();
            if (!isReducedMotion) {
                const pageType = document.body.getAttribute('data-page-type');
                if (pageType === 'project') {
                    applyStaggeredEntrance();
                }
            }
        }

        let isAnimating = false;

        document.addEventListener('click', function (event) {
            const anchor = event.target.closest('a[' + LINK_ATTR + ']');
            if (!anchor) {
                return;
            }
            if (!isValidTransitionClick(event, anchor)) {
                return;
            }
            if (isAnimating) {
                return;
            }
            isAnimating = true;

            // Store click coordinates so the custom cursor on the
            // destination page initializes at the right position
            // instead of snapping to (0,0).
            storeCursorPositionForTransition(event.clientX, event.clientY);

            if (navigate(anchor.href)) {
                event.preventDefault();
            } else {
                isAnimating = false;
            }
        });

        window.addEventListener('pageshow', function (event) {
            if (event.persisted) {
                document.documentElement.classList.remove('page-transition--exiting');
                isAnimating = false;
            }
        });
    });

    if (typeof window !== 'undefined') {
        window.__PageTransitionForTesting = {
            hasTransitionParam,
            clearTransitionParam,
            clampUnit,
            updateHistoryUrl,
            getValidatedUrl,
        };
    }
})();
