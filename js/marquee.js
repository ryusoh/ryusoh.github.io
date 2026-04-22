/**
 * marquee.js
 * Implements a scroll-linked marquee effect for the home page.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Only run on the home page
    if (document.body.getAttribute('data-page-type') !== 'home') {
        return;
    }

    const nav = document.getElementById('nav');
    if (!nav) {
        return;
    }

    // Create Marquee Container
    const marqueeWrapper = document.createElement('div');
    marqueeWrapper.className = 'marquee-wrapper';
    marqueeWrapper.setAttribute('aria-hidden', 'true'); // Decorative only

    const marqueeInner = document.createElement('div');
    marqueeInner.className = 'marquee-inner';

    // Text content to repeat
    const textPart1 = 'San Francisco ';
    const textPart2 = 'Street Photography ';
    const span1 = `<span class="sans-serif">${textPart1}</span>`;
    const span2 = `<span class="serif" style="font-weight: 400; font-style: italic;">${textPart2}</span>`;
    const combined = span1 + span2;

    // Repeat enough times to cover standard screen widths
    marqueeInner.innerHTML = combined.repeat(10);
    marqueeWrapper.appendChild(marqueeInner);

    // Insert immediately after nav
    nav.parentNode.insertBefore(marqueeWrapper, nav.nextSibling);

    let ticking = false;

    // Scroll-linked animation
    const updateMarquee = () => {
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        // Adjust the multiplier to control speed
        const translateX = -(scrollY * 0.5);
        marqueeInner.style.transform = `translate3d(${translateX}px, 0, 0)`;
        ticking = false;
    };

    window.addEventListener(
        'scroll',
        () => {
            if (!ticking) {
                window.requestAnimationFrame(updateMarquee);
                ticking = true;
            }
        },
        { passive: true }
    );
});
