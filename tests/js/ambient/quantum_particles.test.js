const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../../js/ambient/quantum_particles.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('quantum_particles getForceMode', () => {
    let context;

    beforeEach(() => {
        // Prepare context for VM
        context = {
            console: console,
            document: {
                readyState: 'complete',
                addEventListener: jest.fn(),
            },
            window: {
                location: {
                    search: '',
                },
                URLSearchParams: require('url').URLSearchParams,
                innerWidth: 1024,
                innerHeight: 768,
                addEventListener: jest.fn(),
            },
        };
    });

    const getFn = (ctx) => {
        vm.createContext(ctx);
        // We run the code in the context and extract getForceMode.
        // The script may throw during auto-execution logic at the bottom if
        // window/document mocks are incomplete. We can safely ignore these
        // load-time errors because we only need the hoisted getForceMode function.
        try {
            vm.runInContext(code, ctx);
        } catch {
            // Ignore execution errors on load.
        }

        return ctx.getForceMode;
    };

    test('should return null if window is undefined', () => {
        context.window = undefined;
        const getForceMode = getFn(context);
        expect(getForceMode()).toBeNull();
    });

    test('should return null if window.location is undefined', () => {
        context.window.location = undefined;
        const getForceMode = getFn(context);
        expect(getForceMode()).toBeNull();
    });

    test('should return null if window.URLSearchParams is not a function', () => {
        context.window.URLSearchParams = undefined;
        const getForceMode = getFn(context);
        expect(getForceMode()).toBeNull();
    });

    test('should return null if an exception is thrown', () => {
        // Trigger an exception inside the try block.
        // For example, if URLSearchParams throws when instantiated.
        context.window.URLSearchParams = function() {
            throw new Error('Mocked error');
        };
        const getForceMode = getFn(context);
        expect(getForceMode()).toBeNull();
    });

    test('should return ambient param value if provided in search', () => {
        context.window.location.search = '?ambient=trace';
        const getForceMode = getFn(context);
        expect(getForceMode()).toBe('trace');
    });

    test('should return null if ambient param is missing in search', () => {
        context.window.location.search = '?other=value';
        const getForceMode = getFn(context);
        expect(getForceMode()).toBeNull();
    });

    test('should return null if search is empty', () => {
        context.window.location.search = '';
        const getForceMode = getFn(context);
        expect(getForceMode()).toBeNull();
    });
});
