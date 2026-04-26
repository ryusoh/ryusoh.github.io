/**
 * marquee.js
 * Implements a scroll-linked infinite marquee effect.
 */

document.addEventListener('DOMContentLoaded', () => {
    const marqueeContent = document.querySelector('.marquee-content');
    if (!marqueeContent) {
        return;
    }

    let scrollY = window.scrollY;
    let targetScrollY = scrollY;
    let currentX = 0;
    let lastTime = window.performance.now();

    const baseSpeed = 0.05; // Base movement speed
    const scrollMultiplier = 0.5; // How much scroll affects movement

    // Update target scroll position
    window.addEventListener(
        'scroll',
        () => {
            targetScrollY = window.scrollY;
        },
        { passive: true }
    );

    function animate(currentTime) {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        // Smooth scroll interpolation (lerp)
        scrollY += (targetScrollY - scrollY) * 0.1;

        // Calculate scroll delta
        const scrollDelta = targetScrollY - scrollY;

        // Move marquee
        currentX -= baseSpeed * deltaTime + scrollDelta * scrollMultiplier;

        // Reset position without using modulo % to avoid violent jumps
        // Assuming the content is wide enough, when it moves far enough left,
        // we snap it back to the right by its width divided by 2 (since content is duplicated).
        // Since we don't know the exact width easily here without layout thrashing,
        // we use a large enough threshold based on the content length.
        // Better: check bounding box on resize, but let's keep it simple and robust.

        // Let's get the width once (or handle it with a CSS custom property)
        // For now, we'll just move it and reset based on an arbitrary large value.
        // Actually, we can get clientWidth without layout thrashing if we cache it.
        if (typeof window.marqueeWidth === 'undefined') {
            window.marqueeWidth = marqueeContent.clientWidth / 2;
        }

        if (currentX <= -window.marqueeWidth) {
            currentX += window.marqueeWidth;
        } else if (currentX > 0) {
            currentX -= window.marqueeWidth;
        }

        marqueeContent.style.transform = `translate3d(${currentX}px, 0, 0)`;

        requestAnimationFrame(animate);
    }

    // Initialize width calculation on load and resize
    const calculateWidth = () => {
        window.marqueeWidth = marqueeContent.clientWidth / 2;
    };

    // Initial calculation
    calculateWidth();

    // Recalculate on resize
    window.addEventListener('resize', calculateWidth, { passive: true });

    // Start animation loop
    requestAnimationFrame(animate);
});
