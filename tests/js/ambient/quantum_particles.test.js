const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Consolidated tests for quantum_particles.js
 */

const sourcePath = path.resolve(__dirname, '../../../js/ambient/quantum_particles.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('quantum_particles.js', () => {
    let context;

    beforeEach(() => {
        jest.clearAllMocks();

        // Prepare context for VM
        context = {
            window: {
                matchMedia: jest.fn(),
                addEventListener: jest.fn(),
                innerWidth: 1024,
                innerHeight: 768,
                location: { search: '' },
                performance: { now: jest.fn(() => 0) },
                requestAnimationFrame: jest.fn(),
                URLSearchParams: require('url').URLSearchParams,
                devicePixelRatio: 1,
            },
            document: {
                readyState: 'complete',
                addEventListener: jest.fn(),
                createElement: jest.fn(),
                body: {
                    appendChild: jest.fn(),
                },
            },
            navigator: {
                connection: { saveData: false },
            },
            console: {
                error: jest.fn(),
                warn: jest.fn(),
                log: jest.fn(),
            },
            Math: Math,
            Date: Date,
            setTimeout: jest.fn((fn) => fn()),
            Promise: Promise,
        };

        // Ensure circular references work
        context.window.document = context.document;
        context.document.defaultView = context.window;

        vm.createContext(context);

        // We wrap in try-catch to ignore load-time execution errors
        // (like failing to import 'three' which we'll mock if needed)
        try {
            vm.runInContext(code, context);
        } catch {
            // Ignore
        }
    });

    describe('clamp', () => {
        it('should return the value when it is within the bounds', () => {
            const clamp = context.clamp;
            expect(clamp(5, 0, 10)).toBe(5);
            expect(clamp(0, -10, 10)).toBe(0);
        });

        it('should return the minimum when the value is below the bounds', () => {
            const clamp = context.clamp;
            expect(clamp(-5, 0, 10)).toBe(0);
        });

        it('should return the maximum when the value is above the bounds', () => {
            const clamp = context.clamp;
            expect(clamp(15, 0, 10)).toBe(10);
        });
    });

    describe('prefersReducedMotion', () => {
        it('returns false if window.matchMedia is not a function', () => {
            context.window.matchMedia = undefined;
            const result = context.prefersReducedMotion();
            expect(result).toBe(false);
        });

        it('returns true if matchMedia matches prefers-reduced-motion: reduce', () => {
            context.window.matchMedia.mockReturnValue({ matches: true });
            // Since prefersReducedMotion caches the result, we need to reset the cache if it was set
            vm.runInContext('prefersReducedMotionMediaQuery = null;', context);
            const result = context.prefersReducedMotion();
            expect(context.window.matchMedia).toHaveBeenCalledWith(
                '(prefers-reduced-motion: reduce)'
            );
            expect(result).toBe(true);
        });

        it('returns false if matchMedia does not match prefers-reduced-motion: reduce', () => {
            context.window.matchMedia.mockReturnValue({ matches: false });
            vm.runInContext('prefersReducedMotionMediaQuery = null;', context);
            const result = context.prefersReducedMotion();
            expect(result).toBe(false);
        });
    });

    describe('getForceMode', () => {
        it('should return ambient param value if provided in search', () => {
            context.window.location.search = '?ambient=trace';
            expect(context.getForceMode()).toBe('trace');
        });

        it('should return null if ambient param is missing in search', () => {
            context.window.location.search = '?other=value';
            expect(context.getForceMode()).toBeNull();
        });

        it('should return null if window.URLSearchParams is not a function', () => {
            context.window.URLSearchParams = undefined;
            expect(context.getForceMode()).toBeNull();
        });
    });

    describe('hasWebGLSupport', () => {
        it('should return true if webgl context is available', () => {
            const mockCanvas = {
                getContext: jest.fn().mockReturnValue({}),
            };
            context.document.createElement.mockReturnValue(mockCanvas);
            context.window.WebGLRenderingContext = true;

            expect(context.hasWebGLSupport()).toBe(true);
            expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl', {
                failIfMajorPerformanceCaveat: true,
            });
        });

        it('should return false if getContext throws', () => {
            const mockCanvas = {
                getContext: jest.fn().mockImplementation(() => {
                    throw new Error('WebGL failed');
                }),
            };
            context.document.createElement.mockReturnValue(mockCanvas);
            expect(context.hasWebGLSupport()).toBe(false);
        });
    });

    describe('shouldSkipParticles', () => {
        let shouldSkipParticles;

        beforeEach(() => {
            shouldSkipParticles = context.window.__QuantumParticlesForTesting.shouldSkipParticles;
            // Setup default 'pass' conditions
            context.window.matchMedia.mockReturnValue({ matches: false });
            context.navigator.connection.saveData = false;
            context.window.innerWidth = 1200;

            const mockCanvas = { getContext: jest.fn().mockReturnValue({}) };
            context.document.createElement.mockReturnValue(mockCanvas);
            context.window.WebGLRenderingContext = true;
        });

        it('should not skip if forceEnabled is true, ignoring other checks', () => {
            // Set all checks to fail
            context.window.matchMedia.mockReturnValue({ matches: true });
            context.navigator.connection.saveData = true;
            context.window.innerWidth = 800;
            context.window.WebGLRenderingContext = false;

            expect(shouldSkipParticles(null, true)).toBe(false);
        });

        it('should skip if prefersReducedMotion is true', () => {
            context.window.matchMedia.mockReturnValue({ matches: true });
            vm.runInContext('prefersReducedMotionMediaQuery = null;', context);
            expect(shouldSkipParticles(null, false)).toBe(true);
        });

        it('should skip if saveData is true', () => {
            context.navigator.connection.saveData = true;
            vm.runInContext('prefersReducedMotionMediaQuery = null;', context);
            expect(shouldSkipParticles(null, false)).toBe(true);
        });

        it('should skip if window innerWidth is below MIN_VIEWPORT_WIDTH (1024)', () => {
            context.window.innerWidth = 1000;
            expect(shouldSkipParticles(null, false)).toBe(true);
        });

        it('should skip if WebGL is not supported', () => {
            context.window.WebGLRenderingContext = false;
            expect(shouldSkipParticles(null, false)).toBe(true);
        });

        it('should not skip when all checks pass', () => {
            expect(shouldSkipParticles(null, false)).toBe(false);
        });
    });
});
