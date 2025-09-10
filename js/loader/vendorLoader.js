/* Load third-party vendor CSS/JS with fallbacks (e.g., Font Awesome) */
(function () {
    try {
        if (!window.CDNLoader) {
            return;
        }
        const fontAwesome = [
            'https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css',
            'https://unpkg.com/font-awesome@4.7.0/css/font-awesome.min.css',
            'https://cdn.bootcdn.net/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css',
            'https://cdn.baomitu.com/font-awesome/4.7.0/css/font-awesome.min.css',
        ];
        const googleFonts = [
            'https://fonts.googleapis.com/css2?family=Lobster&display=swap',
            'https://fonts.bunny.net/css?family=Lobster',
        ];
        window.CDNLoader.preconnect([
            'https://cdn.jsdelivr.net',
            'https://unpkg.com',
            'https://cdn.bootcdn.net',
            'https://cdn.baomitu.com',
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
            'https://fonts.bunny.net',
        ]);
        window.CDNLoader.loadCssWithFallback(fontAwesome);
        window.CDNLoader.loadCssWithFallback(googleFonts);
    } catch {}
})();
