const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('ambient/loader.js', () => {
    let context;
    let code;
    let mockCDNLoader;
    let mockDocument;
    let mockBody;

    beforeEach(() => {
        code = fs.readFileSync(path.resolve(__dirname, '../../../js/ambient/loader.js'), 'utf8');

        mockCDNLoader = {
            loadScriptSequential: jest.fn().mockResolvedValue(),
            loadCssWithFallback: jest.fn().mockResolvedValue(),
        };

        mockBody = {
            getAttribute: jest.fn().mockReturnValue('home'),
        };

        mockDocument = {
            body: mockBody,
        };

        context = {
            window: {
                CDNLoader: mockCDNLoader,
                innerWidth: 1200,
                matchMedia: jest.fn().mockReturnValue({ matches: false }),
                Promise: Promise,
                console: {
                    warn: jest.fn(),
                },
            },
            document: mockDocument,
        };
    });

    test('exits early if prefers-reduced-motion is true', () => {
        context.window.matchMedia.mockReturnValue({ matches: true });

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockCDNLoader.loadCssWithFallback).not.toHaveBeenCalled();
    });

    test('handles missing window.matchMedia gracefully', () => {
        delete context.window.matchMedia;

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockCDNLoader.loadCssWithFallback).toHaveBeenCalledWith([
            '/css/ambient/ambient.css',
        ]);
    });

    test('exits early if window innerWidth is less than 1024', () => {
        context.window.innerWidth = 800;

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockCDNLoader.loadCssWithFallback).not.toHaveBeenCalled();
    });

    test('exits early if window.CDNLoader is missing', () => {
        delete context.window.CDNLoader;

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockCDNLoader.loadCssWithFallback).not.toHaveBeenCalled();
    });

    test('loads ambient CSS and legacy scripts correctly', async () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockCDNLoader.loadCssWithFallback).toHaveBeenCalledWith([
            '/css/ambient/ambient.css',
        ]);

        await new Promise(process.nextTick);
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        expect(mockCDNLoader.loadScriptSequential).toHaveBeenCalledWith(['/js/vendor/sketch.js']);
    });

    test('loads quantum particles when pageType is home or project', async () => {
        mockBody.getAttribute.mockReturnValue('home');

        vm.createContext(context);
        vm.runInContext(code, context);

        await new Promise(process.nextTick);
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        expect(mockCDNLoader.loadScriptSequential).toHaveBeenCalledWith(
            ['/js/ambient/quantum_particles.js'],
            { defer: true }
        );
    });

    test('does not load quantum particles for other page types', async () => {
        mockBody.getAttribute.mockReturnValue('about');

        vm.createContext(context);
        vm.runInContext(code, context);

        await new Promise(process.nextTick);
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        const calls = mockCDNLoader.loadScriptSequential.mock.calls;
        const loadedQuantum = calls.some((call) =>
            call[0].includes('/js/ambient/quantum_particles.js')
        );
        expect(loadedQuantum).toBe(false);
    });

    test('ignores synchronous errors during initialization gracefully', () => {
        Object.defineProperty(context.window, 'matchMedia', {
            get: () => {
                throw new Error('Simulated synchronous error');
            },
        });

        expect(() => {
            vm.createContext(context);
            vm.runInContext(code, context);
        }).not.toThrow();
    });

    test('ignores promise rejections from CDNLoader gracefully', async () => {
        mockCDNLoader.loadCssWithFallback.mockRejectedValue(new Error('Simulated network error'));

        vm.createContext(context);
        vm.runInContext(code, context);

        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        expect(context.window.console.warn).toHaveBeenCalledWith(
            'Ambient async loader failed:',
            expect.any(Error)
        );
    });

    test('ignores promise rejections from CDNLoader without throwing when console.warn is missing', async () => {
        delete context.window.console.warn;
        mockCDNLoader.loadCssWithFallback.mockRejectedValue(new Error('Simulated network error'));

        vm.createContext(context);

        expect(() => {
            vm.runInContext(code, context);
        }).not.toThrow();

        await new Promise(process.nextTick);
        await new Promise(process.nextTick);
    });

    test('ignores synchronous errors during initialization gracefully and logs warning', () => {
        Object.defineProperty(context.window, 'matchMedia', {
            get: () => {
                throw new Error('Simulated synchronous error');
            },
        });

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.window.console.warn).toHaveBeenCalledWith(
            'Ambient initialization failed:',
            expect.any(Error)
        );
    });
});
