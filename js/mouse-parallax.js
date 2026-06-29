/**
 * mouse-parallax.js
 * Enhances the main title with a subtle 3D mouse parallax effect.
 */

/* global gsap */

function shouldSkipParallax() {
    if (window.PortfolioConfig && window.PortfolioConfig.enableMouseParallax === false) {
        return true;
    }
    if (typeof gsap === 'undefined') {
        window.console && window.console.warn('GSAP is not loaded. Skipping mouse parallax.');
        return true;
    }
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    if (shouldSkipParallax()) {
        return;
    }

    const title = document.querySelector('#main h1');
    if (!title) {
        return;
    }

    // We'll calculate movement relative to the center of the window
    let centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    let centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;

    /**
     * Bolt Optimization:
     * - What: Debounce resize handler using requestAnimationFrame.
     * - Why: Calculating coordinates on every resize event blocks the main thread. We only need the final values.
     * - Impact: Eliminates main-thread blocking during resize.
     */
    let resizeTimeout;
    let rafId;
    window.addEventListener(
        'resize',
        () => {
            clearTimeout(resizeTimeout);
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            resizeTimeout = setTimeout(() => {
                rafId = requestAnimationFrame(() => {
                    centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
                    centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
                });
            }, 150);
        },
        { passive: true }
    );

    /**
     * Bolt Optimization:
     * - What: Replace `gsap.to()` inside the `mousemove` listener with `gsap.quickTo()`.
     * - Why: Calling `gsap.to()` on every `mousemove` event instantiates a new tween object, causing memory churn, garbage collection overhead, and main-thread jank.
     * - Impact: Measurably reduces memory allocations and CPU usage by reusing pre-initialized setter functions for high-frequency updates.
     */
    const setX = gsap.quickTo(title, 'x', {
        duration: 0.8,
        ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
    });
    const setY = gsap.quickTo(title, 'y', {
        duration: 0.8,
        ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
    });
    const setRotationX = gsap.quickTo(title, 'rotationX', {
        duration: 0.8,
        ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
    });
    const setRotationY = gsap.quickTo(title, 'rotationY', {
        duration: 0.8,
        ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
    });

    /**
     * Bolt Optimization:
     * - What: Use IntersectionObserver to detach the `mousemove` listener when the title is off-screen.
     * - Why: The previous implementation attached a global, always-on `mousemove` listener that continuously triggered GSAP style updates even when the title was completely out of the viewport. This caused unnecessary CPU usage and GSAP ticker evaluations.
     * - Impact: Measurably reduces main-thread CPU overhead during scrolling and reading by ensuring mouse parallax computations only run when the target element is actually visible.
     */
    const handleMouseMove = (e) => {
        // Calculate offset from center (-1 to 1)
        const diffX = (e.clientX - centerX) / centerX;
        const diffY = (e.clientY - centerY) / centerY;

        // Apply a subtle parallax translation
        // Opposite direction of mouse movement
        setX(-diffX * 15);
        setY(-diffY * 15);
        setRotationY(diffX * 5); // subtle 3D rotation
        setRotationX(-diffY * 5);
    };

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                document.addEventListener('mousemove', handleMouseMove, { passive: true });
            } else {
                document.removeEventListener('mousemove', handleMouseMove);
            }
        });
        observer.observe(title);
    } else {
        document.addEventListener('mousemove', handleMouseMove, { passive: true });
    }
});
