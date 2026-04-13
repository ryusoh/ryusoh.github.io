/**
 * @jest-environment jsdom
 */

describe('ga.js bootstrap', () => {
    let mockScriptElement;

    beforeEach(() => {
        jest.resetModules();
        document.documentElement.innerHTML =
            '<html><head><script></script></head><body></body></html>';

        // Ensure window.ga is clean
        delete window.ga;

        mockScriptElement = {
            async: 0,
            src: '',
        };

        // Mock document.createElement('script')
        jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName === 'script') {
                return mockScriptElement;
            }
            return {};
        });

        // Mock parentNode.insertBefore
        jest.spyOn(
            document.getElementsByTagName('script')[0].parentNode,
            'insertBefore'
        ).mockImplementation();

        require('../../js/ga.js');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should initialize window.ga queue', () => {
        expect(window.ga).toBeDefined();
        expect(typeof window.ga).toBe('function');
        expect(window.GoogleAnalyticsObject).toBe('ga');
    });

    test('should create and insert a script tag', () => {
        expect(document.createElement).toHaveBeenCalledWith('script');
        expect(mockScriptElement.async).toBe(1);
        expect(mockScriptElement.src).toBe('https://www.google-analytics.com/analytics.js');
    });

    test('should record pageview', () => {
        expect(window.ga.q).toBeDefined();
        // Check if the expected commands are in the queue
        const hasCreate = window.ga.q.some(
            (args) => args[0] === 'create' && args[1] === 'UA-9097302-10'
        );
        const hasSend = window.ga.q.some((args) => args[0] === 'send' && args[1] === 'pageview');
        expect(hasCreate).toBe(true);
        expect(hasSend).toBe(true);
    });

    test('should safely catch errors during ga initialization and log warning', () => {
        // Instead of mocking a throwing getter on window.ga (which Jest's cleanup
        // might trigger and crash on), we mock window.ga as a function that throws
        // when called, since the code does: if (typeof window.ga === 'function') { window.ga(...) }
        window.ga = jest.fn(() => {
            throw new Error('Test Error');
        });

        // Mock console.warn
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Re-require to trigger try-catch logic
        jest.resetModules();
        require('../../js/ga.js');

        expect(console.warn).toHaveBeenCalledWith(
            'Google Analytics initialization failed:',
            expect.any(Error)
        );

        // Clean up
        delete window.ga;
    });

    test('should not crash if console.warn is missing during error', () => {
        window.ga = jest.fn(() => {
            throw new Error('Test Error');
        });

        // Remove console.warn
        const originalWarn = console.warn;
        delete console.warn;

        jest.resetModules();
        expect(() => {
            require('../../js/ga.js');
        }).not.toThrow();

        // Restore
        console.warn = originalWarn;
        delete window.ga;
    });
});
