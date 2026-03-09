const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Tests for FontAwesomeLoader class
 *
 * NOTE: We use manual mocks for the DOM environment because the 'jest-environment-jsdom'
 * package was not available in the environment and could not be installed due to
 * network restrictions. The mocks are designed to be just sufficient for the
 * functionality being tested.
 */

const sourcePath = path.resolve(__dirname, '../../js/font-awesome-loader.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('FontAwesomeLoader', () => {
    let loader;
    let context;

    beforeEach(() => {
        jest.clearAllMocks();

        // Define mock objects
        const mockDocument = {
            querySelectorAll: jest.fn(),
            createElement: jest.fn(),
            body: {
                appendChild: jest.fn(),
                removeChild: jest.fn(),
                innerHTML: '',
            },
            addEventListener: jest.fn(),
            querySelector: jest.fn(),
        };

        const mockWindow = {
            getComputedStyle: jest.fn(),
            setInterval: jest.fn(),
            clearInterval: jest.fn(),
            setTimeout: jest.fn(),
            addEventListener: jest.fn(),
        };

        // Prepare context for VM
        context = {
            document: mockDocument,
            window: mockWindow,
            console: console,
            setInterval: jest.fn(),
            clearInterval: jest.fn(),
            setTimeout: jest.fn(),
        };
        // Ensure circular references work if needed
        context.window.document = mockDocument;
        context.document.defaultView = mockWindow;

        vm.createContext(context);

        // Run the code. We might need to wrap it to ensure FontAwesomeLoader
        // is actually assigned to the context object if it's just a class declaration.
        vm.runInContext(code, context);

        // If FontAwesomeLoader is not on context, it might be because of how vm works with 'class'
        // Let's check and try an alternative if needed.
        if (typeof context.FontAwesomeLoader !== 'function') {
            // Fallback: wrap code to explicitly return the class
            const wrappedCode = `(function() { ${code}; return FontAwesomeLoader; })()`;
            const FontAwesomeLoaderClass = vm.runInContext(wrappedCode, context);
            loader = new FontAwesomeLoaderClass();
        } else {
            loader = new context.FontAwesomeLoader();
        }
    });

    test('setupPlaceholderHandling should hide icons and set data-fahidden', () => {
        const mockIcons = [
            { style: {}, dataset: {}, classList: { contains: () => false } },
            { style: {}, dataset: {}, classList: { contains: () => false } },
        ];

        loader.faIcons = mockIcons;
        loader.setupPlaceholderHandling();

        mockIcons.forEach((icon) => {
            expect(icon.style.visibility).toBe('hidden');
            expect(icon.dataset.fahidden).toBe('true');
        });
    });

    test('showIcons should restore visibility and clear data-fahidden', () => {
        const mockIcons = [
            { style: { visibility: 'hidden' }, dataset: { fahidden: 'true' } },
            { style: { visibility: 'hidden' }, dataset: { fahidden: 'true' } },
        ];

        loader.faIcons = mockIcons;
        loader.showIcons();

        mockIcons.forEach((icon) => {
            expect(icon.style.visibility).toBe('');
            expect(icon.dataset.fahidden).toBe('');
        });
    });

    test('handleLoadFailure should handle chevron-left fallback and other icons', () => {
        // Test Case: Chevron left should be replaced with unicode arrow and made visible
        const chevron = {
            style: { visibility: 'hidden' },
            dataset: { fahidden: 'true' },
            classList: { contains: (cls) => cls === 'fa-chevron-left' },
            textContent: '',
        };
        // Test Case: Other icons with fahidden=true should be hidden with display: none
        const other = {
            style: { visibility: 'hidden' },
            dataset: { fahidden: 'true' },
            classList: { contains: () => false },
            textContent: '',
        };
        // Test Case: Icons WITHOUT fahidden=true should be left untouched
        const normal = {
            style: {},
            dataset: {},
            classList: { contains: () => false },
        };

        loader.faIcons = [chevron, other, normal];

        loader.handleLoadFailure();

        // Check chevron behavior
        expect(chevron.textContent).toBe('←');
        expect(chevron.style.visibility).toBe('visible');
        expect(chevron.style.fontSize).toBe('1.5em');

        // Check other icon behavior
        expect(other.style.display).toBe('none');

        // Check normal icon behavior
        expect(normal.style.display).toBeUndefined();
    });

    test('isFontAwesomeLoaded should return true if FA content is present', () => {
        const mockElement = { className: '', style: {} };
        context.document.createElement.mockReturnValue(mockElement);
        context.window.getComputedStyle.mockReturnValue({
            content: '"\\f004"',
        });

        const result = loader.isFontAwesomeLoaded();

        expect(context.document.createElement).toHaveBeenCalledWith('i');
        expect(context.document.body.appendChild).toHaveBeenCalledWith(mockElement);
        expect(context.window.getComputedStyle).toHaveBeenCalledWith(mockElement, ':before');
        expect(context.document.body.removeChild).toHaveBeenCalledWith(mockElement);
        expect(result).toBe(true);
    });

    test('isFontAwesomeLoaded should return false if FA content is not present', () => {
        const mockElement = { className: '', style: {} };
        context.document.createElement.mockReturnValue(mockElement);

        // Mock non-existent content
        context.window.getComputedStyle.mockReturnValue({
            content: 'none',
        });

        expect(loader.isFontAwesomeLoaded()).toBe(false);

        context.window.getComputedStyle.mockReturnValue({
            content: '""',
        });
        expect(loader.isFontAwesomeLoaded()).toBe(false);

        // When computedStyle.content is undefined
        context.window.getComputedStyle.mockReturnValue({
            content: undefined,
        });
        expect(!!loader.isFontAwesomeLoaded()).toBe(false);
    });
});
