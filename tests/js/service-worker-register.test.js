/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(
    path.resolve(__dirname, '../../js/service-worker-register.js'),
    'utf8'
);

// Minimal CustomEvent stand-in so the IIFE can construct events inside the vm
// context. jsdom 26 makes window.location / window.console non-configurable, so
// the source (an IIFE that branches on window.location.hostname and
// document.readyState at load time) is exercised in a controllable vm context
// rather than by mutating the jsdom globals. See docs/testing-notes.md.
class FakeCustomEvent {
    constructor(type, init) {
        this.type = type;
        this.detail = (init && init.detail) || null;
    }
}

function flush() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

// Builds a vm context, runs the source IIFE in it, and returns the context plus
// the mocks the tests assert against.
function run(options = {}) {
    const {
        hostname = 'example.com',
        register = jest.fn().mockResolvedValue({ scope: '/sw.js' }),
        readyState = 'complete',
        customEvent = FakeCustomEvent,
        withConsole = true,
        // Advanced overrides for the early-exit branches:
        omitWindow = false,
        navigator = { serviceWorker: { register } },
        location = { hostname },
        dispatchEvent = jest.fn(),
        createEvent,
        addEventListener = jest.fn(),
    } = options;

    const warn = jest.fn();

    const win = {
        location,
        dispatchEvent,
        addEventListener,
        CustomEvent: customEvent,
        console: withConsole ? { warn, log: jest.fn() } : undefined,
    };

    const context = {
        navigator,
        document: { readyState, createEvent },
        CustomEvent: customEvent,
    };
    if (!omitWindow) {
        context.window = win;
    }

    vm.createContext(context);
    vm.runInContext(SOURCE, context);

    return { context, win, register, dispatchEvent, addEventListener, warn };
}

describe('service-worker-register', () => {
    test('bails out and does not register on localhost', () => {
        const { register } = run({ hostname: 'localhost' });
        expect(register).not.toHaveBeenCalled();
    });

    test.each(['localhost', '127.0.0.1', '[::1]', ''])(
        'treats %p as localhost and does not register',
        (hostname) => {
            const { register } = run({ hostname });
            expect(register).not.toHaveBeenCalled();
        }
    );

    test('proceeds to register on a production hostname', async () => {
        const { register, dispatchEvent } = run({ hostname: 'example.com' });
        expect(register).toHaveBeenCalledWith('/sw.js');

        await flush();
        expect(dispatchEvent).toHaveBeenCalled();
        const event = dispatchEvent.mock.calls[0][0];
        expect(event.type).toBe('serviceWorker:registered');
        expect(event.detail).toEqual({ scope: '/sw.js' });
    });

    test('uses null scope when registration has no scope', async () => {
        const register = jest.fn().mockResolvedValue({});
        const { dispatchEvent } = run({ register });

        await flush();
        const event = dispatchEvent.mock.calls[0][0];
        expect(event.type).toBe('serviceWorker:registered');
        expect(event.detail).toEqual({ scope: null });
    });

    test('emits serviceWorker:registrationError on failure and logs a warning', async () => {
        const register = jest.fn().mockRejectedValue(new Error('failed'));
        const { dispatchEvent, warn } = run({ register });

        await flush();
        const event = dispatchEvent.mock.calls.find(
            (call) => call[0] && call[0].type === 'serviceWorker:registrationError'
        );
        expect(event).toBeDefined();
        expect(event[0].detail.message).toBe('failed');
        expect(warn).toHaveBeenCalledWith('Service worker registration failed:', expect.any(Error));
    });

    test('uses an empty message when the rejection has no message', async () => {
        const register = jest.fn().mockRejectedValue({});
        const { dispatchEvent } = run({ register });

        await flush();
        const event = dispatchEvent.mock.calls.find(
            (call) => call[0] && call[0].type === 'serviceWorker:registrationError'
        );
        expect(event).toBeDefined();
        expect(event[0].detail.message).toBe('');
    });

    test('returns early if serviceWorker is missing from navigator', () => {
        const { dispatchEvent } = run({ navigator: {} });
        expect(dispatchEvent).not.toHaveBeenCalled();
    });

    test('returns early if window is undefined', () => {
        expect(() => run({ omitWindow: true })).not.toThrow();
    });

    test('catches hostname parse failure, warns, and proceeds to register', () => {
        const register = jest.fn().mockResolvedValue({ scope: '/sw.js' });
        const location = {
            get hostname() {
                throw new Error('location error');
            },
        };
        const { warn } = run({ location, navigator: { serviceWorker: { register } } });

        expect(warn).toHaveBeenCalledWith(
            'Hostname parsing failed during localhost check:',
            expect.any(Error)
        );
        expect(register).toHaveBeenCalledWith('/sw.js');
    });

    test('does not throw when hostname parse fails and console is absent', () => {
        const register = jest.fn().mockResolvedValue({ scope: '/sw.js' });
        const location = {
            get hostname() {
                throw new Error('location error');
            },
        };
        expect(() =>
            run({
                location,
                navigator: { serviceWorker: { register } },
                withConsole: false,
            })
        ).not.toThrow();
        expect(register).toHaveBeenCalledWith('/sw.js');
    });

    test('does not throw on registration failure when console is absent', async () => {
        const register = jest.fn().mockRejectedValue(new Error('failed'));
        const { dispatchEvent } = run({ register, withConsole: false });

        await flush();
        const event = dispatchEvent.mock.calls.find(
            (call) => call[0] && call[0].type === 'serviceWorker:registrationError'
        );
        expect(event).toBeDefined();
    });

    test('skips emitEvent when window.dispatchEvent is not a function', async () => {
        const register = jest.fn().mockResolvedValue({ scope: '/sw.js' });
        expect(() => run({ register, dispatchEvent: 'not a function' })).not.toThrow();

        await flush();
        // Registration still happens; only the event dispatch is skipped.
        expect(register).toHaveBeenCalledWith('/sw.js');
    });

    test('falls back to document.createEvent when CustomEvent is not a function', async () => {
        const initCustomEvent = jest.fn();
        const createEvent = jest.fn().mockReturnValue({ initCustomEvent });
        const { dispatchEvent } = run({ customEvent: null, createEvent });

        await flush();
        expect(createEvent).toHaveBeenCalledWith('CustomEvent');
        expect(initCustomEvent).toHaveBeenCalledWith('serviceWorker:registered', false, false, {
            scope: '/sw.js',
        });
        expect(dispatchEvent).toHaveBeenCalled();
    });

    test('registers immediately when document.readyState is complete', () => {
        const { register, addEventListener } = run({ readyState: 'complete' });
        expect(register).toHaveBeenCalledWith('/sw.js');
        expect(addEventListener).not.toHaveBeenCalled();
    });

    test('waits for the window load event when document is not complete', () => {
        const { register, addEventListener } = run({ readyState: 'loading' });
        expect(register).not.toHaveBeenCalled();
        expect(addEventListener).toHaveBeenCalledWith('load', expect.any(Function));

        const loadCallback = addEventListener.mock.calls.find((call) => call[0] === 'load')[1];
        loadCallback();
        expect(register).toHaveBeenCalledWith('/sw.js');
    });
});
