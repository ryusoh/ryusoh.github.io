const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../js/block-navigation.js');
const rawCode = fs.readFileSync(sourcePath, 'utf8');

// The block-navigation.js is wrapped in an IIFE: (function () { ... })();
// To test the internal function isEditableActive, we can rewrite the IIFE
// to return the internal functions we want to test.
const testableCode = rawCode.replace(
    /}\)\(\);/g,
    `
        return {
            isEditableActive,
            // Expose others if needed in the future
        };
    })();`
);

describe('block-navigation', () => {
    let context;
    let moduleExports;

    beforeEach(() => {
        jest.clearAllMocks();

        // Basic DOM mock needed for block-navigation.js to initialize
        const mockDocument = {
            readyState: 'complete', // avoid adding event listeners for ready
            addEventListener: jest.fn(),
            body: {},
            documentElement: {},
            activeElement: null,
            images: [],
            createTreeWalker: jest.fn().mockReturnValue({
                nextNode: jest.fn().mockReturnValue(null),
            }),
        };

        const mockWindow = {
            matchMedia: jest.fn(),
            addEventListener: jest.fn(),
            scrollY: 0,
            innerHeight: 1000,
        };

        context = {
            document: mockDocument,
            window: mockWindow,
            console: console,
            setTimeout: jest.fn(),
            clearTimeout: jest.fn(),
        };

        vm.createContext(context);
        moduleExports = vm.runInContext(testableCode, context);
    });

    describe('isEditableActive', () => {
        it('should return false when there is no active element', () => {
            context.document.activeElement = null;
            expect(moduleExports.isEditableActive()).toBe(false);
        });

        it('should return false for non-editable generic elements', () => {
            context.document.activeElement = {
                tagName: 'DIV',
                isContentEditable: false,
            };
            expect(moduleExports.isEditableActive()).toBe(false);
        });

        it('should return true for contenteditable elements', () => {
            context.document.activeElement = {
                tagName: 'DIV',
                isContentEditable: true,
            };
            expect(moduleExports.isEditableActive()).toBe(true);
        });

        it('should return true for INPUT elements', () => {
            context.document.activeElement = {
                tagName: 'INPUT',
                isContentEditable: false,
            };
            expect(moduleExports.isEditableActive()).toBe(true);
        });

        it('should return true for TEXTAREA elements', () => {
            context.document.activeElement = {
                tagName: 'TEXTAREA',
                isContentEditable: false,
            };
            expect(moduleExports.isEditableActive()).toBe(true);
        });

        it('should return true for SELECT elements', () => {
            context.document.activeElement = {
                tagName: 'SELECT',
                isContentEditable: false,
            };
            expect(moduleExports.isEditableActive()).toBe(true);
        });
    });
});
