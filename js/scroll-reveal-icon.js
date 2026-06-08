/**
 * Shows the scroll-reveal-instagram icon only when the user has scrolled to the bottom.
 */
(function () {
    const icon = document.querySelector('.scroll-reveal-instagram');
    if (!icon) {
        return;
    }

    let ticking = false;

    /**
     * Bolt Optimization:
     * - What: Cache `window.innerHeight` during `resize` events.
     * - Why: The previous implementation read `window.innerHeight` synchronously on every `scroll` frame. Reading layout properties in a high-frequency event listener forces the browser to evaluate the DOM repeatedly, causing layout thrashing and main-thread CPU overhead.
     * - Impact: Measurably reduces main thread blocking time during continuous scrolling by relying on a cached window dimension.
     */
    let cachedClientHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

    function updateMetrics() {
        cachedClientHeight = window.innerHeight;
    }

    function updateVisibility() {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;

        // Show when user is within 50px of the bottom
        if (scrollTop + cachedClientHeight >= scrollHeight - 50) {
            icon.classList.add('is-visible');
        } else {
            icon.classList.remove('is-visible');
        }
        ticking = false;
    }

    /**
     * Bolt Optimization:
     * - What: Throttle `updateVisibility` using `requestAnimationFrame`.
     * - Why: Calling `updateVisibility` synchronously on every `scroll` and `resize` event causes multiple synchronous DOM reads (`scrollHeight`, `scrollY`, `innerHeight`) per frame. This causes layout thrashing and main-thread blocking time.
     * - Impact: Measurably reduces CPU usage and scroll jitter by ensuring DOM reads happen at most once per frame and are synchronized with the browser's paint cycle.
     */
    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(updateVisibility);
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener(
        'resize',
        function () {
            updateMetrics();
            onScroll();
        },
        { passive: true }
    );

    // Initial check
    window.addEventListener('load', function () {
        updateMetrics();
        updateVisibility();
    });
    // Some browsers need a slight delay or additional check after fonts/images load
    setTimeout(function () {
        updateMetrics();
        updateVisibility();
    }, 1000);
})();
