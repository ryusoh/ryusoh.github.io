/* <img> fallbacks for failed or stalled primary-origin requests. */

/**
 * @typedef {HTMLImageElement & {
 *   __fallbackList?: string[],
 *   __fallbackIndex?: number,
 *   __fallbackTimer?: ReturnType<typeof setTimeout> | null
 * }} HTMLImageElementWithFallback
 */
(function () {
    const FALLBACK_DELAY_MS = 1500;

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

        /** @param {HTMLImageElementWithFallback} el */
        function clearFallbackTimer(el) {
            if (el.__fallbackTimer) {
                if (typeof clearTimeout === 'function') {
                    clearTimeout(el.__fallbackTimer);
                }
                el.__fallbackTimer = null;
            }
        }

        /**
         * @param {HTMLImageElementWithFallback} el
         * @returns {boolean} Whether another fallback URL was selected.
         */
        function useNextFallback(el) {
            const list = el.__fallbackList;
            if (!list) {
                return false;
            }
            const index = el.__fallbackIndex || 0;
            if (index >= list.length) {
                return false;
            }

            clearFallbackTimer(el);
            /* Inside <picture>, setting img.src re-runs source selection and
             * would re-pick the failed <source> srcset; strip the sources so
             * the fallback src wins. */
            const picture = el.closest('picture');
            if (picture) {
                const sources = picture.querySelectorAll('source');
                for (let i = 0; i < sources.length; i++) {
                    sources[i].remove();
                }
            }
            el.removeAttribute('srcset');
            el.removeAttribute('sizes');
            el.src = list[index];
            el.__fallbackIndex = index + 1;
            return true;
        }

        /** @param {HTMLImageElementWithFallback} el */
        function armFallbackTimer(el) {
            if (
                typeof setTimeout !== 'function' ||
                el.__fallbackTimer ||
                (el.complete && el.naturalWidth > 0)
            ) {
                return;
            }
            el.__fallbackTimer = setTimeout(function () {
                el.__fallbackTimer = null;
                if (!el.complete || el.naturalWidth === 0) {
                    useNextFallback(el);
                }
            }, FALLBACK_DELAY_MS);
        }

        /**
         * @param {HTMLImageElementWithFallback} el
         */
        function initFallback(el) {
            const list = parseFallbacks(el);
            if (!list) {
                return;
            }

            clearFallbackTimer(el);
            el.classList.remove('is-fallback-ready');
            el.__fallbackList = list;
            el.__fallbackIndex = 0;

            /* istanbul ignore else */
            if (!el.src || el.src !== list[0]) {
                el.src = list[0];
            } else if (el.complete && el.naturalWidth > 0) {
                el.classList.add('is-fallback-ready');
            }

            if (el.loading !== 'lazy') {
                armFallbackTimer(el);
            }
        }

        /**
         * Arm timers only when lazy images approach the viewport. Arming every
         * lazy image at parse time would move offscreen traffic to the mirror.
         * @param {NodeListOf<HTMLImageElementWithFallback>} imgs
         */
        function observeLazyFallbacks(imgs) {
            if (typeof IntersectionObserver !== 'function') {
                return;
            }
            const observer = new IntersectionObserver(
                function (entries) {
                    for (let i = 0; i < entries.length; i++) {
                        const el = /** @type {HTMLImageElementWithFallback} */ (entries[i].target);
                        if (entries[i].isIntersecting) {
                            observer.unobserve(el);
                            armFallbackTimer(el);
                        }
                    }
                },
                { rootMargin: '300px' }
            );
            for (let i = 0; i < imgs.length; i++) {
                if (imgs[i].loading === 'lazy' && imgs[i].__fallbackList) {
                    observer.observe(imgs[i]);
                }
            }
        }

        /** @type {NodeListOf<HTMLImageElementWithFallback>} */
        const imgs = document.querySelectorAll('img[data-fallbacks]');
        for (let j = 0; j < imgs.length; j++) {
            initFallback(imgs[j]);
        }
        observeLazyFallbacks(imgs);

        /* Event delegation keeps image-heavy pages to two shared listeners. */
        document.addEventListener(
            'load',
            function (event) {
                const el = /** @type {HTMLImageElementWithFallback} */ (event.target);
                if (el && el.tagName === 'IMG' && el.hasAttribute('data-fallbacks')) {
                    clearFallbackTimer(el);
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
                    clearFallbackTimer(el);
                    if (useNextFallback(el)) {
                        armFallbackTimer(el);
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
                clearFallbackTimer,
                armFallbackTimer,
                useNextFallback,
                observeLazyFallbacks,
            };
        }
        /* eslint-disable no-undef */
        /* istanbul ignore else */
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = {
                parseFallbacks,
                initFallback,
                clearFallbackTimer,
                armFallbackTimer,
                useNextFallback,
                observeLazyFallbacks,
            };
        }
        /* eslint-enable no-undef */
    } catch (error) {
        logWarning('Caught exception during image fallback init:', error);
    }
})();
