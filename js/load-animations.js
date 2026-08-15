/**
 * load-animations.js
 * Creates an entrance animation for the page using GSAP.
 */
/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') {
        window.console && window.console.warn('GSAP is not loaded. Skipping load animations.');
        return;
    }

    const startAnimation = () => {
        const timeline = gsap.timeline({
            defaults: { ease: 'cubic-bezier(0.65, 0.05, 0, 1)', duration: 1.2 },
        });

        // Background scale down effect
        const background = document.getElementById('mimida');
        if (background) {
            gsap.set(background, { scale: 1.05 });
            timeline.to(
                background,
                { scale: 1, duration: 2, ease: 'cubic-bezier(0.65, 0.05, 0, 1)' },
                0
            );
        }

        // Stagger reveal of dynamic content (headline and navigation).
        // Title (h1 / .brand-title) remains static to preserve the fixed dock illusion.
        const elementsToReveal = [
            document.getElementById('headline'),
            document.getElementById('nav'),
        ].filter(Boolean); // Only animate elements that exist

        if (elementsToReveal.length > 0) {
            gsap.set(elementsToReveal, { y: 30, opacity: 0 });
            timeline.to(elementsToReveal, { y: 0, opacity: 1, stagger: 0.15 }, 0.3);
        }
    };

    if (
        typeof document !== 'undefined' &&
        document.fonts &&
        typeof document.fonts.ready?.then === 'function'
    ) {
        document.fonts.ready.then(startAnimation).catch(startAnimation);
    } else {
        startAnimation();
    }
});
