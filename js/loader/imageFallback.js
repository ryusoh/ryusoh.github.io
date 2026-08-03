/* Simple <img> fallback: looks for data-fallbacks='["url1","url2",...]' */

/**
 * @typedef {HTMLImageElement & { __fallbackList?: string[], __fallbackIndex?: number }} HTMLImageElementWithFallback
 */
(function () {
    /**
     * @param {string} msg
     * @param {unknown} [e]
     */
    function logWarning(msg, e) {
        if (typeof window !== 'undefined' && window?.console?.warn) {
            window.console.warn(msg, e);
        }
    }

    try {
        /**
         * @param {unknown[]} list
         * @returns {string[] | null}
         */
        function sanitizeFallbackList(list) {
            /** @type {string[]} */
            const sanitizedList = [];
            for (let k = 0; k < list.length; k++) {
                if (typeof list[k] === 'string') {
                    sanitizedList.push(/** @type {string} */ (list[k]));
                }
            }
            return sanitizedList.length > 0 ? sanitizedList : null;
        }

        /**
         * @param {HTMLElement} el
         */
        function parseFallbacks(el) {
            const listAttr = el.getAttribute('data-fallbacks');
            if (!listAttr || listAttr.length > 1024) {
                return null;
            }

            try {
                const list = JSON.parse(listAttr);
                if (!Array.isArray(list) || list.length === 0) {
                    return null;
                }
                return sanitizeFallbackList(list);
            } catch (error) {
                logWarning('Caught exception parsing fallback list:', error);
                return null;
            }
        }

        /**
         * @param {HTMLImageElementWithFallback} el
         */
        function initFallback(el) {
            const list = parseFallbacks(el);
            if (!list) {
                return;
            }

            el.classList.remove('is-fallback-ready');
            el.__fallbackList = list;
            el.__fallbackIndex = 0;

            /* istanbul ignore else */
            if (!el.src || el.src !== list[0]) {
                el.src = list[0];
            } else if (el.complete && el.naturalWidth > 0) {
                el.classList.add('is-fallback-ready');
            }
        }

        /** @type {NodeListOf<HTMLImageElementWithFallback>} */
        const imgs = document.querySelectorAll('img[data-fallbacks]');
        for (let j = 0; j < imgs.length; j++) {
            initFallback(imgs[j]);
        }

        /**
         * Bolt Optimization:
         * - What: Replace O(N) individual event listeners with document-level event delegation.
         * - Why: Calling `.addEventListener` for `load` and `error` on every image allocates redundant memory and blocks main-thread initialization on image-heavy pages.
         * - Impact: Measurably reduces memory footprint and speeds up time-to-interactive by utilizing a single set of O(1) capturing listeners on the document root.
         */
        document.addEventListener(
            'load',
            function (event) {
                const el = /** @type {HTMLImageElementWithFallback} */ (event.target);
                if (el && el.tagName === 'IMG' && el.hasAttribute('data-fallbacks')) {
                    el.classList.add('is-fallback-ready');
                }
            },
            true
        );

        document.addEventListener(
            'error',
            function (event) {
                const el = /** @type {HTMLImageElementWithFallback} */ (event.target);
                if (
                    el &&
                    el.tagName === 'IMG' &&
                    el.hasAttribute('data-fallbacks') &&
                    el.__fallbackList
                ) {
                    const list = el.__fallbackList;
                    const index = el.__fallbackIndex || 0;
                    if (index < list.length) {
                        el.src = list[index];
                        el.__fallbackIndex = index + 1;
                    }
                }
            },
            true
        );

        /* istanbul ignore else */
        if (typeof window !== 'undefined') {
            window.__ImageFallbackForTesting = {
                parseFallbacks,
                initFallback,
            };
        }
        /* eslint-disable no-undef */
        /* istanbul ignore else */
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = {
                parseFallbacks,
                initFallback,
            };
        }
        /* eslint-enable no-undef */
    } catch (error) {
        logWarning('Caught exception during image fallback init:', error);
    }
})();
