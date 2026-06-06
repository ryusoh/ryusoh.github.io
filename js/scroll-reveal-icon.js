/**
 * Shows the scroll-reveal-instagram icon only when the user has scrolled to the bottom.
 */
(function () {
    const icon = document.querySelector('.scroll-reveal-instagram');
    if (!icon) {
        return;
    }

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
    }

    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility, { passive: true });

    // Initial check
    window.addEventListener('load', updateVisibility);
    // Some browsers need a slight delay or additional check after fonts/images load
    setTimeout(updateVisibility, 1000);
})();
