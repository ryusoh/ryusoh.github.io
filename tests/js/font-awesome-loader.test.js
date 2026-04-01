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
            querySelectorAll: jest.fn().mockReturnValue([]),
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
            setInterval: jest.fn((cb) => {
                context.__intervalCb = cb;
                return 123;
            }),
            clearInterval: jest.fn(),
            setTimeout: jest.fn((cb) => {
                context.__timeoutCb = cb;
                return 456;
            }),
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

    describe('handleLoadFailure', () => {
        test('should handle empty NodeList', () => {
            loader.faIcons = [];

            // Should not throw an error when processing an empty list
            expect(() => loader.handleLoadFailure()).not.toThrow();
        });

        test('should process chevron-left fallback correctly', () => {
            const chevron = {
                style: { visibility: 'hidden' },
                dataset: { fahidden: 'true' },
                classList: { contains: (cls) => cls === 'fa-chevron-left' },
                textContent: '',
            };

            loader.faIcons = [chevron];
            loader.handleLoadFailure();

            expect(chevron.textContent).toBe('←');
            expect(chevron.style.visibility).toBe('visible');
            expect(chevron.style.fontSize).toBe('1.5em');
            expect(chevron.style.display).toBeUndefined();
        });

        test('should hide other icons with fahidden=true', () => {
            const otherIcon = {
                style: { visibility: 'hidden' },
                dataset: { fahidden: 'true' },
                classList: { contains: () => false },
                textContent: 'original text',
            };

            loader.faIcons = [otherIcon];
            loader.handleLoadFailure();

            expect(otherIcon.style.display).toBe('none');
            // Unchanged properties
            expect(otherIcon.textContent).toBe('original text');
            expect(otherIcon.style.visibility).toBe('hidden');
            expect(otherIcon.style.fontSize).toBeUndefined();
        });

        test('should ignore icons where fahidden is false', () => {
            const visibleIcon = {
                style: { visibility: 'visible' },
                dataset: { fahidden: 'false' },
                classList: { contains: () => false },
                textContent: 'original text',
            };

            loader.faIcons = [visibleIcon];
            loader.handleLoadFailure();

            // Properties should remain completely untouched
            expect(visibleIcon.style.display).toBeUndefined();
            expect(visibleIcon.textContent).toBe('original text');
            expect(visibleIcon.style.visibility).toBe('visible');
        });

        test('should ignore chevron icons where fahidden is false', () => {
            const visibleChevron = {
                style: { visibility: 'visible' },
                dataset: { fahidden: 'false' },
                classList: { contains: (cls) => cls === 'fa-chevron-left' },
                textContent: '',
            };

            loader.faIcons = [visibleChevron];
            loader.handleLoadFailure();

            // Should not apply fallback logic if fahidden is false
            expect(visibleChevron.textContent).toBe('');
            expect(visibleChevron.style.display).toBeUndefined();
            expect(visibleChevron.style.fontSize).toBeUndefined();
        });

        test('should ignore icons entirely missing the dataset or fahidden property', () => {
            const missingDatasetIcon = {
                style: {},
                dataset: {}, // fahidden is undefined
                classList: { contains: () => false },
                textContent: 'original text',
            };

            loader.faIcons = [missingDatasetIcon];
            loader.handleLoadFailure();

            // Properties should remain completely untouched
            expect(missingDatasetIcon.style.display).toBeUndefined();
            expect(missingDatasetIcon.textContent).toBe('original text');
        });

        test('should handle a mix of all icon types', () => {
            const chevron = {
                style: { visibility: 'hidden' },
                dataset: { fahidden: 'true' },
                classList: { contains: (cls) => cls === 'fa-chevron-left' },
                textContent: '',
            };
            const otherHidden = {
                style: { visibility: 'hidden' },
                dataset: { fahidden: 'true' },
                classList: { contains: () => false },
                textContent: '',
            };
            const visible = {
                style: { visibility: 'visible' },
                dataset: { fahidden: 'false' },
                classList: { contains: () => false },
            };
            const undefinedHidden = {
                style: {},
                dataset: {},
                classList: { contains: () => false },
            };

            loader.faIcons = [chevron, otherHidden, visible, undefinedHidden];

            loader.handleLoadFailure();

            // Chevron logic applied
            expect(chevron.textContent).toBe('←');
            expect(chevron.style.visibility).toBe('visible');

            // Other hidden logic applied
            expect(otherHidden.style.display).toBe('none');

            // Visible ignored
            expect(visible.style.display).toBeUndefined();

            // Undefined ignored
            expect(undefinedHidden.style.display).toBeUndefined();
        });
    });

    test('isFontAwesomeLoaded should return true if FA content is present', () => {
        const mockElement = { className: '', style: {}, setAttribute: jest.fn() };
        context.document.createElement.mockReturnValue(mockElement);
        context.window.getComputedStyle.mockReturnValue({
            content: '"\\f004"',
        });

        const result = loader.isFontAwesomeLoaded();

        expect(context.document.createElement).toHaveBeenCalledWith('i');
        expect(mockElement.className).toBe('fa fa-heart');
        expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
        expect(mockElement.style.cssText).toBe(
            'visibility: hidden; position: absolute; top: -9999px; left: -9999px;'
        );
        expect(context.document.body.appendChild).toHaveBeenCalledWith(mockElement);
        expect(context.window.getComputedStyle).toHaveBeenCalledWith(mockElement, ':before');
        // Now it's not removed immediately
        expect(context.document.body.removeChild).not.toHaveBeenCalled();
        expect(result).toBe(true);
    });

    test('isFontAwesomeLoaded should return false if FA content is not present', () => {
        loader.testElement = null; // Reset
        const mockElement = { className: '', style: {}, setAttribute: jest.fn() };
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

    test('isFontAwesomeLoaded should return false if computedStyle is null or undefined', () => {
        loader.testElement = null; // Reset
        const mockElement = { className: '', style: {}, setAttribute: jest.fn() };
        context.document.createElement.mockReturnValue(mockElement);

        // When window.getComputedStyle returns null (e.g. element is disconnected or in old browsers/edge cases)
        context.window.getComputedStyle.mockReturnValue(null);
        expect(loader.isFontAwesomeLoaded()).toBe(false);

        // When window.getComputedStyle returns undefined
        context.window.getComputedStyle.mockReturnValue(undefined);
        expect(loader.isFontAwesomeLoaded()).toBe(false);
    });

    describe('checking lifecycle', () => {
        beforeEach(() => {
            loader.isFontAwesomeLoaded = jest.fn();
            loader.showIcons = jest.fn();
            loader.handleLoadFailure = jest.fn();
            loader.cleanupTestElement = jest.fn();
        });

        test('startChecking resolves successfully', () => {
            loader.isFontAwesomeLoaded.mockReturnValue(true);
            loader.startChecking();

            expect(context.setInterval).toHaveBeenCalledWith(expect.any(Function), 100);

            // Trigger interval callback
            context.__intervalCb();

            expect(loader.fontAwesomeLoaded).toBe(true);
            expect(loader.showIcons).toHaveBeenCalled();
            expect(context.clearInterval).toHaveBeenCalledWith(123);
            expect(loader.cleanupTestElement).toHaveBeenCalled();
        });

        test('startChecking increments retryCount and handles failure', () => {
            loader.isFontAwesomeLoaded.mockReturnValue(false);
            loader.maxRetries = 2;
            loader.startChecking();

            context.__intervalCb(); // retry 1
            expect(loader.retryCount).toBe(1);
            expect(loader.handleLoadFailure).not.toHaveBeenCalled();

            context.__intervalCb(); // retry 2
            expect(loader.retryCount).toBe(2);
            expect(loader.handleLoadFailure).toHaveBeenCalled();
            expect(context.clearInterval).toHaveBeenCalledWith(123);
        });

        test('stopChecking clears interval and cleans up', () => {
            loader.checkInterval = 123;
            loader.stopChecking();

            expect(context.clearInterval).toHaveBeenCalledWith(123);
            expect(loader.checkInterval).toBeNull();
            expect(loader.cleanupTestElement).toHaveBeenCalled();
        });

        test('cleanupTestElement removes element from DOM', () => {
            const mockParent = { removeChild: jest.fn() };
            loader.testElement = { parentNode: mockParent };

            // Call the real method
            const realCleanup = loader.constructor.prototype.cleanupTestElement.bind(loader);
            realCleanup();

            expect(mockParent.removeChild).toHaveBeenCalledWith(expect.any(Object));
            expect(loader.testElement).toBeNull();
        });

        test('waitForFontLoad checks CSS correctly', () => {
            const mockLink1 = { href: 'https://example.com/style.css' };
            const mockLink2 = { href: 'https://example.com/font-awesome.css', onload: null };
            context.document.querySelectorAll.mockReturnValue([mockLink1, mockLink2]);

            loader.waitForFontLoad();

            // trigger timeout
            context.__timeoutCb();

            expect(context.document.querySelectorAll).toHaveBeenCalledWith(
                'link[rel="stylesheet"]'
            );
            expect(mockLink2.onload).toEqual(expect.any(Function));

            // Trigger onload
            loader.stopChecking = jest.fn();
            mockLink2.onload();

            expect(loader.fontAwesomeLoaded).toBe(true);
            expect(loader.showIcons).toHaveBeenCalled();
            expect(loader.stopChecking).toHaveBeenCalled();
        });

        test('should do nothing if fontAwesomeLoaded is true when CSS onload fires', () => {
            const mockLink1 = { href: 'https://example.com/font-awesome.css', onload: null };
            context.document.querySelectorAll.mockReturnValue([mockLink1]);

            loader.waitForFontLoad();
            context.__timeoutCb();

            // Set it to true before the onload callback executes (simulating the interval check already finding it)
            loader.fontAwesomeLoaded = true;
            loader.stopChecking = jest.fn();

            mockLink1.onload();

            // Should not call showIcons or stopChecking again
            expect(loader.showIcons).not.toHaveBeenCalled();
            expect(loader.stopChecking).not.toHaveBeenCalled();
        });
    });
});
