/**
 * scroll-marquee.js
 * Implements a narrative scrolling marquee using GSAP.
 * Background text scrolls horizontally based on window vertical scroll,
 * following the "Scroll is narrative" and "One easing curve" principles.
 */
/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    // Only run on project pages where we have a specific heading structure
    if (!document.body || document.body.getAttribute('data-page-type') !== 'project') {
        return;
    }

    if (typeof gsap === 'undefined') {
        window.console && window.console.warn('GSAP is not loaded. Skipping scroll marquee.');
        return;
    }

    // Respect reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    // Extract the project title text
    const titleElement = document.querySelector('.post-heading h1');
    if (!titleElement) {
        return;
    }

    // Strip HTML tags to get pure text for marquee
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = titleElement.innerHTML;
    const projectTitle = tempDiv.textContent || tempDiv.innerText || 'PROJECT';

    // Create the marquee container
    const marqueeContainer = document.createElement('div');
    marqueeContainer.className = 'scroll-marquee-container';
    marqueeContainer.setAttribute('aria-hidden', 'true');

    // Create multiple repetitions of the title to ensure it fills the screen
    const repetitions = 4;
    let marqueeText = '';
    for (let i = 0; i < repetitions; i++) {
        marqueeText += projectTitle + ' \u00A0 \u2014 \u00A0 '; // \u00A0 is non-breaking space, \u2014 is em dash
    }
    marqueeContainer.textContent = marqueeText;

    // Insert as the first child of body so it sits behind everything
    document.body.insertBefore(marqueeContainer, document.body.firstChild);

    // Initial position offset to avoid starting at exactly 0
    const initialOffset = -100;
    gsap.set(marqueeContainer, { x: initialOffset });

    /**
     * Use gsap.quickTo for high-performance updates bound to the scroll event.
     * Unified easing curve: cubic-bezier(0.65, 0.05, 0, 1)
     */
    const setX = gsap.quickTo(marqueeContainer, 'x', {
        duration: 1.5,
        ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
    });

    let ticking = false;

    // Scroll listener using requestAnimationFrame to prevent layout thrashing
    window.addEventListener(
        'scroll',
        () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    // Calculate horizontal translation based on vertical scroll
                    // Multiplier determines speed of the marquee
                    const scrollY = window.scrollY;
                    const translateX = initialOffset - scrollY * 1.2;

                    setX(translateX);
                    ticking = false;
                });
                ticking = true;
            }
        },
        { passive: true }
    );
});
