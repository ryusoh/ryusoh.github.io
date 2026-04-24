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

    // Stagger reveal of main content
    const elementsToReveal = [
        document.querySelector('#main h1'),
        document.getElementById('headline'),
        document.getElementById('nav'),
    ].filter(Boolean); // Only animate elements that exist

    if (elementsToReveal.length > 0) {
        gsap.set(elementsToReveal, { y: 30, opacity: 0 });
        timeline.to(elementsToReveal, { y: 0, opacity: 1, stagger: 0.15 }, 0.3);
    }
});
