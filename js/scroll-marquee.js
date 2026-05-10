/**
 * scroll-marquee.js
 * Implements a scroll-linked infinite marquee.
 */

/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    if (
        typeof gsap === 'undefined' ||
        typeof gsap.plugins === 'undefined' ||
        typeof gsap.plugins.ScrollTrigger === 'undefined'
    ) {
        window.console &&
            window.console.warn('GSAP or ScrollTrigger not loaded. Skipping scroll marquee.');
        return;
    }

    const marquees = document.querySelectorAll('.scroll-marquee-container');

    marquees.forEach((container) => {
        const content = container.querySelector('.scroll-marquee-content');
        if (!content) {
            return;
        }

        const textSpan = content.querySelector('.scroll-marquee-text');
        if (!textSpan) {
            return;
        }

        // Duplicate content for seamless loop
        const numCopies = 6;
        for (let i = 0; i < numCopies; i++) {
            content.appendChild(textSpan.cloneNode(true));
        }

        // Wait for next frame to ensure layout is ready
        requestAnimationFrame(() => {
            const singleSpanWidth = textSpan.getBoundingClientRect().width;

            if (singleSpanWidth === 0) {
                return;
            }

            let xPos = 0;

            const xSetter = gsap.quickTo(content, 'x', {
                ease: 'power3.out',
                duration: 0.5,
            });

            let lastScrollY = window.scrollY;

            window.addEventListener(
                'scroll',
                () => {
                    const currentScrollY = window.scrollY;
                    const deltaY = currentScrollY - lastScrollY;
                    lastScrollY = currentScrollY;

                    // Keep moving left
                    xPos -= deltaY * 0.8;

                    // Keep xPos within [ -singleSpanWidth, 0 ]
                    if (xPos <= -singleSpanWidth) {
                        xPos += singleSpanWidth;
                    } else if (xPos > 0) {
                        xPos -= singleSpanWidth;
                    }

                    xSetter(xPos);
                },
                { passive: true }
            );

            // Trigger an initial update to set position
            xSetter(0);
        });
    });
});
