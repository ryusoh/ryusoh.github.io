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

    /**
     * Bolt Optimization:
     * - What: Replace `gsap.to()` inside the `mousemove` listener with `gsap.quickTo()`.
     * - Why: Calling `gsap.to()` on every `mousemove` event instantiates a new tween object, causing memory churn, garbage collection overhead, and main-thread jank.
     * - Impact: Measurably reduces memory allocations and CPU usage by reusing pre-initialized setter functions for high-frequency updates.
     */
    const setX = gsap.quickTo(title, 'x', { duration: 0.8, ease: 'power2.out' });
    const setY = gsap.quickTo(title, 'y', { duration: 0.8, ease: 'power2.out' });
    const setRotationX = gsap.quickTo(title, 'rotationX', { duration: 0.8, ease: 'power2.out' });
    const setRotationY = gsap.quickTo(title, 'rotationY', { duration: 0.8, ease: 'power2.out' });

    document.addEventListener(
        'mousemove',
        (e) => {
            // Calculate offset from center (-1 to 1)
            const diffX = (e.clientX - centerX) / centerX;
            const diffY = (e.clientY - centerY) / centerY;

            // Apply a subtle parallax translation
            // Opposite direction of mouse movement
            setX(-diffX * 15);
            setY(-diffY * 15);
            setRotationY(diffX * 5); // subtle 3D rotation
            setRotationX(-diffY * 5);
        },
        { passive: true }
    );
});
