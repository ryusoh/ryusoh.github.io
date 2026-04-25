/* Load third-party vendor CSS/JS with fallbacks (e.g., Font Awesome) */
(function () {
    const init = () => {
        try {
            if (!window.CDNLoader) {
                return;
            }
            const fontAwesome = ['/assets/vendor/font-awesome/css/font-awesome.min.css'];
            const googleFonts = [
                'https://fonts.googleapis.com/css2?family=Lobster&display=swap',
                'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap',
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
            // Ignore CDN loader errors as this is a progressive enhancement
            if (
                typeof window !== 'undefined' &&
                window !== null &&
                window.console &&
                typeof window.console.warn === 'function'
            ) {
                window.console.warn('Vendor Loader failed:', e);
            }
        }
    };

    init();

    const testing = { init };
    if (typeof window !== 'undefined') {
        window.__VendorLoaderForTesting = testing;
    }

    /* eslint-disable no-undef */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = testing;
    }
    /* eslint-enable no-undef */
})();
