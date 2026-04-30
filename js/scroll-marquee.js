/**
 * scroll-marquee.js
 * Implements a scroll-linked infinite marquee for portfolio pages.
 *
 * Passing the Lando Norris Test:
 * - "Scroll is narrative, not just navigation. ... scroll-linked marquees ...
 *   the user's scroll input should direct the experience."
 * - "Mask and clip, don't box." (We will apply some masking to the text)
 * - "Typography is the design." (Using bold dramatic sans or serif for the background text)
 */

(function () {
    'use strict';

    // Only run on project pages
    if (!document.body || document.body.getAttribute('data-page-type') !== 'project') {
        return;
    }

    // Respect reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    // Create the marquee container
    const marqueeWrapper = document.createElement('div');
    marqueeWrapper.className = 'scroll-marquee-wrapper';
    marqueeWrapper.setAttribute('aria-hidden', 'true'); // Decorative only

    const marqueeContent = document.createElement('div');
    marqueeContent.className = 'scroll-marquee-content';

    // Get the post title to use as the marquee text
    const titleEl = document.querySelector('.post-heading h1');
    const text = titleEl ? titleEl.textContent + ' — ' : 'ZHUANG LIU PHOTOGRAPHY — ';

    // Duplicate text to ensure it's wide enough for a smooth infinite loop
    marqueeContent.textContent = text.repeat(10);

    marqueeWrapper.appendChild(marqueeContent);
    document.body.appendChild(marqueeWrapper);

    let baseOffset = 0;

    // Use requestAnimationFrame for smooth GPU-backed animation
    function updateMarquee() {
        // baseOffset adds a slow ambient drift
        baseOffset += 0.5;

        // Add scroll position for the scroll-linked effect
        // Multiply scroll by a factor to make it feel responsive
        const scrollFactor = window.scrollY * 0.5;

        // Calculate total offset
        const totalOffset = baseOffset + scrollFactor;

        // Apply modulo on a reasonable width to loop it
        // The text is long enough that 2000px is safe to loop on
        // Avoid window.innerWidth modulus as per memory guidelines
        const textWidth = marqueeContent.scrollWidth / 2;
        const loopWidth = textWidth > 0 ? textWidth : 2000;
        const offset = totalOffset % loopWidth;

        marqueeContent.style.transform = `translate3d(-${offset}px, 0, 0)`;

        requestAnimationFrame(updateMarquee);
    }

    // Start the loop
    requestAnimationFrame(updateMarquee);
})();
