const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Tests for cdnFallback.js
 *
 * NOTE: We use manual mocks for the DOM environment because the 'jest-environment-jsdom'
 * package was not available in the environment and could not be installed due to
 * network restrictions. The mocks are designed to be just sufficient for the
 * functionality being tested.
 */

const sourcePath = path.resolve(__dirname, '../../js/loader/cdnFallback.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('CDNLoader', () => {
    let context;

    beforeEach(() => {
        jest.clearAllMocks();

        // Define mock objects
        const mockDocument = {
            createElement: jest.fn(),
            createDocumentFragment: jest.fn(),
            head: {
                appendChild: jest.fn(),
            },
        };

        const mockWindow = {};

        // Prepare context for VM
        context = {
            document: mockDocument,
            window: mockWindow,
            console: console,
            fetch: jest.fn(),
            Promise: Promise,
        };
        // Add circular reference to allow proper evaluation of "window.document" if used
        context.window.document = mockDocument;
        context.document.defaultView = mockWindow;

        vm.createContext(context);

        // Run the code.
        vm.runInContext(code, context);
    });

    describe('preconnect', () => {
        test('should append a preconnect link for each origin', () => {
            const origins = ['https://cdn.example.com', 'https://fonts.example.com'];

            const mockFragment = {
                appendChild: jest.fn(),
            };

            context.document.createDocumentFragment.mockReturnValue(mockFragment);

            // Provide a mock element whenever document.createElement is called
            context.document.createElement.mockImplementation((tag) => {
                if (tag === 'link') {
                    return {};
                }
                return {};
            });

            context.window.CDNLoader.preconnect(origins);

            expect(context.document.createDocumentFragment).toHaveBeenCalledTimes(1);
            expect(context.document.createElement).toHaveBeenCalledTimes(2);
            expect(context.document.createElement).toHaveBeenNthCalledWith(1, 'link');
            expect(context.document.createElement).toHaveBeenNthCalledWith(2, 'link');

            expect(mockFragment.appendChild).toHaveBeenCalledTimes(2);

            // Check the properties assigned to the created elements
            const firstLink = mockFragment.appendChild.mock.calls[0][0];
            expect(firstLink.rel).toBe('preconnect');
            expect(firstLink.href).toBe('https://cdn.example.com');
            expect(firstLink.crossOrigin).toBe('anonymous');

            const secondLink = mockFragment.appendChild.mock.calls[1][0];
            expect(secondLink.rel).toBe('preconnect');
            expect(secondLink.href).toBe('https://fonts.example.com');
            expect(secondLink.crossOrigin).toBe('anonymous');

            expect(context.document.head.appendChild).toHaveBeenCalledTimes(1);
            expect(context.document.head.appendChild).toHaveBeenCalledWith(mockFragment);
        });

        test('should not append anything if origins array is empty', () => {
            const mockFragment = {
                appendChild: jest.fn(),
            };
            context.document.createDocumentFragment.mockReturnValue(mockFragment);

            context.window.CDNLoader.preconnect([]);

            expect(context.document.createElement).not.toHaveBeenCalled();
            expect(mockFragment.appendChild).not.toHaveBeenCalled();
            // Code always appends fragment even if empty
            expect(context.document.head.appendChild).toHaveBeenCalledWith(mockFragment);
        });

        test('should catch and suppress exceptions silently', () => {
            // Force createElement to throw
            context.document.createElement.mockImplementation(() => {
                throw new Error('Mock DOM Exception');
            });

            // If the error is caught, the function will not throw
            expect(() => {
                context.window.CDNLoader.preconnect(['https://cdn.example.com']);
            }).not.toThrow();
        });
    });
});
