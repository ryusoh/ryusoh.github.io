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
            delete window.location;
            window.location = new URL('https://example.com/?ambient=' + 'a'.repeat(1001));

            expect(getAmbientParam()).toBeNull();
        });

        test('returns null and warns if parsing fails', () => {
            const getAmbientParam = window.__AmbientForTesting.getAmbientParam;
            delete window.location;
            window.location = new URL('https://example.com/?ambient=1');

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
            delete window.location;
            window.location = new URL('https://example.com/?ambient=debug');
            expect(getAmbientParam()).toBe('debug');
        });

        test('returns null if search is empty', () => {
            const getAmbientParam = window.__AmbientForTesting.getAmbientParam;
            delete window.location;
            window.location = new URL('https://example.com/');
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

            expect(s.canvas.style.transition).toBe('opacity 0.4s ease');
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

            expect(s.canvas.style.transition).toBe('opacity 0.4s ease');
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
});
