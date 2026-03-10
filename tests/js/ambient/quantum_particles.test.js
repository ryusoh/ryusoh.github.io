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
                URLSearchParams: URLSearchParams,
                innerWidth: 1024,
                innerHeight: 768,
                addEventListener: jest.fn(),
            },
        };

        // Handle the self-invoking nature or function declarations in the script
        // We only care about testing getForceMode here.
        // We will run the code in the context and extract getForceMode.
    });

    const getFn = (ctx) => {
        vm.createContext(ctx);
        // We wrap the code to return getForceMode function without throwing
        // errors from auto-execution logic at the bottom if window/document are partially mocked.
        // Actually, the easiest way is to just run it and grab the function from context.
        // Since getForceMode is a global function in the script, it should be added to the context.

        // We need to bypass the auto-execution at the bottom (ready(...))
        // which might crash if the mock is not complete enough for initParticles.
        // We can mock `ready` to do nothing just for these tests, or mock the things it needs.

        // Let's provide a robust enough window/document mock to avoid crash,
        // or we can overwrite `ready` in context before execution.

        // Let's just run it:
        try {
            vm.runInContext(code, ctx);
        } catch (e) {
            // Ignore execution errors on load, we just want the function
            // Actually it's better to make sure it loads without error.
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
