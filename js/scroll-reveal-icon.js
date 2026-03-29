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

    function onScrollOrResize() {
        if (!ticking) {
            window.requestAnimationFrame(updateVisibility);
            ticking = true;
        }
    }

    /**
     * Bolt Optimization:
     * - What: Throttle `scroll` and `resize` event handlers using `requestAnimationFrame`.
     * - Why: The previous implementation fired synchronous DOM geometry reads (`scrollHeight`, `scrollTop`, `innerHeight`) on every `scroll` and `resize` event, causing layout thrashing and scroll jitter on the main thread.
     * - Impact: Measurably reduces main-thread blocking time by guaranteeing layout recalculations only happen once per frame, preventing forced synchronous layouts.
     */
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    // Initial check
    window.addEventListener('load', updateVisibility);
    // Some browsers need a slight delay or additional check after fonts/images load
    setTimeout(updateVisibility, 1000);
})();
