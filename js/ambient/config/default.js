// Local default configuration for Ambient
(function () {
    try {
        window.AMBIENT_CONFIG = Object.assign({
            enabled: true,
            minWidth: 1024,
            maxParticles: 300,
            densityDivisor: 20000,
            radius: { min: 1.0, max: 8.0 },
            alpha: { min: 0.1, max: 0.6 },
            speed: 0.6,
            zIndex: 1,
            blend: 'screen',
            respectReducedMotion: false,
        }, window.AMBIENT_CONFIG || {});
    } catch (e) { // eslint-disable-line no-unused-vars
        // Do nothing
    }
})();
