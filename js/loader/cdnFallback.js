/* Simple CDN fallback loader (no modules). Exposes window.CDNLoader */
(function () {
    if (window.CDNLoader) return;
    function preconnect(origins) {
        try {
            for (var i = 0; i < origins.length; i++) {
                var l = document.createElement('link');
                l.rel = 'preconnect';
                l.href = origins[i];
                l.crossOrigin = 'anonymous';
                document.head.appendChild(l);
            }
        } catch {}
    }
    function loadScriptSequential(urls, attrs) {
        return new Promise(function (resolve, reject) {
            (function next(i) {
                if (i >= urls.length) return reject(new Error('all failed: ' + urls.join(', ')));
                var s = document.createElement('script');
                s.src = urls[i];
                s.crossOrigin = 'anonymous';
                if (attrs && attrs.defer) s.defer = true;
                if (attrs && attrs.async) s.async = true;
                s.onload = function () {
                    resolve();
                };
                s.onerror = function () {
                    next(i + 1);
                };
                document.head.appendChild(s);
            })(0);
        });
    }
    function loadCssWithFallback(urls) {
        return new Promise(function (resolve) {
            (function next(i) {
                if (i >= urls.length) {
                    var last = urls[urls.length - 1];
                    fetch(last, { mode: 'cors' })
                        .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
                        .then(function (css) {
                            var style = document.createElement('style');
                            style.textContent = css;
                            document.head.appendChild(style);
                            resolve();
                        })
                        .catch(function () { resolve(); });
                    return;
                }
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = urls[i];
                link.crossOrigin = 'anonymous';
                link.onload = function () { resolve(); };
                link.onerror = function () { next(i + 1); };
                document.head.appendChild(link);
            })(0);
        });
    }
    window.CDNLoader = { preconnect: preconnect, loadScriptSequential: loadScriptSequential, loadCssWithFallback: loadCssWithFallback };
})();
