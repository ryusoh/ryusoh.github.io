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

        window.CDNLoader.loadCssWithFallback(['/css/ambient/ambient.css'])
            .then(function () {
                return window.CDNLoader.loadScriptSequential(['/js/vendor/sketch.js']);
            })
            .then(function () {
                return window.CDNLoader.loadScriptSequential(['/js/ambient/config/default.js'], {
                    defer: true,
                });
            })
            .then(function () {
                return window.CDNLoader.loadScriptSequential(['/js/ambient/ambient.js'], {
                    defer: true,
                });
            })
            .catch(function () {});
    } catch {}
})();
