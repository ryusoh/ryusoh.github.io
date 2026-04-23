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
        window.innerWidth = 1200;
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: jest.fn().mockReturnValue({ matches: false }),
        });

        // Mock console.warn
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        document.body.setAttribute('data-page-type', 'home');
    });

    afterEach(() => {
        window.innerWidth = originalInnerWidth;
        delete window.CDNLoader;
        document.body.removeAttribute('data-page-type');
        jest.restoreAllMocks();
    });

    test('exits early if prefers-reduced-motion is true', () => {
        window.matchMedia.mockReturnValue({ matches: true });

        require('../../../js/ambient/loader.js');

        expect(mockCDNLoader.loadCssWithFallback).not.toHaveBeenCalled();
    });

    test('handles missing window.matchMedia gracefully', () => {
        const originalMatchMedia = window.matchMedia;
        delete window.matchMedia;

        require('../../../js/ambient/loader.js');

        expect(mockCDNLoader.loadCssWithFallback).toHaveBeenCalledWith([
            '/css/ambient/ambient.css',
        ]);

        window.matchMedia = originalMatchMedia;
    });

    test('exits early if window innerWidth is less than 1024', () => {
        window.innerWidth = 800;

        require('../../../js/ambient/loader.js');

        expect(mockCDNLoader.loadCssWithFallback).not.toHaveBeenCalled();
    });

    test('exits early if window.CDNLoader is missing', () => {
        delete window.CDNLoader;

        require('../../../js/ambient/loader.js');

        expect(mockCDNLoader.loadCssWithFallback).not.toHaveBeenCalled();
    });

    test('loads ambient CSS and legacy scripts correctly', async () => {
        require('../../../js/ambient/loader.js');

        expect(mockCDNLoader.loadCssWithFallback).toHaveBeenCalledWith([
            '/css/ambient/ambient.css',
        ]);

        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockCDNLoader.loadScriptSequential).toHaveBeenCalledWith(['/js/vendor/sketch.js']);
    });

    test('loads quantum particles when pageType is home or project', async () => {
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

    test('does not load quantum particles for other page types', async () => {
        document.body.setAttribute('data-page-type', 'about');

        require('../../../js/ambient/loader.js');

        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        const calls = mockCDNLoader.loadScriptSequential.mock.calls;
        const loadedQuantum = calls.some((call) =>
            call[0].includes('/js/ambient/quantum_particles.js')
        );
        expect(loadedQuantum).toBe(false);
    });

    test('ignores synchronous errors during initialization gracefully', () => {
        const originalMatchMedia = window.matchMedia;
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            get: () => {
                throw new Error('Simulated synchronous error');
            },
        });

        expect(() => {
            require('../../../js/ambient/loader.js');
        }).not.toThrow();

        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: originalMatchMedia,
        });
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

    test('ignores synchronous errors during initialization gracefully and logs warning', () => {
        const originalMatchMedia = window.matchMedia;
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            get: () => {
                throw new Error('Simulated synchronous error');
            },
        });

        require('../../../js/ambient/loader.js');

        expect(console.warn).toHaveBeenCalledWith(
            'Ambient initialization failed:',
            expect.any(Error)
        );

        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: originalMatchMedia,
        });
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
        const originalMatchMedia = window.matchMedia;

        Object.defineProperty(window, 'console', {
            configurable: true,
            get: () => undefined,
        });

        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            get: () => {
                throw new Error('Simulated synchronous error');
            },
        });

        expect(() => {
            require('../../../js/ambient/loader.js');
        }).not.toThrow();

        Object.defineProperty(window, 'console', {
            configurable: true,
            value: originalConsole,
        });
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: originalMatchMedia,
        });
    });
});
