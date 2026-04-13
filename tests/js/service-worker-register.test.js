/**
 * @jest-environment jsdom
 */

describe('service-worker-register', () => {
    beforeEach(() => {
        jest.resetModules();

        // Mock navigator.serviceWorker
        Object.defineProperty(global.navigator, 'serviceWorker', {
            value: {
                register: jest.fn().mockResolvedValue({ scope: '/sw.js' }),
            },
            configurable: true,
            writable: true,
        });

        // Default to a valid hostname
        delete window.location;
        window.location = new URL('https://example.com/');

        // Mock dispatchEvent
        window.dispatchEvent = jest.fn();
    });

    test('bails out and does not register on localhost', () => {
        window.location = new URL('http://localhost/');
        require('../../js/service-worker-register.js');
        expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
    });

    test('proceeds to register on production hostname', async () => {
        require('../../js/service-worker-register.js');
        expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');

        // Wait for promise
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
        expect(window.dispatchEvent.mock.calls[0][0].type).toBe('serviceWorker:registered');
    });

    test('emits serviceWorker:registrationError on failure', async () => {
        navigator.serviceWorker.register.mockRejectedValue(new Error('failed'));

        // Suppress expected console.warn
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        require('../../js/service-worker-register.js');

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
        expect(window.dispatchEvent.mock.calls[0][0].type).toBe('serviceWorker:registrationError');

        console.warn.mockRestore();
    });

    test('should early return if serviceWorker is missing from navigator', () => {
        delete global.navigator.serviceWorker;
        require('../../js/service-worker-register.js');
        // No errors thrown, nothing dispatched
        expect(window.dispatchEvent).not.toHaveBeenCalled();
    });

    test('should catch error when window.location.hostname parsing fails and log warning', () => {
        // Delete window.location first to allow mocking
        delete window.location;

        // Mock window.location to have a getter for hostname that throws
        window.location = {};
        Object.defineProperty(window.location, 'hostname', {
            get: () => {
                throw new Error('location error');
            },
            configurable: true,
        });

        jest.spyOn(console, 'warn').mockImplementation(() => {});

        require('../../js/service-worker-register.js');

        expect(console.warn).toHaveBeenCalledWith(
            'Hostname parsing failed during localhost check:',
            expect.any(Error)
        );

        // Since it returns false for isLocalhost() in catch, it should proceed to register
        expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');

        // Restore window.location for other tests
        window.location = new URL('https://example.com/');
    });

    test('should return early if window.dispatchEvent is missing', async () => {
        // Remove dispatchEvent
        const originalDispatchEvent = window.dispatchEvent;
        delete window.dispatchEvent;

        require('../../js/service-worker-register.js');
        await new Promise((resolve) => setTimeout(resolve, 0));

        // It should complete registration but silently skip emitEvent
        expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');

        // Restore
        window.dispatchEvent = originalDispatchEvent;
    });

    test('should fallback to document.createEvent if window.CustomEvent is not a function', async () => {
        // Remove CustomEvent
        const originalCustomEvent = window.CustomEvent;
        window.CustomEvent = undefined;

        // Mock document.createEvent
        const mockInitCustomEvent = jest.fn();
        const mockCreateEvent = jest.fn().mockReturnValue({
            initCustomEvent: mockInitCustomEvent,
            type: 'serviceWorker:registered',
        });
        document.createEvent = mockCreateEvent;

        require('../../js/service-worker-register.js');
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(document.createEvent).toHaveBeenCalledWith('CustomEvent');
        expect(mockInitCustomEvent).toHaveBeenCalledWith('serviceWorker:registered', false, false, {
            scope: '/sw.js',
        });
        expect(window.dispatchEvent).toHaveBeenCalled();

        // Restore
        window.CustomEvent = originalCustomEvent;
    });

    test('should register immediately if document.readyState is complete', () => {
        Object.defineProperty(document, 'readyState', {
            value: 'complete',
            configurable: true,
            writable: true,
        });
        require('../../js/service-worker-register.js');
        expect(navigator.serviceWorker.register).toHaveBeenCalled();
    });

    test('should wait for window load event to register if document is not complete', () => {
        Object.defineProperty(document, 'readyState', {
            value: 'loading',
            configurable: true,
            writable: true,
        });

        jest.spyOn(window, 'addEventListener');

        require('../../js/service-worker-register.js');

        // Register should not be called immediately
        expect(navigator.serviceWorker.register).not.toHaveBeenCalled();

        // It should add a load event listener
        expect(window.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));

        // Trigger the listener
        const loadCallback = window.addEventListener.mock.calls.find(
            (call) => call[0] === 'load'
        )[1];
        loadCallback();

        expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    });
});
