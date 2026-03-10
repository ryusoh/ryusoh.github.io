const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Tests for quantum_particles.js
 */

const sourcePath = path.resolve(__dirname, '../../js/ambient/quantum_particles.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('quantum_particles.js', () => {
    let context;

    beforeEach(() => {
        jest.clearAllMocks();

        // Prepare context for VM
        context = {
            window: {
                matchMedia: jest.fn(),
                addEventListener: jest.fn(),
                innerWidth: 1024,
                innerHeight: 768,
                location: { search: '' },
                performance: { now: jest.fn(() => 0) },
                requestAnimationFrame: jest.fn(),
            },
            document: {
                readyState: 'complete',
                addEventListener: jest.fn(),
                createElement: jest.fn(),
                body: {
                    appendChild: jest.fn(),
                },
            },
            console: console,
            Math: Math,
            Date: Date,
            navigator: { connection: {} },
        };

        // Ensure circular references work if needed
        context.window.document = context.document;
        context.document.defaultView = context.window;

        vm.createContext(context);
        vm.runInContext(code, context);
    });

    describe('prefersReducedMotion', () => {
        test('returns false if window.matchMedia is not a function', () => {
            context.window.matchMedia = undefined;
            const result = vm.runInContext('prefersReducedMotion()', context);
            expect(result).toBe(false);
        });

        test('returns true if matchMedia matches prefers-reduced-motion: reduce', () => {
            context.window.matchMedia = jest.fn().mockReturnValue({ matches: true });
            const result = vm.runInContext('prefersReducedMotion()', context);
            expect(context.window.matchMedia).toHaveBeenCalledWith(
                '(prefers-reduced-motion: reduce)'
            );
            expect(result).toBe(true);
        });

        test('returns false if matchMedia does not match prefers-reduced-motion: reduce', () => {
            context.window.matchMedia = jest.fn().mockReturnValue({ matches: false });
            const result = vm.runInContext('prefersReducedMotion()', context);
            expect(context.window.matchMedia).toHaveBeenCalledWith(
                '(prefers-reduced-motion: reduce)'
            );
            expect(result).toBe(false);
        });

        test('returns false if matchMedia throws an error', () => {
            context.window.matchMedia = jest.fn().mockImplementation(() => {
                throw new Error('Test error');
            });
            const result = vm.runInContext('prefersReducedMotion()', context);
            expect(context.window.matchMedia).toHaveBeenCalledWith(
                '(prefers-reduced-motion: reduce)'
            );
            expect(result).toBe(false);
        });
    });
});
