// Type-only ambient declarations for environment globals used by first-party
// scripts. Never shipped — consumed by `tsc --checkJs` only. See
// docs/js-typing-strategy.md.

interface Gsap {
    quickTo: Function;
    quickSetter: Function;
    set: Function;
    to: Function;
    timeline: (vars?: object) => { to: Function };
    registerPlugin?: Function;
}

declare const gsap: Gsap;
declare const SplitText: any;

interface Window {
    __MobileDockForTesting?: { initMobileDock: () => void };
    SplitText?: any;
    __FontAwesomeLoaderForTesting?: { FontAwesomeLoader: new () => any };
    /** GSAP animation library */
    gsap?: Gsap;
    /** Cursor instances for cleanup */
    cursorInstances?: { cursor: unknown };
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

    __AmbientLoaderForTesting?: {
        shouldSkipLoader: () => boolean;
        loadLegacyAmbient: () => Promise<void>;
    };
    AppLogger?: {
        error: (msg: string, e?: unknown) => void;
        warn: (msg: string, e?: unknown) => void;
        info: (msg: string, e?: unknown) => void;
    };
    __ImageFallbackForTesting?: {
        parseFallbacks: (el: HTMLElement) => string[] | null;
        initFallback: (
            el: HTMLImageElement & { __fallbackList?: string[]; __fallbackIndex?: number }
        ) => void;
    };
    /** Asset preloader testing export */
    __AssetPreloaderForTesting?: {
        AssetPreloader: unknown;
    };
    CDNLoader?: {
        preconnect: (urls: string[]) => void;
        loadScriptSequential: (
            urls: string[],
            attrs?: { defer?: boolean; async?: boolean }
        ) => Promise<void>;
        loadCssWithFallback: (urls: string[]) => Promise<void>;
    };
    __VendorLoaderForTesting?: {
        init: () => void;
        handleVendorLoaderError: (e: unknown) => void;
        logWarning: (msg: string, e?: unknown) => void;
    };
    GoogleAnalyticsObject?: string;
    ga?: {
        (...args: unknown[]): void;
        q?: IArguments[];
        l?: number;
        create?: Function;
        send?: Function;
    };
    skipWaiting?: () => Promise<void>;
    clients?: {
        claim: () => Promise<void>;
    };
    __swForTesting?: unknown;
    __HoverPreviewForTesting?: unknown;
    ThumbHashInit?: {
        applyThumbHash: (img: HTMLImageElement, decoder?: unknown) => void;
        init: (container?: HTMLElement | Document, decoder?: unknown) => void;
    };
}

interface ExtendableEvent extends Event {
    waitUntil(f: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
    request: Request;
    respondWith(r: Promise<Response> | Response): void;
}

declare const process:
    | {
          stderr: { write: (msg: string) => void };
      }
    | undefined;
