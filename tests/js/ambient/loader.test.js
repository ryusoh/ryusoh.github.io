/** @jest-environment jsdom */

describe('ambient/loader.js', () => {
    let mockCDNLoader;
    let originalInnerWidth;

    beforeEach(() => {
        jest.resetModules();
        originalInnerWidth = window.innerWidth;

        mockCDNLoader = {
            loadScriptSequential: jest.fn().mockResolvedValue(),
            loadCssWithFallback: jest.fn().mockResolvedValue(),
        };

        window.CDNLoader = mockCDNLoader;

        // Use Object.defineProperty to safely mock matchMedia since jsdom sets it
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: jest.fn().mockReturnValue({ matches: false }),
        });

        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1200,
        });

        // Mock console.warn
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        document.body.setAttribute('data-page-type', 'home');

        window.AppLogger = { error: jest.fn() };
    });

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: originalInnerWidth,
        });
        delete window.CDNLoader;
        delete window.AppLogger;
        document.body.removeAttribute('data-page-type');
        jest.restoreAllMocks();
    });

    test('loadLegacyAmbient covers window.CDNLoader missing gracefully during sequence', async () => {
        let loadLegacyAmbient;
        jest.isolateModules(() => {
            require('../../../js/ambient/loader.js');
            loadLegacyAmbient = window.__AmbientLoaderForTesting.loadLegacyAmbient;
        });

        // Test line 38 and 46 missing checks
        window.CDNLoader = {
            loadScriptSequential: jest.fn().mockResolvedValueOnce().mockResolvedValueOnce(),
        };

        // First call will return resolved promise, then in then block line 37 we delete CDNLoader
        const resolvedPromise = Promise.resolve();
        window.CDNLoader.loadScriptSequential = jest.fn((args) => {
            if (args[0].includes('sketch.js')) {
                delete window.CDNLoader;
                return resolvedPromise;
            }
            return Promise.resolve();
        });

        // The assertion should be that the result of loadLegacyAmbient resolves successfully
        // despite window.CDNLoader being deleted midway, preventing crashes.
        await expect(loadLegacyAmbient()).resolves.toBeUndefined();
    });

    test('loadLegacyAmbient covers window.CDNLoader missing gracefully when CDNLoader is unmounted midway', async () => {
        let loadLegacyAmbient;
        jest.isolateModules(() => {
            require('../../../js/ambient/loader.js');
            loadLegacyAmbient = window.__AmbientLoaderForTesting.loadLegacyAmbient;
        });

        window.CDNLoader = {
            loadScriptSequential: jest.fn((args) => {
                if (args[0].includes('config/default.js')) {
                    delete window.CDNLoader;
                    return Promise.resolve();
                }
                return Promise.resolve();
            }),
        };

        await expect(loadLegacyAmbient()).resolves.toBeUndefined();
    });

    test('exits early if window.CDNLoader goes missing after checking shouldSkipLoader', () => {
        const originalCDNLoader = Object.getOwnPropertyDescriptor(window, 'CDNLoader') || {
            value: window.CDNLoader,
            configurable: true,
        };

        Object.defineProperty(window, 'CDNLoader', {
            configurable: true,
            get: jest
                .fn()
                .mockReturnValueOnce({}) // for shouldSkipLoader
                .mockReturnValueOnce(undefined), // for line 114
        });

        try {
            expect(() => {
                jest.isolateModules(() => {
                    require('../../../js/ambient/loader.js');
                });
            }).not.toThrow();
        } finally {
            if (originalCDNLoader.get || originalCDNLoader.set) {
                Object.defineProperty(window, 'CDNLoader', originalCDNLoader);
            } else {
                Object.defineProperty(window, 'CDNLoader', {
                    value: originalCDNLoader.value,
                    configurable: true,
                    writable: true,
                });
            }
        }
    });

    test('exits early if prefers-reduced-motion is true', () => {
        window.matchMedia.mockReturnValue({ matches: true });

        require('../../../js/ambient/loader.js');

        expect(mockCDNLoader.loadCssWithFallback).not.toHaveBeenCalled();
    });

    test('handles missing window.matchMedia gracefully', () => {
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: undefined,
        });

        require('../../../js/ambient/loader.js');

        expect(mockCDNLoader.loadCssWithFallback).toHaveBeenCalledWith([
            '/css/ambient/ambient.css',
        ]);
    });

    test('exits early if window innerWidth is less than 1024', () => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 800,
        });

        require('../../../js/ambient/loader.js');

        expect(mockCDNLoader.loadCssWithFallback).not.toHaveBeenCalled();
    });

    test('exits early if window.CDNLoader is missing', () => {
        delete window.CDNLoader;

        require('../../../js/ambient/loader.js');

        expect(mockCDNLoader.loadCssWithFallback).not.toHaveBeenCalled();
    });

    test('loads quantum particles on home pages', async () => {
        document.body.setAttribute('data-page-type', 'home');

        require('../../../js/ambient/loader.js');

        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockCDNLoader.loadScriptSequential).toHaveBeenCalledWith(
            ['/js/ambient/quantum_particles.js'],
            { defer: true }
        );
    });

    test('loads both quantum and legacy sketch layers on home page', async () => {
        document.body.setAttribute('data-page-type', 'home');

        require('../../../js/ambient/loader.js');

        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockCDNLoader.loadScriptSequential).toHaveBeenCalledWith(
            ['/js/ambient/quantum_particles.js'],
            { defer: true }
        );
        expect(mockCDNLoader.loadScriptSequential).toHaveBeenCalledWith(['/js/vendor/sketch.js']);
        expect(mockCDNLoader.loadScriptSequential).toHaveBeenCalledWith(
            ['/js/ambient/config/default.js'],
            { defer: true }
        );
        expect(mockCDNLoader.loadScriptSequential).toHaveBeenCalledWith(
            ['/js/ambient/ambient.js'],
            { defer: true }
        );
    });

    test('does not load ambient assets for project pages', async () => {
        document.body.setAttribute('data-page-type', 'project');

        require('../../../js/ambient/loader.js');

        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockCDNLoader.loadCssWithFallback).not.toHaveBeenCalled();
        expect(mockCDNLoader.loadScriptSequential).not.toHaveBeenCalled();
    });

    test('does not load ambient scripts for other page types', async () => {
        document.body.setAttribute('data-page-type', 'about');

        require('../../../js/ambient/loader.js');

        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        const calls = mockCDNLoader.loadScriptSequential.mock.calls;
        const loadedQuantum = calls.some((call) =>
            call[0].includes('/js/ambient/quantum_particles.js')
        );
        const loadedSketch = calls.some((call) => call[0].includes('/js/vendor/sketch.js'));
        expect(loadedQuantum).toBe(false);
        expect(loadedSketch).toBe(false);
    });

    test('ignores synchronous errors during initialization gracefully', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: jest.fn(() => {
                throw new Error('Simulated synchronous error');
            }),
        });

        expect(() => {
            require('../../../js/ambient/loader.js');
        }).not.toThrow();
        spy.mockRestore();
    });

    test('ignores promise rejections from CDNLoader gracefully', async () => {
        mockCDNLoader.loadCssWithFallback.mockRejectedValue(new Error('Simulated network error'));

        require('../../../js/ambient/loader.js');

        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(console.warn).toHaveBeenCalledWith(
            'Ambient async loader failed:',
            expect.any(Error)
        );
    });

    test('ignores promise rejections from CDNLoader without throwing when console.warn is missing', async () => {
        const originalWarn = console.warn;
        console.warn = undefined;
        mockCDNLoader.loadCssWithFallback.mockRejectedValue(new Error('Simulated network error'));

        expect(() => {
            require('../../../js/ambient/loader.js');
        }).not.toThrow();

        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        console.warn = originalWarn;
    });

    test('ignores synchronous errors during initialization gracefully and logs warning to AppLogger', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: jest.fn(() => {
                throw new Error('Simulated synchronous error');
            }),
        });

        require('../../../js/ambient/loader.js');

        expect(window.AppLogger.error).toHaveBeenCalledWith(
            'Ambient initialization failed:',
            expect.any(Error)
        );
        spy.mockRestore();
    });

    test('ignores synchronous errors during initialization gracefully and logs warning to console if no AppLogger', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        delete window.AppLogger;
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: jest.fn(() => {
                throw new Error('Simulated synchronous error');
            }),
        });

        require('../../../js/ambient/loader.js');

        expect(window.console.warn).toHaveBeenCalledWith(
            'Ambient initialization failed:',
            expect.any(Error)
        );
        spy.mockRestore();
    });

    test('gracefully handles missing window.console.warn during async rejection', async () => {
        const originalWarn = console.warn;
        console.warn = undefined;
        mockCDNLoader.loadCssWithFallback.mockRejectedValue(new Error('Simulated network error'));

        expect(() => {
            require('../../../js/ambient/loader.js');
        }).not.toThrow();

        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        console.warn = originalWarn;
    });

    test('gracefully handles missing window.console during sync error', () => {
        const originalConsole = window.console;

        Object.defineProperty(window, 'console', {
            configurable: true,
            get: () => undefined,
        });

        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: jest.fn(() => {
                throw new Error('Simulated synchronous error');
            }),
        });

        expect(() => {
            require('../../../js/ambient/loader.js');
        }).not.toThrow();

        Object.defineProperty(window, 'console', {
            configurable: true,
            value: originalConsole,
        });
    });

    it('covers missing body gracefully in init', () => {
        jest.resetModules();
        originalInnerWidth = window.innerWidth;
        window.innerWidth = 1024;

        mockCDNLoader = {
            loadScriptSequential: jest.fn().mockResolvedValue(),
            loadCssWithFallback: jest.fn().mockResolvedValue(),
        };
        window.CDNLoader = mockCDNLoader;

        const origBody = document.body;
        Object.defineProperty(document, 'body', {
            get() {
                return undefined;
            },
            configurable: true,
        });

        require('../../../js/ambient/loader.js');

        return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
            Object.defineProperty(document, 'body', { value: origBody, configurable: true });
            window.innerWidth = originalInnerWidth;
        });
    });
});
