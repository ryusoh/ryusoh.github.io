/* Ambient assets loader using CDNLoader (no modules) */
(function () {
    /** @type {MediaQueryList | null} */
    let prefersReducedMotionMediaQuery = null;

    /**
     * @param {{shouldSkipLoader: () => boolean, loadLegacyAmbient: () => Promise<void>}} api
     */
    function exportTesting(api) {
        if (typeof window !== 'undefined') {
            window.__AmbientLoaderForTesting = api;
        }
        /* eslint-disable no-undef */
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = api;
        }
        /* eslint-enable no-undef */
    }

    function shouldSkipLoader() {
        if (prefersReducedMotionMediaQuery === null && window.matchMedia) {
            prefersReducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        }

        const prefersReduced = prefersReducedMotionMediaQuery
            ? prefersReducedMotionMediaQuery.matches
            : false;
        return prefersReduced || window.innerWidth < 1024 || !window.CDNLoader;
    }

    function loadLegacyAmbient() {
        if (!window.CDNLoader) {
            return Promise.resolve();
        }
        return window.CDNLoader.loadScriptSequential(['/js/vendor/sketch.js'])
            .then(function () {
                if (!window.CDNLoader) {
                    return Promise.resolve();
                }
                return window.CDNLoader.loadScriptSequential(['/js/ambient/config/default.js'], {
                    defer: true,
                });
            })
            .then(function () {
                if (!window.CDNLoader) {
                    return Promise.resolve();
                }
                return window.CDNLoader.loadScriptSequential(['/js/ambient/ambient.js'], {
                    defer: true,
                });
            });
    }

    /**
     * @param {unknown} e
     */
    function handleAsyncError(e) {
        if (
            typeof window !== 'undefined' &&
            window !== null &&
            window.console &&
            typeof window.console.warn === 'function'
        ) {
            window.console.warn('Ambient async loader failed:', e);
        }
    }

    /* istanbul ignore else */
    function getFallbackLogger() {
        if (window !== null && window.console && typeof window.console.warn === 'function') {
            return window.console.warn.bind(window.console);
        }
        /* istanbul ignore next */
        return null;
    }

    /**
     * @param {unknown} e
     */
    function handleSyncError(e) {
        /* istanbul ignore if */
        if (typeof window === 'undefined') {
            return;
        }
        if (window.AppLogger && typeof window.AppLogger.error === 'function') {
            window.AppLogger.error('Ambient initialization failed:', e);
            return;
        }
        const logger = getFallbackLogger();
        if (logger) {
            logger('Ambient initialization failed:', e);
        }
    }

    function init() {
        if (shouldSkipLoader()) {
            exportTesting({
                shouldSkipLoader,
                loadLegacyAmbient,
            });
            return;
        }

        const body = document.body;
        const pageType = body ? body.getAttribute('data-page-type') : null;
        const useQuantum = pageType === 'home' || pageType === 'project';

        if (!window.CDNLoader) {
            return;
        }
        window.CDNLoader.loadCssWithFallback(['/css/ambient/ambient.css'])
            .then(function () {
                const legacy = loadLegacyAmbient();
                /* eslint-disable indent */
                const quantum = useQuantum
                    ? window.CDNLoader
                        ? window.CDNLoader.loadScriptSequential(
                              ['/js/ambient/quantum_particles.js'],
                              {
                                  defer: true,
                              }
                          )
                        : Promise.resolve()
                    : Promise.resolve();
                /* eslint-enable indent */
                return Promise.all([legacy, quantum]);
            })
            .catch(handleAsyncError);

        exportTesting({ shouldSkipLoader, loadLegacyAmbient });
    }

    try {
        init();
    } catch (e) {
        if (
            typeof window !== 'undefined' &&
            window.console &&
            typeof window.console.error === 'function'
        ) {
            window.console.error('Ambient sync error:', e);
        }
        handleSyncError(e);
    }
})();
