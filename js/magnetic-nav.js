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

    magneticElements.forEach((el) => {
        /**
         * Bolt Optimization:
         * - What: Move DOM queries outside the event listener and replace `gsap.to()` with `gsap.quickTo()`.
         * - Why: Querying the DOM and instantiating new GSAP tweens on every `mousemove` tick causes memory churn and main-thread jank.
         * - Impact: Measurably reduces memory allocations and CPU usage during high-frequency events.
         */
        const child = el.querySelector('i, span, img');

        const setElX = window.gsap.quickTo(el, 'x', {
            duration: 0.3,
            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
        });
        const setElY = window.gsap.quickTo(el, 'y', {
            duration: 0.3,
            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
        });

        let setChildX;
        let setChildY;
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

        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();

            // Calculate center of element
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate distance from center to cursor
            const distX = e.clientX - centerX;
            const distY = e.clientY - centerY;

            // Apply magnetic pull using GSAP
            // Strength of pull factor (lower = less pull)
            const strength = 0.4;

            setElX(distX * strength);
            setElY(distY * strength);

            // Pull the child element (e.g. <i>) slightly more for a parallax effect
            if (child) {
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
        });
    });
}
