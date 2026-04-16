/* Simple CDN fallback loader (no modules). Exposes window.CDNLoader */
(function () {
    if (window.CDNLoader) {
        return;
    }
    function preconnect(origins) {
        try {
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < origins.length; i++) {
                const l = document.createElement('link');
                l.rel = 'preconnect';
                l.href = origins[i];
                l.crossOrigin = 'anonymous';
                fragment.appendChild(l);
            }
            document.head.appendChild(fragment);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Preconnect failed:', e);
        }
    }
    function loadScriptSequential(urls, attrs) {
        return new Promise(function (resolve, reject) {
            (function next(i) {
                if (i >= urls.length) {
                    return reject(new Error('all failed: ' + urls.join(', ')));
                }
                const s = document.createElement('script');
                s.src = urls[i];
                s.crossOrigin = 'anonymous';
                if (attrs && attrs.defer) {
                    s.defer = true;
                }
                if (attrs && attrs.async) {
                    s.async = true;
                }
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
                    const last = urls[urls.length - 1];
                    if (!last) {
                        return resolve();
                    }
                    let controller;
                    let timeoutId;
                    const options = { mode: 'cors' };
                    if (typeof window !== 'undefined' && window.AbortController) {
                        controller = new window.AbortController();
                        options.signal = controller.signal;
                        timeoutId = setTimeout(function () {
                            controller.abort();
                        }, 5000);
                    }

                    fetch(last, options)
                        .then(function (r) {
                            return r.ok ? r.text() : Promise.reject();
                        })
                        .then(function (css) {
                            const style = document.createElement('style');
                            style.textContent = css;
                            document.head.appendChild(style);
                            resolve();
                        })
                        .catch(function (e) {
                            if (
                                typeof window !== 'undefined' &&
                                window !== null &&
                                window.console &&
                                typeof window.console.warn === 'function'
                            ) {
                                window.console.warn('CDN fallback CSS load failed:', e);
                            }
                            resolve();
                        })
                        .finally(function () {
                            if (timeoutId) {
                                clearTimeout(timeoutId);
                            }
                        });
                    return;
                }
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = urls[i];
                link.crossOrigin = 'anonymous';
                link.onload = function () {
                    resolve();
                };
                link.onerror = function () {
                    next(i + 1);
                };
                document.head.appendChild(link);
            })(0);
        });
    }
    if (typeof window !== 'undefined') {
        window.CDNLoader = {
            preconnect: preconnect,
            loadScriptSequential: loadScriptSequential,
            loadCssWithFallback: loadCssWithFallback,
        };
    }

    /* eslint-disable no-undef */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            preconnect: preconnect,
            loadScriptSequential: loadScriptSequential,
            loadCssWithFallback: loadCssWithFallback,
        };
    }
    /* eslint-enable no-undef */
})();
