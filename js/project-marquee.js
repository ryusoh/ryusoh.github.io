/**
 * project-marquee.js
 * Enhances the project page h1 with a scroll-linked marquee effect.
 */

/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined' || typeof gsap.ScrollTrigger === 'undefined') {
        window.console &&
            window.console.warn('GSAP or ScrollTrigger is not loaded. Skipping project marquee.');
        return;
    }

    const title = document.querySelector('.post-heading h1');
    if (!title) {
        return;
    }

    // Set a subtle left translation as the user scrolls down
    gsap.to(title, {
        scrollTrigger: {
            trigger: title,
            start: 'top center',
            end: 'bottom top',
            scrub: true,
        },
        x: -150, // subtle horizontal shift
        ease: 'none',
    });
});
