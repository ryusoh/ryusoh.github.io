/**
 * Magnetic Navigation effect
 */
export function initMagneticNav() {
    if (typeof window === 'undefined' || !window.gsap) {
        return;
    }

    // Check for touch devices - usually magnetic hover feels bad on touch
    const isTouchDevice =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (window.matchMedia && window.matchMedia('(hover: none)').matches);

    if (isTouchDevice) {
        return;
    }

    // Target social icons
    // .social-icons-container a: main page headline icons
    const magneticElements = document.querySelectorAll('.social-icons-container a');

    /**
     * Bolt Optimization:
     * - What: Replaced `gsap.to()` calls within the `mousemove` listener with `gsap.quickTo()` defined outside,
     *         and cached `getBoundingClientRect()` on `mouseenter`.
     * - Why: Synchronous DOM layout reads (`getBoundingClientRect`) during high-frequency pointer events cause layout
     *        thrashing and main-thread blocking. Additionally, calling `gsap.to()` on every tick instantiates new
     *        tween objects leading to memory churn and garbage collection stutter.
     * - Impact: Measurably reduces main-thread jank, layout calculations, and memory allocations by avoiding continuous
     *           DOM reads and tween object creation during interaction.
     */
    magneticElements.forEach((el) => {
        let cachedRect = null;
        const child = el.querySelector('i, span, img');

        const setElX = window.gsap.quickTo(el, 'x', {
            duration: 0.3,
            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
        });
        const setElY = window.gsap.quickTo(el, 'y', {
            duration: 0.3,
            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
        });

        let setChildX = null;
        let setChildY = null;
        if (child) {
            setChildX = window.gsap.quickTo(child, 'x', {
                duration: 0.3,
                ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
            });
            setChildY = window.gsap.quickTo(child, 'y', {
                duration: 0.3,
                ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
            });
        }

        el.addEventListener('mouseenter', () => {
            cachedRect = el.getBoundingClientRect();
        });

        el.addEventListener('mousemove', (e) => {
            if (!cachedRect) {
                cachedRect = el.getBoundingClientRect();
            }

            // Calculate center of element
            const centerX = cachedRect.left + cachedRect.width / 2;
            const centerY = cachedRect.top + cachedRect.height / 2;

            // Calculate distance from center to cursor
            const distX = e.clientX - centerX;
            const distY = e.clientY - centerY;

            // Apply magnetic pull using GSAP
            // Strength of pull factor (lower = less pull)
            const strength = 0.4;

            setElX(distX * strength);
            setElY(distY * strength);

            // Pull the child element (e.g. <i>) slightly more for a parallax effect
            if (child && setChildX && setChildY) {
                setChildX(distX * (strength * 1.5));
                setChildY(distY * (strength * 1.5));
            }
        });

        el.addEventListener('mouseleave', () => {
            // Elastic snap back to origin
            window.gsap.to(el, {
                x: 0,
                y: 0,
                duration: 0.7,
                ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
            });

            if (child) {
                window.gsap.to(child, {
                    x: 0,
                    y: 0,
                    duration: 0.7,
                    ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
                });
            }
            cachedRect = null;
        });
    });
}
