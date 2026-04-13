/**
 * @jest-environment jsdom
 */

describe('ambient/config/default.js', () => {
    let consoleWarnSpy;

    beforeEach(() => {
        jest.resetModules();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Reset global state
        delete window.AMBIENT_CONFIG;
        delete window.__DefaultConfigForTesting;
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    test('sets default configuration on window.AMBIENT_CONFIG', () => {
        require('../../../../js/ambient/config/default.js');
        // Already executed during require
        expect(window.AMBIENT_CONFIG).toBeDefined();
        expect(window.AMBIENT_CONFIG.enabled).toBe(true);
        expect(window.AMBIENT_CONFIG.minWidth).toBe(0);
        expect(window.AMBIENT_CONFIG.maxParticles).toBe(300);
        expect(window.AMBIENT_CONFIG.densityDivisor).toBe(20000);
        expect(window.AMBIENT_CONFIG.radius).toEqual({ min: 1.0, max: 8.0 });
        expect(window.AMBIENT_CONFIG.alpha).toEqual({ min: 0.1, max: 0.6 });
        expect(window.AMBIENT_CONFIG.speed).toBe(0.6);
        expect(window.AMBIENT_CONFIG.zIndex).toBe(1);
        expect(window.AMBIENT_CONFIG.blend).toBe('screen');
        expect(window.AMBIENT_CONFIG.respectReducedMotion).toBe(false);
    });

    test('merges with existing window.AMBIENT_CONFIG', () => {
        window.AMBIENT_CONFIG = {
            maxParticles: 500,
            speed: 1.5,
        };

        require('../../../../js/ambient/config/default.js');

        expect(window.AMBIENT_CONFIG.maxParticles).toBe(500);
        expect(window.AMBIENT_CONFIG.speed).toBe(1.5);
        expect(window.AMBIENT_CONFIG.enabled).toBe(true);
    });

    test('handles errors gracefully without throwing', () => {
        // Simulated config error by throwing when AMBIENT_CONFIG is accessed
        Object.defineProperty(window, 'AMBIENT_CONFIG', {
            get: () => {
                throw new Error('Simulated config error');
            },
            configurable: true,
        });

        expect(() => {
            require('../../../../js/ambient/config/default.js');
        }).not.toThrow();
    });

    test('logs a warning when initialization fails', () => {
        // Simulated config error by throwing when AMBIENT_CONFIG is accessed
        Object.defineProperty(window, 'AMBIENT_CONFIG', {
            get: () => {
                throw new Error('Simulated config error');
            },
            configurable: true,
        });

        require('../../../../js/ambient/config/default.js');

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Ambient config initialization failed:',
            expect.any(Error)
        );
    });

    test('gracefully handles missing window.console.warn without throwing', () => {
        const originalWarn = window.console.warn;
        window.console.warn = undefined;

        Object.defineProperty(window, 'AMBIENT_CONFIG', {
            get: () => {
                throw new Error('Simulated config error');
            },
            configurable: true,
        });

        expect(() => {
            require('../../../../js/ambient/config/default.js');
        }).not.toThrow();

        window.console.warn = originalWarn;
    });

    test('gracefully handles completely missing window.console without throwing', () => {
        const originalConsole = window.console;
        Object.defineProperty(window, 'console', {
            get: () => undefined,
            configurable: true,
        });

        Object.defineProperty(window, 'AMBIENT_CONFIG', {
            get: () => {
                throw new Error('Simulated config error');
            },
            configurable: true,
        });

        expect(() => {
            require('../../../../js/ambient/config/default.js');
        }).not.toThrow();

        // Restore console
        Object.defineProperty(window, 'console', {
            get: () => originalConsole,
            configurable: true,
        });
    });
});
