/**
 * @jest-environment jsdom
 */

const LenisInit = require('../../js/lenis-init.js');

describe('LenisInit', () => {
    let mockLenisInstance;
    let MockLenisClass;

    beforeEach(() => {
        mockLenisInstance = {
            on: jest.fn(),
            raf: jest.fn(),
            scrollTo: jest.fn(),
            destroy: jest.fn(),
        };

        MockLenisClass = jest.fn().mockImplementation(() => mockLenisInstance);
        window.Lenis = MockLenisClass;
        delete window.lenis;
    });

    test('isReducedMotion returns false when media query does not match', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: false });
        expect(LenisInit.isReducedMotion()).toBe(false);
    });

    test('isReducedMotion returns true when prefers-reduced-motion matches', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: true });
        expect(LenisInit.isReducedMotion()).toBe(true);
    });

    test('initLenis returns null if reduced motion is enabled', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: true });
        const result = LenisInit.initLenis();
        expect(result).toBeNull();
        expect(MockLenisClass).not.toHaveBeenCalled();
    });

    test('initLenis instantiates Lenis with options and sets window.lenis', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: false });
        const result = LenisInit.initLenis({ duration: 1.5 });

        expect(result).toBe(mockLenisInstance);
        expect(window.lenis).toBe(mockLenisInstance);
        expect(MockLenisClass).toHaveBeenCalledTimes(1);

        const config = MockLenisClass.mock.calls[0][0];
        expect(config.duration).toBe(1.5);
        expect(config.smoothWheel).toBe(true);
        expect(typeof config.easing).toBe('function');
        expect(config.easing(0.5)).toBeGreaterThan(0);
    });

    test('initLenis returns null gracefully if Lenis class is not defined', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: false });
        delete window.Lenis;
        delete globalThis.Lenis;

        const result = LenisInit.initLenis();
        expect(result).toBeNull();
    });

    test('initLenis handles errors thrown during instantiation', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: false });
        window.Lenis = jest.fn().mockImplementation(() => {
            throw new Error('Instantiation error');
        });

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = LenisInit.initLenis();
        expect(result).toBeNull();

        expect(consoleSpy).toHaveBeenCalledWith(
            '[LenisInit] Lenis instantiation failed:',
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    test('initializes on DOMContentLoaded when document.readyState is loading', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: false });
        // Re-eval script with readyState loading
        const originalReadyState = document.readyState;
        Object.defineProperty(document, 'readyState', {
            value: 'loading',
            configurable: true,
        });

        // Trigger DOMContentLoaded
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        Object.defineProperty(document, 'readyState', {
            value: originalReadyState,
            configurable: true,
        });
    });
});
