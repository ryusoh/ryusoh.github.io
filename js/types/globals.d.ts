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
    /** Configuration for Ambient */
    AMBIENT_CONFIG?: {
        enabled: boolean;
        minWidth: number;
        maxParticles: number;
        densityDivisor: number;
        radius: { min: number; max: number };
        alpha: { min: number; max: number };
        speed: number;
        zIndex: number;
        blend: string;
        respectReducedMotion: boolean;
    };
    /** Default config initializer exposed for testing */
    __DefaultConfigForTesting?: {
        init: () => void;
    };
    /** Asset preloader testing export */
    __AssetPreloaderForTesting?: {
        AssetPreloader: unknown;
    };
}
