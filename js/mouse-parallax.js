/**
 * mouse-parallax.js
 * Enhances the main title with a subtle 3D mouse parallax effect.
 */

/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    if (window.PortfolioConfig && window.PortfolioConfig.enableMouseParallax === false) {
        return;
    }

    if (typeof gsap === 'undefined') {
        window.console && window.console.warn('GSAP is not loaded. Skipping mouse parallax.');
        return;
    }

    const title = document.querySelector('#main h1');
    if (!title) {
        return;
    }

    // We'll calculate movement relative to the center of the window
    let centerX = window.innerWidth / 2;
    let centerY = window.innerHeight / 2;

    // Recalculate on resize
    window.addEventListener(
        'resize',
        () => {
            centerX = window.innerWidth / 2;
            centerY = window.innerHeight / 2;
        },
        { passive: true }
    );

    document.addEventListener(
        'mousemove',
        (e) => {
            // Calculate offset from center (-1 to 1)
            const diffX = (e.clientX - centerX) / centerX;
            const diffY = (e.clientY - centerY) / centerY;

            // Apply a subtle parallax translation
            // Opposite direction of mouse movement
            gsap.to(title, {
                x: -diffX * 15,
                y: -diffY * 15,
                rotationY: diffX * 5, // subtle 3D rotation
                rotationX: -diffY * 5,
                ease: 'power2.out',
                duration: 0.8,
            });
        },
        { passive: true }
    );
});
