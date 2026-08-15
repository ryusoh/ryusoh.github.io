/**
 * load-animations.js
 * Creates an entrance animation for the page using GSAP and SplitText.
 */
/* global gsap, SplitText */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') {
        window.console && window.console.warn('GSAP is not loaded. Skipping load animations.');
        return;
    }

    const isReducedMotion = () =>
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const startAnimation = () => {
        const background = document.getElementById('mimida');
        const headline = document.getElementById('headline');
        const nav = document.getElementById('nav');
        const elementsToReveal = [headline, nav].filter(Boolean);

        if (isReducedMotion()) {
            if (background) {
                gsap.set(background, { scale: 1 });
            }
            if (elementsToReveal.length > 0) {
                gsap.set(elementsToReveal, { opacity: 1, y: 0 });
            }
            return;
        }

        const timeline = gsap.timeline({
            defaults: { ease: 'cubic-bezier(0.65, 0.05, 0, 1)', duration: 1.2 },
        });

        // Background scale down effect
        if (background) {
            gsap.set(background, { scale: 1.05 });
            timeline.to(
                background,
                { scale: 1, duration: 2, ease: 'cubic-bezier(0.65, 0.05, 0, 1)' },
                0
            );
        }

        const SplitTextClass =
            (typeof SplitText !== 'undefined' ? SplitText : null) ||
            (typeof window !== 'undefined' && window.SplitText ? window.SplitText : null);

        if (headline && SplitTextClass && typeof SplitTextClass === 'function') {
            try {
                if (typeof gsap.registerPlugin === 'function') {
                    gsap.registerPlugin(SplitTextClass);
                }
                const split = new SplitTextClass(headline, {
                    type: 'lines',
                    linesClass: 'headline-line',
                });
                if (split.lines && split.lines.length > 0) {
                    gsap.set(split.lines, { y: 24, opacity: 0 });
                    timeline.to(
                        split.lines,
                        {
                            y: 0,
                            opacity: 1,
                            stagger: 0.08,
                            duration: 1.0,
                            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
                        },
                        0.2
                    );
                } else {
                    gsap.set(headline, { y: 30, opacity: 0 });
                    timeline.to(headline, { y: 0, opacity: 1 }, 0.2);
                }
            } catch {
                gsap.set(headline, { y: 30, opacity: 0 });
                timeline.to(headline, { y: 0, opacity: 1 }, 0.2);
            }
        } else if (headline) {
            gsap.set(headline, { y: 30, opacity: 0 });
            timeline.to(headline, { y: 0, opacity: 1 }, 0.2);
        }

        if (nav) {
            gsap.set(nav, { y: 30, opacity: 0 });
            timeline.to(nav, { y: 0, opacity: 1 }, 0.35);
        }
    };

    if (
        typeof document !== 'undefined' &&
        document.fonts &&
        typeof document.fonts.ready?.then === 'function'
    ) {
        document.fonts.ready.then(startAnimation).catch(startAnimation);
    } else {
        startAnimation();
    }
});
