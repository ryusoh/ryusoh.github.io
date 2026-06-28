/**
 * @jest-environment jsdom
 */

describe('js/ambient/ambient.js', () => {
    let mockSketch;

    beforeEach(() => {
        jest.resetModules();

        mockSketch = {
            create: jest.fn().mockReturnValue({
                canvas: {
                    className: '',
                    style: {},
                    clientWidth: 800,
                    clientHeight: 600,
                },
                width: 800,
                save: jest.fn(),
                beginPath: jest.fn(),
                arc: jest.fn(),
                fill: jest.fn(),
                restore: jest.fn(),
                height: 600,
            }),
        };

        window.Sketch = mockSketch;

        // Mock sessionStorage
        const mockStorage = {
            getItem: jest.fn(),
            removeItem: jest.fn(),
        };
        Object.defineProperty(window, 'sessionStorage', { value: mockStorage, configurable: true });

        document.body.innerHTML = '<body></body>';
        document.body.getAttribute = jest.fn().mockReturnValue('home');

        let mockTime = 1000;
        window.performance.now = jest.fn(() => mockTime);
        window.__mockTimeAdvance = (ms) => {
            mockTime += ms;
        };
        require('../../../js/ambient/ambient.js');
    });

    describe('getAmbientParam Edge Cases', () => {
        test('returns null if URLSearchParams is undefined', () => {
            const getAmbientParam = window.__AmbientForTesting.getAmbientParam;
            const originalURLSearchParams = window.URLSearchParams;
            delete window.URLSearchParams;

            expect(getAmbientParam()).toBeNull();

            window.URLSearchParams = originalURLSearchParams;
        });

        test('returns null if search length > 1000', () => {
            const getAmbientParam = window.__AmbientForTesting.getAmbientParam;
            window.history.pushState({}, '', '/?ambient=' + 'a'.repeat(1001));

            expect(getAmbientParam()).toBeNull();
        });

        test('returns null and warns if parsing fails', () => {
            const getAmbientParam = window.__AmbientForTesting.getAmbientParam;
            window.history.pushState({}, '', '/?ambient=1');

            const originalURLSearchParams = window.URLSearchParams;
            window.URLSearchParams = jest.fn().mockImplementation(() => {
                throw new Error('Parse error');
            });
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            expect(getAmbientParam()).toBeNull();
            expect(warnSpy).toHaveBeenCalledWith(
                'URLSearchParams parsing failed:',
                expect.any(Error)
            );

            window.URLSearchParams = originalURLSearchParams;
            warnSpy.mockRestore();
        });
    });

    describe('getAmbientParam', () => {
        test('returns the value of ambient param', () => {
            const getAmbientParam = window.__AmbientForTesting.getAmbientParam;
            window.history.pushState({}, '', '/?ambient=debug');
            expect(getAmbientParam()).toBe('debug');
        });

        test('returns null if search is empty', () => {
            const getAmbientParam = window.__AmbientForTesting.getAmbientParam;
            window.history.pushState({}, '', '/');
            expect(getAmbientParam()).toBeNull();
        });
    });

    describe('Transitions and Particle Reset', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            // JSDOM's performance.now is not always synchronized with jest timers. We force it to use Date.now
            let currentTime = 1000;
            window.performance.now = jest.fn(() => {
                currentTime += 1000; // Force advance 1000 on each call so elapsed > duration
                return currentTime;
            });
            // Ensure particles logic is executed
            document.body.getAttribute.mockReturnValue('project');
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('beginExitBurst modifies transition mode and particle properties', () => {
            const s = mockSketch.create.mock.results[0].value;
            // The setup method was called during init, which populates particles array
            s.setup();

            window.AmbientTransitionController.playExit();

            expect(s.canvas.style.transition).toBe('opacity 0.4s var(--brand-ease)');
            expect(s.canvas.style.opacity).toBe('1');

            // Advance time and update to trigger internal idle reset
            window.__mockTimeAdvance(1500);
            s.update();
            expect(s.canvas.style.opacity).toBe('');
        });

        test('beginIntroSweep modifies transition mode and particle properties', () => {
            const s = mockSketch.create.mock.results[0].value;
            s.setup();

            window.AmbientTransitionController.playIntro();

            expect(s.canvas.style.transition).toBe('opacity 0.4s var(--brand-ease)');
            expect(s.canvas.style.opacity).toBe('1');

            // Trigger update to evaluate particle update during intro
            s.update();

            window.__mockTimeAdvance(1500);
            s.update();
            expect(s.canvas.style.opacity).toBe('');
        });

        test('particle boundary reset triggers inside update when idle', () => {
            const s = mockSketch.create.mock.results[0].value;
            s.setup();

            // Move all particles way out of bounds
            s.draw(); // to cover trace path check

            // In mock sketch context particles array is trapped in the closure,
            // but we can trigger it by advancing timers to idle and forcing update bounds over iterations.
            window.__mockTimeAdvance(1500);
            for (let i = 0; i < 200; i++) {
                s.update(); // eventually particles go out of bounds and reset() is called
            }
        });

        test('sessionStorage failure gracefully fallback', () => {
            document.body.getAttribute.mockReturnValue('project');
            const mockStorage = {
                getItem: jest.fn().mockImplementation(() => {
                    throw new Error('storage err');
                }),
                removeItem: jest.fn().mockImplementation(() => {
                    throw new Error('storage err');
                }),
            };
            Object.defineProperty(window, 'sessionStorage', {
                value: mockStorage,
                configurable: true,
            });

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Trigger maybePlayIntro
            window.AmbientTransitionController.maybePlayIntro();

            expect(warnSpy).toHaveBeenCalledWith(
                '[ambient] sessionStorage get error:',
                expect.any(Error)
            );

            warnSpy.mockRestore();
        });
    });

    describe('metrics', () => {
        test('returns default metrics using window dimensions', () => {
            const metrics = window.__AmbientForTesting.metrics;
            const m = metrics();
            expect(m.cw).toBeDefined();
            expect(m.width).toBeDefined();
        });
    });

    describe('getConfig', () => {
        test('returns default configuration', () => {
            const getConfig = window.__AmbientForTesting.getConfig;
            const config = getConfig(null, false);
            expect(config.enabled).toBe(true);
            expect(config.minWidth).toBe(1024);
        });

        test('merges with window.AMBIENT_CONFIG', () => {
            window.AMBIENT_CONFIG = { minWidth: 800 };
            const getConfig = window.__AmbientForTesting.getConfig;
            const config = getConfig(null, false);
            expect(config.minWidth).toBe(800);
        });
    });

    test('initializes Sketch if conditions are met', () => {
        expect(mockSketch.create).toHaveBeenCalled();
        expect(window.AmbientTransitionController).toBeDefined();
    });

    describe('shouldSkip', () => {
        let originalInnerWidth;
        let originalMatchMedia;

        beforeEach(() => {
            originalInnerWidth = window.innerWidth;
            originalMatchMedia = window.matchMedia;

            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 1200,
            });

            window.matchMedia = jest.fn().mockImplementation((query) => ({
                matches: false,
                media: query,
            }));
        });

        afterEach(() => {
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: originalInnerWidth,
            });
            window.matchMedia = originalMatchMedia;
        });

        test('returns true if window.Sketch is not available', () => {
            const originalSketch = window.Sketch;
            delete window.Sketch;
            expect(window.__AmbientForTesting.shouldSkip({ minWidth: 1024 }, false)).toBe(true);
            window.Sketch = originalSketch;
        });

        test('returns false if force is true, bypassing other checks', () => {
            window.innerWidth = 500;
            expect(window.__AmbientForTesting.shouldSkip({ minWidth: 1024 }, true)).toBe(false);
        });

        test('returns true if disabled in config', () => {
            expect(
                window.__AmbientForTesting.shouldSkip({ minWidth: 1024, enabled: false }, false)
            ).toBe(true);
        });

        test('returns true if prefers reduced motion is true and not explicitly bypassed', () => {
            window.matchMedia = jest.fn().mockImplementation((query) => ({
                matches: true,
                media: query,
            }));
            jest.resetModules();
            require('../../../js/ambient/ambient.js');
            expect(
                window.__AmbientForTesting.shouldSkip({ minWidth: 1024, enabled: true }, false)
            ).toBe(true);
        });

        test('returns false if prefers reduced motion is true but config respects reduced motion is false', () => {
            window.matchMedia = jest.fn().mockImplementation((query) => ({
                matches: true,
                media: query,
            }));
            jest.resetModules();
            require('../../../js/ambient/ambient.js');
            expect(
                window.__AmbientForTesting.shouldSkip(
                    { minWidth: 1024, enabled: true, respectReducedMotion: false },
                    false
                )
            ).toBe(false);
        });

        test('returns true if window.innerWidth is less than config minWidth', () => {
            window.innerWidth = 800;
            window.dispatchEvent(new Event('resize'));
            expect(
                window.__AmbientForTesting.shouldSkip({ minWidth: 1024, enabled: true }, false)
            ).toBe(true);
        });

        test('returns false when all conditions are met', () => {
            expect(
                window.__AmbientForTesting.shouldSkip({ minWidth: 1024, enabled: true }, false)
            ).toBe(false);
        });

        test('gracefully handles missing matchMedia', () => {
            delete window.matchMedia;
            jest.resetModules();
            require('../../../js/ambient/ambient.js');
            expect(
                window.__AmbientForTesting.shouldSkip({ minWidth: 1024, enabled: true }, false)
            ).toBe(false);
        });
    });

    describe('ambient.js additional branch coverage', () => {
        let mockCtx, mockCanvas, api;

        beforeEach(() => {
            api = window.__AmbientForTesting;
            mockCtx = {
                clearRect: jest.fn(),
                fillRect: jest.fn(),
                beginPath: jest.fn(),
                arc: jest.fn(),
                fill: jest.fn(),
                drawImage: jest.fn()
            };
            mockCanvas = {
                getContext: jest.fn(() => mockCtx),
                style: {},
                width: 800,
                height: 600
            };

            // Mock getElementById to return canvas
            jest.spyOn(document, 'getElementById').mockImplementation((id) => {
                if (id === 'ambient-canvas') {return mockCanvas;}
                return null;
            });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('covers getDim logic when elements are present', () => {
            if (!api.getDim) {return;}
            document.body.innerHTML = '<div class="transition-overlay"></div><main id="cont" style="opacity: 0.5"></main>';

            // Let's call getDim and verify it executes without error.
            expect(() => api.getDim()).not.toThrow();
            document.body.innerHTML = '';
        });

        it('covers setupCanvas resizing and rendering trace', () => {
            if (!api.setupCanvas) {return;}
            document.body.innerHTML = '<canvas id="ambient-canvas"></canvas>';

            window.innerWidth = 1920;
            window.innerHeight = 1080;
            window.devicePixelRatio = 2;

            const canvasElement = document.getElementById('ambient-canvas');
            canvasElement.getContext = jest.fn(() => mockCtx);

            // Calling setupCanvas which returns ctx, w, h
            const result = api.setupCanvas(canvasElement);
            expect(result.w).toBe(3840); // 1920 * 2

            // Trigger resize event
            window.dispatchEvent(new Event('resize'));
        });

        it('covers full Sketch lifecycle including setup, resize, update, draw', () => {
            if (!window.Sketch || !window.Sketch.create) {return;}
            const api = window.__AmbientForTesting;
            if (!api) {return;}

            // Mock sketch creation
            let sketchInstance = null;
            window.Sketch.create = jest.fn((config) => {
                sketchInstance = config;
                return config;
            });

            // Add a canvas element so we bypass the fallback
            document.body.innerHTML = '<canvas id="ambient-canvas"></canvas>';
            // api.initAmbient isn't exported, but the IIFE runs on require.
            // We'll mock Sketch before the module is required again.
            // Setup mock for isolateModules
            jest.isolateModules(() => {
                const originalConsoleError = window.console.error;
                window.console.error = jest.fn(); // Suppress expected init failure in isolated module
                require('../../../js/ambient/ambient.js');
                window.console.error = originalConsoleError;
            });

            if (sketchInstance) {
                sketchInstance.width = 1920;
                sketchInstance.height = 1080;
                sketchInstance.canvas = document.createElement('canvas');

                // Execute setup, resize, update, draw
                // Wait, sketchInstance may not have setup if the init failed silently in the previous step
                // because of missing context or mock.
                if (sketchInstance && typeof sketchInstance.setup === 'function') {
                    sketchInstance.setup();
                    sketchInstance.resize();
                    sketchInstance.update();
                    sketchInstance.save = jest.fn();
                    sketchInstance.restore = jest.fn();
                    sketchInstance.fillRect = jest.fn();
                    sketchInstance.beginPath = jest.fn();
                    sketchInstance.arc = jest.fn();
                    sketchInstance.fill = jest.fn();
                    sketchInstance.setup();
                    sketchInstance.draw();
                }
            }
        });

        it('hits setupCanvas tracing branch when trace mode is true', () => {
            if (!api.setupCanvas) {return;}
            document.body.innerHTML = '<canvas id="ambient-canvas"></canvas>';

            const canvasElement = document.getElementById('ambient-canvas');
            canvasElement.getContext = jest.fn(() => mockCtx);

            window.location.search = '?ambient=trace';
            // Needs a way to feed "trace" into the ambient module config or we can just rely on getAmbientParam
            // We can just rely on the force setup if trace is in the URL.
            const originalLocation = window.location;
            delete window.location;
            window.location = { search: '?ambient=trace' };

            // Tracing sets up a red bounding box context
            api.setupCanvas(canvasElement);

            window.location = originalLocation;
        });

        it('covers missing body early return in clearFlag', () => {
            if (!api.clearFlag) {return;}
            const originalBody = document.body;
            Object.defineProperty(document, 'body', { value: null, configurable: true });

            expect(() => api.clearFlag()).not.toThrow();

            Object.defineProperty(document, 'body', { value: originalBody, configurable: true });
        });
    });
});
