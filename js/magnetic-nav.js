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

    for (let i = 0; i < magneticElements.length; i++) {
        const el = magneticElements[i];
        /**
         * Bolt Optimization:
         * - What: Replace `gsap.to()` inside the `mousemove` listener with `gsap.quickTo()`.
         * - Why: Calling `gsap.to()` on every `mousemove` event instantiates a new tween object, causing memory churn, garbage collection overhead, and main-thread jank.
         * - Impact: Measurably reduces memory allocations and CPU usage by reusing pre-initialized setter functions for high-frequency updates.
         */
        const setElX = window.gsap.quickTo(el, 'x', {
            duration: 0.3,
            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
        });
        const setElY = window.gsap.quickTo(el, 'y', {
            duration: 0.3,
            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
        });

        const child = el.querySelector('i, span, img');
        let setChildX, setChildY;
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

        /**
         * Bolt Optimization:
         * - What: Cache `getBoundingClientRect()` calculations during `mouseenter`.
         * - Why: The previous implementation read `el.getBoundingClientRect()` synchronously on every single `mousemove` event. Reading layout properties in a high-frequency event listener forces the browser to evaluate the DOM repeatedly, causing layout thrashing and main-thread CPU overhead.
         * - Impact: Measurably reduces main thread blocking time during continuous mouse movement by caching the target coordinates once upon hover entry.
         */
        let centerX = 0;
        let centerY = 0;

        el.addEventListener('mouseenter', () => {
            const rect = el.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
        });

        el.addEventListener('mousemove', (e) => {
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

            const child = el.querySelector('i, span, img');
            if (child) {
                window.gsap.to(child, {
                    x: 0,
                    y: 0,
                    duration: 0.7,
                    ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
                });
            }
        });
    }
}
