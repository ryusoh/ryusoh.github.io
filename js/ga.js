// Google Analytics (Universal Analytics) bootstrap
// Mirrors the previous inline snippet in index.html
/**
 * @param {Window} i
 * @param {Document} s
 * @param {string} o
 * @param {string} g
 * @param {string} r
 */
(function (i, s, o, g, r) {
    /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (i))['GoogleAnalyticsObject'] =
        r;
    /** @type {Record<string, { q?: IArguments[]; l?: number } & ((...args: unknown[]) => void)>} */ (
        /** @type {unknown} */ (i)
    )[r] =
        /** @type {Record<string, { q?: IArguments[]; l?: number } & ((...args: unknown[]) => void)>} */ (
            /** @type {unknown} */ (i)
        )[r] ||
        function () {
            const gaFn =
                /** @type {Record<string, { q?: IArguments[]; l?: number } & ((...args: unknown[]) => void)>} */ (
                    /** @type {unknown} */ (i)
                )[r];
            gaFn.q = gaFn.q || [];
            gaFn.q.push(arguments);
        };
    /** @type {Record<string, { q?: IArguments[]; l?: number } & ((...args: unknown[]) => void)>} */ (
        /** @type {unknown} */ (i)
    )[r].l = new Date().getTime();
    const a = /** @type {HTMLScriptElement} */ (s.createElement(o));
    const m = /** @type {Element} */ (s.getElementsByTagName(o)[0]);
    if (a) {
        a.async = true;
        a.src = g;
        if (m && m.parentNode) {
            m.parentNode.insertBefore(a, m);
        }
    }
})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');

// Existing property and initial pageview
try {
    if (typeof window.ga === 'function') {
        window.ga('create', 'UA-9097302-10', 'auto');
        window.ga('send', 'pageview');
    }
} catch (/** @type {unknown} */ e) {
    /* istanbul ignore else */
    if (
        typeof window !== 'undefined' &&
        window !== null &&
        window.console &&
        typeof window.console.warn === 'function'
    ) {
        window.console.warn('Google Analytics initialization failed:', e);
    } else if (
        typeof process !== 'undefined' &&
        process !== null &&
        typeof process.stderr !== 'undefined'
    ) {
        process.stderr.write(
            'Google Analytics initialization failed: ' +
                (e ? /** @type {Error} */ (e).message || e : 'Unknown error') +
                '\n'
        );
    }
}
