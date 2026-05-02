/**
 * scroll-marquee.js
 * Infinite scroll-linked marquee driven by GSAP and requestAnimationFrame.
 * Velocity increases the scroll speed, and direction reverses based on scroll direction.
 */

/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    const marqueeInner = document.querySelector('.marquee-inner');
    if (!marqueeInner || typeof gsap === 'undefined') {
        return;
    }

    let currentScroll = 0;
    let isScrollingDown = true;

    // QuickSetter for performant X translation
    const setX = gsap.quickSetter(marqueeInner, 'x', 'px');

    let scrollPos = 0;
    let velocity = 0;

    window.addEventListener('scroll', () => {
        const newScrollPos = window.scrollY;
        isScrollingDown = newScrollPos > scrollPos;
        velocity = Math.abs(newScrollPos - scrollPos);
        scrollPos = newScrollPos;
    });

    const loop = () => {
        // Fallback or exact width based on the rendered content.
        // We assume marqueeInner has 2 exactly identical children,
        // so loopWidth is half the total scrollWidth.
        const loopWidth = marqueeInner.scrollWidth / 2;

        // Base speed plus scroll velocity multiplier
        const speed = 1 + velocity * 0.1;

        // Decay velocity
        velocity *= 0.9;

        if (isScrollingDown) {
            currentScroll -= speed;
        } else {
            currentScroll += speed;
        }

        // Handle infinite loop logic strictly using the modulo of loopWidth
        // This prevents snapping/jumping
        if (currentScroll < -loopWidth) {
            currentScroll += loopWidth;
        } else if (currentScroll > 0) {
            currentScroll -= loopWidth;
        }

        setX(currentScroll);
        requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
});
