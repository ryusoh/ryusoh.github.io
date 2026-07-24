// Type-only ambient declarations for environment globals used by first-party
// scripts. Never shipped — consumed by `tsc --checkJs` only. See
// docs/js-typing-strategy.md.

interface Gsap {
    quickTo: Function;
    set: Function;
    to: Function;
    timeline: (vars?: object) => { to: Function };
}

declare const gsap: Gsap;

interface Window {
    /** GSAP animation library */
    gsap?: Gsap;
    /** Cursor instances for cleanup */
    cursorInstances?: { cursor: unknown };
    /** Global tunables set by js/config.js and read by other page scripts. */
    PortfolioConfig?: {
        enableHoverPreview: boolean;
        enableMouseParallax: boolean;
    };
}
