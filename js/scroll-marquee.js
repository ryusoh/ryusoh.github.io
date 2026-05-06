/**
 * scroll-marquee.js
 * Implements an infinite scroll-linked marquee effect for project footers.
 */

/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') {
        window.console && window.console.warn('GSAP is not loaded. Skipping scroll marquee.');
        return;
    }

    const marquees = document.querySelectorAll('.marquee-container');
    if (marquees.length === 0) {
        return;
    }

    marquees.forEach((container) => {
        const track = container.querySelector('.marquee-track');
        if (!track) {
            return;
        }

        let loopWidth = 0;
        const setX = gsap.quickSetter(track, 'x', 'px');

        let currentScroll = window.scrollY || 0;
        let targetScroll = window.scrollY || 0;
        let ambientOffset = 0;
        const ambientSpeed = 0.5; // continuous movement speed

        function updateLayout() {
            // The content is duplicated exactly once.
            // The true repeating segment width is strictly scrollWidth / 2.
            loopWidth = track.scrollWidth / 2;
        }

        updateLayout();
        window.addEventListener('resize', updateLayout, { passive: true });

        function lerp(start, end, factor) {
            return start + (end - start) * factor;
        }

        function tick() {
            // Damping for smooth scroll intent
            currentScroll = lerp(currentScroll, targetScroll, 0.08);

            // Continuous motion
            ambientOffset += ambientSpeed;

            if (loopWidth > 0) {
                // Scroll-linked factor + ambient motion
                const rawX = -(ambientOffset + currentScroll * 0.8);

                // Modulo wrapper for infinite loop
                let currentX = rawX % loopWidth;

                // In JS, -5 % 3 = -2. If rawX somehow becomes positive, wrap it negatively.
                if (currentX > 0) {
                    currentX -= loopWidth;
                }

                setX(currentX);
            }

            requestAnimationFrame(tick);
        }

        window.addEventListener(
            'scroll',
            () => {
                targetScroll = window.scrollY;
            },
            { passive: true }
        );

        // Start animation
        requestAnimationFrame(tick);
    });
});
