/* Load third-party vendor CSS/JS with fallbacks (e.g., Font Awesome) */
(function () {
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
})();
