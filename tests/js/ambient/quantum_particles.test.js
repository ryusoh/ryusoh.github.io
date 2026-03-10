const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../../js/ambient/quantum_particles.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('quantum_particles.js - clamp', () => {
    let context;

    beforeEach(() => {
        // Prepare context for VM
        context = {
            document: {
                readyState: 'loading',
                addEventListener: jest.fn(),
                body: { appendChild: jest.fn() },
                createElement: jest.fn(),
            },
            window: {
                addEventListener: jest.fn(),
                innerWidth: 1024,
                innerHeight: 768,
                devicePixelRatio: 1,
            },
            navigator: {},
            console: console,
            Math: Math,
        };

        // Ensure circular references work if needed
        context.window.document = context.document;

        vm.createContext(context);
        vm.runInContext(code, context);
    });

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
