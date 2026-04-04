const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('ambient/config/default.js', () => {
    let context;
    let code;

    beforeEach(() => {
        code = fs.readFileSync(
            path.resolve(__dirname, '../../../../js/ambient/config/default.js'),
            'utf8'
        );

        context = {
            window: {},
            Object: Object,
        };
    });

    test('sets default configuration on window.AMBIENT_CONFIG', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.window.AMBIENT_CONFIG).toBeDefined();
        expect(context.window.AMBIENT_CONFIG.enabled).toBe(true);
        expect(context.window.AMBIENT_CONFIG.minWidth).toBe(0);
        expect(context.window.AMBIENT_CONFIG.maxParticles).toBe(300);
        expect(context.window.AMBIENT_CONFIG.densityDivisor).toBe(20000);
        expect(context.window.AMBIENT_CONFIG.radius).toEqual({ min: 1.0, max: 8.0 });
        expect(context.window.AMBIENT_CONFIG.alpha).toEqual({ min: 0.1, max: 0.6 });
        expect(context.window.AMBIENT_CONFIG.speed).toBe(0.6);
        expect(context.window.AMBIENT_CONFIG.zIndex).toBe(1);
        expect(context.window.AMBIENT_CONFIG.blend).toBe('screen');
        expect(context.window.AMBIENT_CONFIG.respectReducedMotion).toBe(false);
    });

    test('merges with existing window.AMBIENT_CONFIG', () => {
        context.window.AMBIENT_CONFIG = {
            maxParticles: 500,
            speed: 1.5,
        };

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.window.AMBIENT_CONFIG.maxParticles).toBe(500);
        expect(context.window.AMBIENT_CONFIG.speed).toBe(1.5);
        expect(context.window.AMBIENT_CONFIG.enabled).toBe(true);
    });

    test('handles errors gracefully without throwing', () => {
        context.window = null; // This will cause an error when assigning

        expect(() => {
            vm.createContext(context);
            vm.runInContext(code, context);
        }).not.toThrow();
    });

    test('logs a warning when initialization fails', () => {
        context.window = {
            console: {
                warn: jest.fn(),
            },
        };

        // Use a Proxy or defineProperty to throw when AMBIENT_CONFIG is accessed/set
        Object.defineProperty(context.window, 'AMBIENT_CONFIG', {
            get: () => {
                throw new Error('Simulated config error');
            },
        });

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.window.console.warn).toHaveBeenCalledWith(
            'Ambient config initialization failed:',
            expect.any(Error)
        );
    });

    test('gracefully handles missing window.console.warn without throwing', () => {
        context.window = {
            console: {}, // Missing warn
        };

        // Use a Proxy or defineProperty to throw when AMBIENT_CONFIG is accessed/set
        Object.defineProperty(context.window, 'AMBIENT_CONFIG', {
            get: () => {
                throw new Error('Simulated config error');
            },
        });

        expect(() => {
            vm.createContext(context);
            vm.runInContext(code, context);
        }).not.toThrow();
    });

    test('gracefully handles completely missing window.console without throwing', () => {
        context.window = {}; // Missing console entirely

        // Use a Proxy or defineProperty to throw when AMBIENT_CONFIG is accessed/set
        Object.defineProperty(context.window, 'AMBIENT_CONFIG', {
            get: () => {
                throw new Error('Simulated config error');
            },
        });

        expect(() => {
            vm.createContext(context);
            vm.runInContext(code, context);
        }).not.toThrow();
    });
});
