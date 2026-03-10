const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../../js/ambient/quantum_particles.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('quantum_particles.js', () => {
    let context;

    beforeEach(() => {
        // Prepare context for VM
        context = {
            document: {
                readyState: 'complete',
                addEventListener: jest.fn(),
                body: { appendChild: jest.fn() },
                createElement: jest.fn(),
            },
            window: {
                location: {
                    search: '',
                },
                URLSearchParams: require('url').URLSearchParams,
                innerWidth: 1024,
                innerHeight: 768,
                devicePixelRatio: 1,
                addEventListener: jest.fn(),
            },
            navigator: {},
            console: console,
            Math: Math,
        };

        // Ensure circular references work if needed
        context.window.document = context.document;

        vm.createContext(context);
        // The script may throw during auto-execution logic at the bottom if
        // window/document mocks are incomplete. We can safely ignore these
        // load-time errors because we only need the hoisted functions.
        try {
            vm.runInContext(code, context);
        } catch {
            // Ignore execution errors on load.
        }
    });

    describe('getForceMode', () => {
        test('should return null if window is undefined', () => {
            const getForceMode = context.getForceMode;
            const originalWindow = context.window;
            context.window = undefined;
            expect(getForceMode()).toBeNull();
            context.window = originalWindow;
        });

        test('should return null if window.location is undefined', () => {
            const getForceMode = context.getForceMode;
            const originalLocation = context.window.location;
            context.window.location = undefined;
            expect(getForceMode()).toBeNull();
            context.window.location = originalLocation;
        });

        test('should return null if window.URLSearchParams is not a function', () => {
            const getForceMode = context.getForceMode;
            const originalURLSearchParams = context.window.URLSearchParams;
            context.window.URLSearchParams = undefined;
            expect(getForceMode()).toBeNull();
            context.window.URLSearchParams = originalURLSearchParams;
        });

        test('should return ambient param value if provided in search', () => {
            context.window.location.search = '?ambient=trace';
            const getForceMode = context.getForceMode;
            expect(getForceMode()).toBe('trace');
        });

        test('should return null if ambient param is missing in search', () => {
            context.window.location.search = '?other=value';
            const getForceMode = context.getForceMode;
            expect(getForceMode()).toBeNull();
        });

        test('should return null if search is empty', () => {
            context.window.location.search = '';
            const getForceMode = context.getForceMode;
            expect(getForceMode()).toBeNull();
        });
    });

    describe('clamp', () => {
        test('should return the value when it is within the bounds', () => {
            expect(context.clamp(5, 0, 10)).toBe(5);
            expect(context.clamp(0, -10, 10)).toBe(0);
            expect(context.clamp(50.5, 0, 100)).toBe(50.5);
        });

        test('should return the minimum when the value is below the bounds', () => {
            expect(context.clamp(-5, 0, 10)).toBe(0);
            expect(context.clamp(-100, -50, 50)).toBe(-50);
            expect(context.clamp(2.5, 3.5, 10)).toBe(3.5);
        });

        test('should return the maximum when the value is above the bounds', () => {
            expect(context.clamp(15, 0, 10)).toBe(10);
            expect(context.clamp(100, -50, 50)).toBe(50);
            expect(context.clamp(12.5, 3.5, 10)).toBe(10);
        });

        test('should handle values equal to the bounds', () => {
            expect(context.clamp(0, 0, 10)).toBe(0);
            expect(context.clamp(10, 0, 10)).toBe(10);
        });

        test('should handle identical min and max', () => {
            expect(context.clamp(5, 10, 10)).toBe(10);
            expect(context.clamp(15, 10, 10)).toBe(10);
            expect(context.clamp(10, 10, 10)).toBe(10);
        });

        test('should handle negative bounds', () => {
            expect(context.clamp(-15, -20, -10)).toBe(-15);
            expect(context.clamp(-25, -20, -10)).toBe(-20);
            expect(context.clamp(-5, -20, -10)).toBe(-10);
        });
    });
});
