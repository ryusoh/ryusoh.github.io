/**
 * marquee.js
 * A GPU-backed, scroll-linked infinite marquee.
 *
 * Implements a continuous scroll effect that accelerates based on scroll velocity.
 * Uses a single unified easing curve and strict modulus boundaries based on actual rendered width.
 */

/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') {
        window.console && window.console.warn('GSAP is not loaded. Skipping marquee.');
        return;
    }

    const containers = document.querySelectorAll('.marquee-container');

    if (containers.length === 0) {
        return;
    }

    // Reveal marquee alongside main animations
    gsap.to(containers, {
        opacity: 1,
        duration: 1.2,
        delay: 0.3, // Matches other elements in load-animations.js
        ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
    });

    containers.forEach((container) => {
        const content = container.querySelector('.marquee-content');
        if (!content) {
            return;
        }

        // Ensure we have exactly two children (the span elements) for perfect looping
        // The first span is the primary content, the second is the duplicate.
        const spans = content.querySelectorAll('span');
        if (spans.length !== 2) {
            return;
        }

        const firstSpan = spans[0];

        let loopWidth = 0;
        let currentX = 0;
        const baseSpeed = -1; // Base movement per frame (pixels)
        let scrollVelocity = 0;
        let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Use gsap.quickSetter for high-performance updates
        const setX = gsap.quickSetter(content, 'x', 'px');

        function calculateWidths() {
            // Memory Rule: loopWidth must strictly use actual rendered width of the repeating segment
            // This ensures modulus % loopWidth works seamlessly without visual jumping
            loopWidth = firstSpan.getBoundingClientRect().width;
        }

        function update() {
            if (loopWidth === 0) {
                return;
            }

            // Add base speed + extra speed from scroll velocity
            currentX += baseSpeed - scrollVelocity;

            // Decay scroll velocity smoothly using the brand easing curve feel
            // (though this is simple lerp, it maintains purposeful motion)
            scrollVelocity *= 0.9;

            // Wrap strictly using actual loop width
            currentX = currentX % loopWidth;

            // Apply bounds correctly (currentX is negative as it moves left)
            if (currentX > 0) {
                currentX -= loopWidth;
            } else if (currentX <= -loopWidth) {
                currentX += loopWidth;
            }

            setX(currentX);

            requestAnimationFrame(update);
        }

        function onScroll() {
            const st = window.pageYOffset || document.documentElement.scrollTop;
            const delta = st - lastScrollTop;

            // Add to scroll velocity. Adjust multiplier for responsiveness.
            scrollVelocity = delta * 0.25;

            lastScrollTop = st;
        }

        // Initialize
        calculateWidths();

        // Setup Resize Observer to recalculate widths if fonts/layout change
        const resizeObserver = new window.ResizeObserver(() => {
            calculateWidths();
        });
        resizeObserver.observe(firstSpan);

        // Start animation loop
        requestAnimationFrame(update);

        // Scroll listeners
        window.addEventListener('scroll', onScroll, { passive: true });
    });
});
