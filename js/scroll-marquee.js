/**
 * scroll-marquee.js
 * Implements a scroll-linked infinite marquee background.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if the user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        return; // Do not animate marquee if reduced motion is preferred
    }

    const container = document.querySelector('.scroll-marquee-container');
    const content = document.querySelector('.scroll-marquee-content');

    if (!container || !content) {
        return;
    }

    // Duplicate content to allow for seamless looping
    // We add an extra space at the end to ensure separation
    const originalText = content.textContent;
    content.textContent = `${originalText} \u00A0 \u00A0 ${originalText}`;

    let scrollPos = 0;

    const updateMarquee = () => {
        // Calculate dynamic width based on the rendered scrollWidth
        // We divide by 2 since we duplicated the text exactly once
        const loopWidth = content.scrollWidth / 2;

        // Link translation to scroll position
        // We use scrollY to drive the position directly
        scrollPos = window.scrollY;

        // Use modulus to loop seamlessly
        let xPos = -(scrollPos % loopWidth);

        // If we want a parallax speed multiplier we can apply it here
        // e.g. scrollPos * 0.5
        xPos = -((scrollPos * 0.5) % loopWidth);

        content.style.transform = `translate3d(${xPos}px, 0, 0)`;

        requestAnimationFrame(updateMarquee);
    };

    // Use requestAnimationFrame for smooth, continuous updates
    requestAnimationFrame(updateMarquee);
});
