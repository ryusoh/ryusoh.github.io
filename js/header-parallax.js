/**
 * header-parallax.js
 * Links the project page header typography to scroll position for a narrative, engineered feel.
 */

/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') {
        window.console && window.console.warn('GSAP is not loaded. Skipping header parallax.');
        return;
    }

    const headerText = document.querySelector('.intro-header h1');
    if (!headerText) {
        return;
    }

    // Using gsap.quickTo for performance to avoid object creation inside scroll events
    const setY = gsap.quickTo(headerText, 'y', {
        ease: 'power1.out',
        duration: 0.1,
    });

    const setOpacity = gsap.quickTo(headerText, 'opacity', {
        ease: 'power1.out',
        duration: 0.1,
    });

    let ticking = false;

    window.addEventListener(
        'scroll',
        () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    // Move text up slowly as user scrolls down
                    setY(scrollY * 0.4);

                    // Fade out text as it moves
                    // Let's say it fully fades out after 300px of scroll
                    const opacity = Math.max(0, 1 - scrollY / 300);
                    setOpacity(opacity);

                    ticking = false;
                });
                ticking = true;
            }
        },
        { passive: true }
    );
});
