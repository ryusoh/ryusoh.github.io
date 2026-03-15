const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('loader/vendorLoader.js', () => {
    let context;
    let code;
    let mockCDNLoader;

    beforeEach(() => {
        code = fs.readFileSync(
            path.resolve(__dirname, '../../../js/loader/vendorLoader.js'),
            'utf8'
        );

        mockCDNLoader = {
            preconnect: jest.fn(),
            loadCssWithFallback: jest.fn(),
        };

        context = {
            window: {
                CDNLoader: mockCDNLoader,
            },
        };
    });

    test('exits early if window.CDNLoader is missing', () => {
        delete context.window.CDNLoader;

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockCDNLoader.preconnect).not.toHaveBeenCalled();
    });

    test('preconnects to required font domains', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockCDNLoader.preconnect).toHaveBeenCalledWith([
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
            'https://fonts.bunny.net',
        ]);
    });

    test('loads font awesome CSS with fallback', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockCDNLoader.loadCssWithFallback).toHaveBeenCalledWith([
            '/assets/vendor/font-awesome/css/font-awesome.min.css',
        ]);
    });

    test('loads google fonts with fallback', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockCDNLoader.loadCssWithFallback).toHaveBeenCalledWith([
            'https://fonts.googleapis.com/css2?family=Lobster&display=swap',
            'https://fonts.bunny.net/css?family=Lobster',
        ]);
    });

    test('handles errors gracefully without throwing', () => {
        mockCDNLoader.preconnect.mockImplementation(() => {
            throw new Error('Preconnect failed');
        });

        expect(() => {
            vm.createContext(context);
            vm.runInContext(code, context);
        }).not.toThrow();
    });
});
