// Type-only ambient declarations for environment globals used by first-party
// scripts. Never shipped — consumed by `tsc --checkJs` only. See
// docs/js-typing-strategy.md.

interface Window {
    /** Global tunables set by js/config.js and read by other page scripts. */
    PortfolioConfig?: {
        enableHoverPreview: boolean;
        enableMouseParallax: boolean;
    };
}
