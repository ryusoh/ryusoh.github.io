const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../js/page-transition.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');

describe('page-transition.js: hasTransitionParam', () => {
    let hasTransitionParam;
    let context;

    beforeEach(() => {
        // Extract the hasTransitionParam function source code
        // We do this by parsing the file content to isolate the function,
        // because it is not exported from the IIFE.
        const match = sourceCode.match(/function hasTransitionParam\(\) \{[\s\S]*?\n    \}/);
        if (!match) {
            throw new Error('Could not find hasTransitionParam function in page-transition.js');
        }

        const funcCode = match[0];
        const TRANSITION_PARAM = '__pt'; // Provide the constant it uses

        // Wrap the function to return it
        const wrappedCode = `
            (function() {
                const TRANSITION_PARAM = '${TRANSITION_PARAM}';
                ${funcCode}
                return hasTransitionParam;
            })();
        `;

        context = {
            window: {
                location: {
                    href: 'http://localhost/',
                },
                URL: class URL {
                    constructor() {
                        this.searchParams = {
                            has: jest.fn().mockReturnValue(false),
                        };
                    }
                },
            },
        };

        vm.createContext(context);
        hasTransitionParam = vm.runInContext(wrappedCode, context);
    });

    test('returns false when window.URL throws an error', () => {
        // Mock window.URL constructor to throw
        context.window.URL = class URL {
            constructor() {
                throw new TypeError('Invalid URL');
            }
        };

        const result = hasTransitionParam();
        expect(result).toBe(false);
    });

    test('returns false when window is undefined', () => {
        // Delete window to trigger first if-condition
        context.window = undefined;

        const result = hasTransitionParam();
        expect(result).toBe(false);
    });

    test('returns false when window.location is undefined', () => {
        // Delete window.location to trigger first if-condition
        context.window.location = undefined;

        const result = hasTransitionParam();
        expect(result).toBe(false);
    });

    test('returns true when URL has transition param', () => {
        // Mock window.URL to return searchParams.has = true
        context.window.URL = class URL {
            constructor() {
                this.searchParams = {
                    has: jest.fn().mockReturnValue(true),
                };
            }
        };

        const result = hasTransitionParam();
        expect(result).toBe(true);
    });
});
