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
});
