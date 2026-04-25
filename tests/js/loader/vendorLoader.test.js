/**
 * @jest-environment jsdom
 */

describe('vendorLoader.js', () => {
    let mockCDNLoader;

    beforeEach(() => {
        jest.resetModules();

        mockCDNLoader = {
            preconnect: jest.fn(),
            loadCssWithFallback: jest.fn(),
        };
        window.CDNLoader = mockCDNLoader;

        require('../../../js/loader/vendorLoader.js');
    });

    test('init should call preconnect and loadCssWithFallback', () => {
        const init = window.__VendorLoaderForTesting.init;
        mockCDNLoader.preconnect.mockClear();
        mockCDNLoader.loadCssWithFallback.mockClear();
        init();

        expect(mockCDNLoader.preconnect).toHaveBeenCalledWith(expect.any(Array));
        expect(mockCDNLoader.loadCssWithFallback).toHaveBeenCalledTimes(2);
    });
    test('should return early if CDNLoader is missing', () => {
        delete window.CDNLoader;
        const init = window.__VendorLoaderForTesting.init;
        expect(() => init()).not.toThrow();
    });

    test('should safely catch errors during loadCssWithFallback and log warning', () => {
        const init = window.__VendorLoaderForTesting.init;
        mockCDNLoader.loadCssWithFallback.mockImplementation(() => {
            throw new Error('Test Error');
        });

        // Mock window.console.warn
        jest.spyOn(window.console, 'warn').mockImplementation(() => {});

        init();

        expect(window.console.warn).toHaveBeenCalledWith(
            'Vendor Loader failed:',
            expect.any(Error)
        );

        window.console.warn.mockRestore();
    });

    test('should safely catch errors during loadCssWithFallback and not log warning if console is missing', () => {
        const init = window.__VendorLoaderForTesting.init;
        mockCDNLoader.loadCssWithFallback.mockImplementation(() => {
            throw new Error('Test Error');
        });

        // Temporarily redefine window.console to undefined
        const origConsole = window.console;
        Object.defineProperty(window, 'console', {
            value: undefined,
            writable: true,
            configurable: true,
        });

        expect(() => init()).not.toThrow();

        // Restore console
        Object.defineProperty(window, 'console', {
            value: origConsole,
            writable: true,
            configurable: true,
        });
    });
});
