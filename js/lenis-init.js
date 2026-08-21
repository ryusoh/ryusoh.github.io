/**
 * @fileoverview Initializes Lenis smooth momentum scrolling on portfolio pages.
 * Bounded with prefers-reduced-motion checks and integrated with window scroll events.
 */
/* global module, Lenis */
(function () {
    'use strict';

    function isReducedMotion() {
        return (
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
    }

    /**
     * @param {Record<string, unknown>=} options
     * @returns {Lenis | null}
     */
    function initLenis(options) {
        if (isReducedMotion()) {
            return null;
        }

        const LenisClass =
            (typeof Lenis !== 'undefined' ? Lenis : null) ||
            (typeof window !== 'undefined' && window.Lenis ? window.Lenis : null) ||
            (typeof globalThis !== 'undefined' &&
            /** @type {Object & { Lenis?: typeof Lenis }} */ (globalThis).Lenis
                ? /** @type {Object & { Lenis?: typeof Lenis }} */ (globalThis).Lenis
                : null);

        if (!LenisClass) {
            return null;
        }

        try {
            const lenis = new LenisClass(
                Object.assign(
                    {
                        autoRaf: true,
                        duration: 1.1,
                        easing: (/** @type {number} */ t) =>
                            Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                        smoothWheel: true,
                        touchMultiplier: 1.5,
                    },
                    options
                )
            );

            if (typeof window !== 'undefined') {
                window.lenis = lenis;
            }

            return lenis;
        } catch (e) {
            if (
                typeof window !== 'undefined' &&
                window.console &&
                typeof window.console.warn === 'function'
            ) {
                window.console.warn('[LenisInit] Lenis instantiation failed:', e);
            }
            return null;
        }
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                initLenis();
            });
        } else {
            initLenis();
        }
    }

    const api = {
        initLenis,
        isReducedMotion,
    };

    if (typeof window !== 'undefined') {
        window.LenisInit = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
