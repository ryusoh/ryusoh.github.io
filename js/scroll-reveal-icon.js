/**
 * Shows the scroll-reveal-instagram icon only when the user has scrolled to the bottom.
 */
(function () {
    const icon = document.querySelector('.scroll-reveal-instagram');
    if (!icon) {
        return;
    }

    let ticking = false;

    function updateVisibility() {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = window.innerHeight;

        // Show when user is within 50px of the bottom
        if (scrollTop + clientHeight >= scrollHeight - 50) {
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
    window.addEventListener('resize', onScroll, { passive: true });

    // Initial check
    window.addEventListener('load', updateVisibility);
    // Some browsers need a slight delay or additional check after fonts/images load
    setTimeout(updateVisibility, 1000);
})();
