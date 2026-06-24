/* Load third-party vendor CSS/JS with fallbacks (e.g., Font Awesome) */
(function () {
    const logWarning = (msg, e) => {
        if (
            typeof window !== 'undefined' &&
            window !== null &&
            window.console &&
            typeof window.console.warn === 'function'
        ) {
            window.console.warn(msg, e);
        }
    };

    const handleVendorLoaderError = (e) => {
        logWarning('Vendor loader failed:', e);
        logWarning('Vendor Loader failed:', e);
    };

    const init = () => {
        try {
            if (!window.CDNLoader) {
                return;
            }
            const fontAwesome = ['/assets/vendor/font-awesome/css/font-awesome.min.css'];
            const googleFonts = [
                'https://fonts.googleapis.com/css2?family=Lobster&display=swap',
                'https://fonts.bunny.net/css?family=Lobster',
            ];
            window.CDNLoader.preconnect([
                'https://fonts.googleapis.com',
                'https://fonts.gstatic.com',
                'https://fonts.bunny.net',
            ]);
            window.CDNLoader.loadCssWithFallback(fontAwesome);
            window.CDNLoader.loadCssWithFallback(googleFonts);
        } catch (e) {
            handleVendorLoaderError(e);
        }
    };

    init();

    const testing = { init, handleVendorLoaderError, logWarning };
    if (typeof window !== 'undefined') {
        window.__VendorLoaderForTesting = testing;
    }

    /* eslint-disable no-undef */
    /* istanbul ignore else */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = testing;
    }
    /* eslint-enable no-undef */
})();
