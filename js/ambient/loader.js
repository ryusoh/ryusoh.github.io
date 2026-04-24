/* Ambient assets loader using CDNLoader (no modules) */
(function () {
    let prefersReducedMotionMediaQuery = null;

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
        return window.CDNLoader.loadScriptSequential(['/js/vendor/sketch.js'])
            .then(function () {
                return window.CDNLoader.loadScriptSequential(['/js/ambient/config/default.js'], {
                    defer: true,
                });
            })
            .then(function () {
                return window.CDNLoader.loadScriptSequential(['/js/ambient/ambient.js'], {
                    defer: true,
                });
            });
    }

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

    function handleSyncError(e) {
        if (typeof window !== 'undefined') {
            if (window.AppLogger && typeof window.AppLogger.error === 'function') {
                window.AppLogger.error('Ambient initialization failed:', e);
            } else if (
                window !== null &&
                window.console &&
                typeof window.console.warn === 'function'
            ) {
                window.console.warn('Ambient initialization failed:', e);
            }
        }
    }

    function initLoader() {
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

        window.CDNLoader.loadCssWithFallback(['/css/ambient/ambient.css'])
            .then(function () {
                const legacy = loadLegacyAmbient();
                /* eslint-disable indent */
                const quantum = useQuantum
                    ? window.CDNLoader.loadScriptSequential(['/js/ambient/quantum_particles.js'], {
                          defer: true,
                      })
                    : Promise.resolve();
                /* eslint-enable indent */
                return Promise.all([legacy, quantum]);
            })
            .catch(handleAsyncError);

        exportTesting({ shouldSkipLoader, loadLegacyAmbient });
    }

    try {
        initLoader();
    } catch (e) {
        handleSyncError(e);
    }
})();
