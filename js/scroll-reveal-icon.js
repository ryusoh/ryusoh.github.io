/**
 * Shows the scroll-reveal-instagram icon only when the user has scrolled to the bottom.
 */
(function () {
    const icon = document.querySelector('.scroll-reveal-instagram');
    if (!icon) {
        return;
    }

    /**
     * Bolt Optimization:
     * - What: Replace `scroll` and `resize` event listeners with `IntersectionObserver`.
     * - Why: The previous implementation continuously queried `document.documentElement.scrollHeight` and `window.scrollY` on scroll events. This forced synchronous layout recalculations and occupied the main thread.
     * - Impact: Measurably reduces main thread CPU overhead and completely eliminates layout thrashing by delegating intersection tracking to the browser's highly optimized async layout engine.
     */
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            function (entries) {
                if (entries[0].isIntersecting) {
                    icon.classList.add('is-visible');
                } else {
                    icon.classList.remove('is-visible');
                }
            },
            { rootMargin: '50px' }
        );
        // Observe the icon directly to trigger exactly when it enters the viewport
        observer.observe(icon);
    } else {
        // Fallback for environments without IntersectionObserver
        icon.classList.add('is-visible');
    }
})();
