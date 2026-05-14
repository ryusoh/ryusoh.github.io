/**
 * scroll-marquee.js
 * Implements a scroll-linked infinite marquee for the homepage.
 */

(function () {
    'use strict';

    if (typeof document === 'undefined') {
        return;
    }

    function initMarquee() {
        if (!window.gsap) {
            return;
        }

        const marqueeInner = document.querySelector('.scroll-marquee__inner');
        if (!marqueeInner) {
            return;
        }

        let loopWidth = 0;
        const isTouchDevice =
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            (window.matchMedia && window.matchMedia('(hover: none)').matches);

        function calculateWidth() {
            // Wait for fonts to load or just calculate directly
            const singleText = marqueeInner.querySelector('.scroll-marquee__text');
            if (singleText) {
                // Strictly uses the actual rendered width of a single repeating text segment
                loopWidth = marqueeInner.scrollWidth / 2;
            }
        }

        calculateWidth();
        window.addEventListener('resize', calculateWidth, { passive: true });

        // Pre-initialize GSAP setter for high-frequency updates
        const setX = window.gsap.quickSetter(marqueeInner, 'x', 'px');

        function updateMarquee() {
            if (loopWidth <= 0) {
                return;
            }

            // Scroll is narrative: use window.scrollY to drive the translation
            // Do not use modulus against window.innerWidth
            const currentScroll = window.scrollY;

            // Speed factor for the marquee
            let translation = -(currentScroll * 0.8) % loopWidth;

            if (translation > 0) {
                translation -= loopWidth;
            }

            setX(translation);
        }

        // Use requestAnimationFrame loop or scroll event.
        // Scroll event combined with requestAnimationFrame is efficient.
        let ticking = false;
        window.addEventListener(
            'scroll',
            function () {
                if (!ticking) {
                    window.requestAnimationFrame(function () {
                        updateMarquee();
                        ticking = false;
                    });
                    ticking = true;
                }
            },
            { passive: true }
        );

        // Initial paint
        updateMarquee();

        // Testing exposure
        if (typeof window !== 'undefined') {
            window.__ScrollMarqueeForTesting = {
                calculateWidth,
                updateMarquee,
                isTouchDevice,
            };
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMarquee);
    } else {
        initMarquee();
    }
})();
