/* Ambient assets loader using CDNLoader (no modules) */
(function () {
    try {
        const prefersReduced =
            window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced || window.innerWidth < 1024) {
            return;
        }
        if (!window.CDNLoader) {
            return;
        }
        const body = document.body;
        const pageType = body ? body.getAttribute('data-page-type') : null;
        const useQuantum = pageType === 'home' || pageType === 'project';

        function loadLegacyAmbient() {
            return window.CDNLoader.loadScriptSequential(['/js/vendor/sketch.js'])
                .then(function () {
                    return window.CDNLoader.loadScriptSequential(
                        ['/js/ambient/config/default.js'],
                        {
                            defer: true,
                        }
                    );
                })
                .then(function () {
                    return window.CDNLoader.loadScriptSequential(['/js/ambient/ambient.js'], {
                        defer: true,
                    });
                });
        }

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
            .catch(function () {});
    } catch {}
})();
