/** @jest-environment jsdom */

describe('quantum_particles.js', () => {
    let originalInnerWidth;
    let originalInnerHeight;

    beforeEach(() => {
        jest.resetModules();
        originalInnerWidth = window.innerWidth;
        originalInnerHeight = window.innerHeight;

        // Mock window properties
        window.innerWidth = 1024;
        window.innerHeight = 768;
        window.location.search = '';
        window.performance.now = jest.fn(() => 0);
        window.devicePixelRatio = 1;
        window.matchMedia = jest.fn().mockReturnValue({ matches: false });

        // Mock document properties
        Object.defineProperty(document, 'readyState', {
            get: () => 'complete',
            configurable: true,
        });

        // Mock console
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Mock navigator
        Object.defineProperty(navigator, 'connection', {
            get: () => ({ saveData: false }),
            configurable: true,
        });
    });

    afterEach(() => {
        window.innerWidth = originalInnerWidth;
        window.innerHeight = originalInnerHeight;
        jest.restoreAllMocks();
    });

    function getQuantumParticles() {
        return require('../../../js/ambient/quantum_particles.js');
    }

    describe('clamp', () => {
        it('should return the value when it is within the bounds', () => {
            const qp = getQuantumParticles();
            expect(qp.clamp(5, 0, 10)).toBe(5);
            expect(qp.clamp(0, -10, 10)).toBe(0);
        });

        it('should return the minimum when the value is below the bounds', () => {
            const qp = getQuantumParticles();
            expect(qp.clamp(-5, 0, 10)).toBe(0);
        });

        it('should return the maximum when the value is above the bounds', () => {
            const qp = getQuantumParticles();
            expect(qp.clamp(15, 0, 10)).toBe(10);
        });
    });

    describe('prefersReducedMotion', () => {
        it('returns false if window.matchMedia is not a function', () => {
            delete window.matchMedia;
            const qp = getQuantumParticles();
            const result = qp.prefersReducedMotion();
            expect(result).toBe(false);
        });

        it('returns true if matchMedia matches prefers-reduced-motion: reduce', () => {
            window.matchMedia.mockReturnValue({ matches: true });
            const qp = getQuantumParticles();
            const result = qp.prefersReducedMotion();
            expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
            expect(result).toBe(true);
        });

        it('returns false if matchMedia does not match prefers-reduced-motion: reduce', () => {
            window.matchMedia.mockReturnValue({ matches: false });
            const qp = getQuantumParticles();
            const result = qp.prefersReducedMotion();
            expect(result).toBe(false);
        });
    });

    describe('getForceMode', () => {
        it('should return ambient param value if provided in search', () => {
            Object.defineProperty(window, 'location', {
                value: { search: '?ambient=trace' },
                configurable: true,
            });
            const qp = getQuantumParticles();
            expect(qp.getForceMode()).toBe('trace');
        });

        it('should return null if ambient param is missing in search', () => {
            Object.defineProperty(window, 'location', {
                value: { search: '?other=value' },
                configurable: true,
            });
            const qp = getQuantumParticles();
            expect(qp.getForceMode()).toBeNull();
        });

        it('should return null if window.URLSearchParams is not a function', () => {
            const originalURLSearchParams = window.URLSearchParams;
            delete window.URLSearchParams;
            const qp = getQuantumParticles();
            expect(qp.getForceMode()).toBeNull();
            window.URLSearchParams = originalURLSearchParams;
        });
    });

    describe('hasWebGLSupport', () => {
        it('should return true if webgl context is available', () => {
            const mockCanvas = {
                getContext: jest.fn().mockReturnValue({}),
            };
            jest.spyOn(document, 'createElement').mockReturnValue(mockCanvas);
            window.WebGLRenderingContext = true;

            const qp = getQuantumParticles();
            expect(qp.hasWebGLSupport()).toBe(true);
        });

        it('should return false if getContext throws', () => {
            const mockCanvas = {
                getContext: jest.fn().mockImplementation(() => {
                    throw new Error('WebGL failed');
                }),
            };
            jest.spyOn(document, 'createElement').mockReturnValue(mockCanvas);
            const qp = getQuantumParticles();
            expect(qp.hasWebGLSupport()).toBe(false);
        });
    });

    describe('shouldSkipParticles', () => {
        beforeEach(() => {
            const mockCanvas = { getContext: jest.fn().mockReturnValue({}) };
            jest.spyOn(document, 'createElement').mockReturnValue(mockCanvas);
            window.WebGLRenderingContext = true;
        });

        it('should not skip if forceEnabled is true, ignoring other checks', () => {
            window.matchMedia.mockReturnValue({ matches: true });
            Object.defineProperty(navigator, 'connection', {
                get: () => ({ saveData: true }),
                configurable: true,
            });
            window.innerWidth = 800;
            window.WebGLRenderingContext = false;

            const qp = getQuantumParticles();
            expect(qp.shouldSkipParticles(null, true)).toBe(false);
        });

        it('should skip if prefersReducedMotion is true', () => {
            window.matchMedia.mockReturnValue({ matches: true });
            const qp = getQuantumParticles();
            expect(qp.shouldSkipParticles(null, false)).toBe(true);
        });

        it('should skip if saveData is true', () => {
            Object.defineProperty(navigator, 'connection', {
                get: () => ({ saveData: true }),
                configurable: true,
            });
            const qp = getQuantumParticles();
            expect(qp.shouldSkipParticles(null, false)).toBe(true);
        });

        it('should skip if window innerWidth is below MIN_VIEWPORT_WIDTH (1024)', () => {
            window.innerWidth = 1000;
            const qp = getQuantumParticles();
            expect(qp.shouldSkipParticles(null, false)).toBe(true);
        });

        it('should skip if WebGL is not supported', () => {
            window.WebGLRenderingContext = false;
            const qp = getQuantumParticles();
            expect(qp.shouldSkipParticles(null, false)).toBe(true);
        });

        it('should not skip when all checks pass', () => {
            window.innerWidth = 1200;
            window.matchMedia.mockReturnValue({ matches: false });
            const qp = getQuantumParticles();
            expect(qp.shouldSkipParticles(null, false)).toBe(false);
        });
    });
});
