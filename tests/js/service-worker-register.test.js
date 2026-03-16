const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('service-worker-register', () => {
    let context;
    let code;

    beforeEach(() => {
        code = fs.readFileSync(
            path.resolve(__dirname, '../../js/service-worker-register.js'),
            'utf8'
        );

        context = {
            window: {
                location: {
                    hostname: 'example.com',
                },
                addEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
                CustomEvent: class CustomEvent {
                    constructor(name, options) {
                        this.type = name;
                        this.detail = options ? options.detail : null;
                    }
                },
            },
            CustomEvent: class CustomEvent {
                constructor(name, options) {
                    this.type = name;
                    this.detail = options ? options.detail : null;
                }
            },
            document: {
                readyState: 'complete',
            },
            navigator: {
                serviceWorker: {
                    register: jest.fn().mockResolvedValue({ scope: '/sw.js' }),
                },
            },
        };
    });

    test('bails out and does not register on localhost', () => {
        context.window.location.hostname = 'localhost';
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.navigator.serviceWorker.register).not.toHaveBeenCalled();
    });

    test('bails out and does not register on 127.0.0.1', () => {
        context.window.location.hostname = '127.0.0.1';
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.navigator.serviceWorker.register).not.toHaveBeenCalled();
    });

    test('registers service worker and emits serviceWorker:registered on success', async () => {
        // We need to await the promise resolution within the VM
        // The IIFE is synchronous but the register call is async.
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');

        // Wait for microtasks to complete (the promise resolution inside register())
        await new Promise(process.nextTick);

        expect(context.window.dispatchEvent).toHaveBeenCalled();
        const event = context.window.dispatchEvent.mock.calls[0][0];
        expect(event.type).toBe('serviceWorker:registered');
        expect(event.detail.scope).toBe('/sw.js');
    });

    test('emits serviceWorker:registrationError on registration failure', async () => {
        context.navigator.serviceWorker.register.mockRejectedValue(
            new Error('Registration failed')
        );

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');

        // Wait for microtasks to complete
        await new Promise(process.nextTick);

        expect(context.window.dispatchEvent).toHaveBeenCalled();
        const event = context.window.dispatchEvent.mock.calls[0][0];
        expect(event.type).toBe('serviceWorker:registrationError');
        expect(event.detail.message).toBe('Registration failed');
    });

    test('binds to load event if document is not complete', () => {
        context.document.readyState = 'loading';

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.navigator.serviceWorker.register).not.toHaveBeenCalled();
        expect(context.window.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));

        // Trigger load manually
        const loadCallback = context.window.addEventListener.mock.calls[0][1];
        loadCallback();

        expect(context.navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    });
});
