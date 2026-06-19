// Local default configuration for Ambient
(function () {
    function init() {
        window.AMBIENT_CONFIG = Object.assign(
            {
                enabled: true,
                minWidth: 0,
                maxParticles: 300,
                densityDivisor: 20000,
                radius: { min: 1.0, max: 8.0 },
                alpha: { min: 0.1, max: 0.6 },
                speed: 0.6,
                zIndex: 1,
                blend: 'screen',
                respectReducedMotion: false,
            },
            window.AMBIENT_CONFIG || {}
        );
    }

    function logError(e) {
        if (typeof window !== 'undefined' && window?.console?.warn) {
            window.console.warn('Ambient config initialization failed:', e);
        }
    }

    try {
        init();
    } catch (e) {
        logError(e);
    }

    if (typeof window !== 'undefined') {
        window.__DefaultConfigForTesting = { init };
    }
    /* eslint-disable no-undef */
    /* istanbul ignore else */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { init };
    }
    /* eslint-enable no-undef */
})();
