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
});
