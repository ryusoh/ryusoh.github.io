/**
 * Tests for block-navigation.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../js/block-navigation.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('block-navigation', () => {
    let clampScrollTop;
    let isEditableActive;
    let shouldUseElement;
    let context;
    let mockDocument;
    let mockWindow;

    beforeEach(() => {
        jest.clearAllMocks();

        mockDocument = {
            documentElement: {
                scrollHeight: 1000,
            },
            body: {
                scrollHeight: 1000,
            },
            readyState: 'complete',
            addEventListener: jest.fn(),
            createTreeWalker: jest.fn().mockReturnValue({
                nextNode: jest.fn().mockReturnValue(false),
            }),
            querySelectorAll: jest.fn().mockReturnValue([]),
            activeElement: null,
            images: [],
        };

        mockWindow = {
            innerHeight: 500,
            scrollY: 0,
            addEventListener: jest.fn(),
            scrollTo: jest.fn(),
            matchMedia: jest.fn().mockReturnValue({ matches: false }),
        };

        // We provide a module object to capture the exports
        const mockModule = {
            exports: {},
        };

        context = {
            document: mockDocument,
            window: mockWindow,
            module: mockModule,
            console: console,
            setTimeout: jest.fn(),
            clearTimeout: jest.fn(),
            Set: Set,
            Array: Array,
            Math: Math,
            Number: Number,
        };

        vm.createContext(context);
        vm.runInContext(code, context);

        clampScrollTop = context.module.exports.clampScrollTop;
        isEditableActive = context.module.exports.isEditableActive;
        shouldUseElement = context.module.exports.shouldUseElement;
    });

    describe('clampScrollTop', () => {
        test('should clamp to 0 if value is less than 0', () => {
            mockDocument.documentElement.scrollHeight = 1000;
            mockWindow.innerHeight = 500;
            // maxScroll = 500
            expect(clampScrollTop(-100)).toBe(0);
        });

        test('should clamp to maxScroll if value is greater than maxScroll', () => {
            mockDocument.documentElement.scrollHeight = 1000;
            mockWindow.innerHeight = 500;
            // maxScroll = 500
            expect(clampScrollTop(600)).toBe(500);
        });

        test('should return value if it is between 0 and maxScroll', () => {
            mockDocument.documentElement.scrollHeight = 1000;
            mockWindow.innerHeight = 500;
            // maxScroll = 500
            expect(clampScrollTop(250)).toBe(250);
        });

        test('should clamp to 0 if maxScroll is less than 0', () => {
            mockDocument.documentElement.scrollHeight = 400;
            mockWindow.innerHeight = 500;
            // maxScroll = -100
            // Since maxScroll < 0, it should return Math.max(0, value)
            expect(clampScrollTop(200)).toBe(200);
            expect(clampScrollTop(-50)).toBe(0);
        });

        test('should clamp to Math.max(0, value) if maxScroll is not finite', () => {
            mockDocument.documentElement.scrollHeight = NaN;
            mockWindow.innerHeight = 500;
            // maxScroll = NaN
            expect(clampScrollTop(300)).toBe(300);
            expect(clampScrollTop(-100)).toBe(0);
        });
    });

    describe('isEditableActive', () => {
        it('should return false when there is no active element', () => {
            context.document.activeElement = null;
            expect(isEditableActive()).toBe(false);
        });

        it('should return false for non-editable generic elements', () => {
            context.document.activeElement = {
                tagName: 'DIV',
                isContentEditable: false,
            };
            expect(isEditableActive()).toBe(false);
        });

        it('should return true for contenteditable elements', () => {
            context.document.activeElement = {
                tagName: 'DIV',
                isContentEditable: true,
            };
            expect(isEditableActive()).toBe(true);
        });

        it('should return true for INPUT elements', () => {
            context.document.activeElement = {
                tagName: 'INPUT',
                isContentEditable: false,
            };
            expect(isEditableActive()).toBe(true);
        });

        it('should return true for TEXTAREA elements', () => {
            context.document.activeElement = {
                tagName: 'TEXTAREA',
                isContentEditable: false,
            };
            expect(isEditableActive()).toBe(true);
        });

        it('should return true for SELECT elements', () => {
            context.document.activeElement = {
                tagName: 'SELECT',
                isContentEditable: false,
            };
            expect(isEditableActive()).toBe(true);
        });
    });

    describe('shouldUseElement', () => {
        const createMockElement = (matchesSelector, closestSelector) => ({
            matches: jest.fn((selector) => {
                if (matchesSelector === undefined) {
                    return false;
                }
                if (typeof matchesSelector === 'string') {
                    return selector === matchesSelector;
                }
                if (typeof matchesSelector === 'function') {
                    return matchesSelector(selector);
                }
                if (Array.isArray(matchesSelector)) {
                    return matchesSelector.includes(selector);
                }
                return matchesSelector;
            }),
            closest: jest.fn((selector) => {
                if (closestSelector === undefined) {
                    return null;
                }
                if (typeof closestSelector === 'string') {
                    return selector === closestSelector ? {} : null;
                }
                if (typeof closestSelector === 'function') {
                    return closestSelector(selector) ? {} : null;
                }
                if (Array.isArray(closestSelector)) {
                    return closestSelector.includes(selector) ? {} : null;
                }
                return closestSelector ? {} : null;
            }),
        });

        it('should return false if element is falsy', () => {
            expect(shouldUseElement(null)).toBe(false);
            expect(shouldUseElement(undefined)).toBe(false);
        });

        it('should return false for script, style, noscript elements', () => {
            const el = createMockElement('script, style, noscript');
            expect(shouldUseElement(el)).toBe(false);
            expect(el.matches).toHaveBeenCalledWith('script, style, noscript');
        });

        it('should return false if element is within an ignored block', () => {
            const el = createMockElement(false, '[data-block-nav="ignore"]');
            expect(shouldUseElement(el)).toBe(false);
            expect(el.closest).toHaveBeenCalledWith('[data-block-nav="ignore"]');
        });

        it('should return true if element has data-block-nav="block"', () => {
            const el = createMockElement('[data-block-nav="block"]');
            expect(shouldUseElement(el)).toBe(true);
        });

        it('should return false if element is a child of an explicitly declared block', () => {
            const el = createMockElement(false, '[data-block-nav="block"]');
            expect(shouldUseElement(el)).toBe(false);
        });

        it('should return true if element has .intro-header class', () => {
            const el = createMockElement('.intro-header');
            expect(shouldUseElement(el)).toBe(true);
        });

        it('should return false for .post-heading if it is inside .intro-header', () => {
            const el = createMockElement('.post-heading', '.intro-header');
            expect(shouldUseElement(el)).toBe(false);
        });

        it('should return true if element matches BLOCK_ELEMENT_SELECTOR', () => {
            // Need to match against the exact string or use a custom function
            const BLOCK_ELEMENT_SELECTOR = [
                '.post-heading',
                '.post-content h1',
                '.post-content h2',
                '.post-content h3',
                '.post-content h4',
                '.post-content h5',
                '.post-content h6',
                '.post-content p',
                '.post-content img',
                '.post-content figure',
                '.post-content blockquote',
                '.post-content li',
                '.post-content pre',
                '.post-content table',
                '.post-content video',
                '.post-content .visual-block',
            ].join(', ');

            const el = createMockElement(BLOCK_ELEMENT_SELECTOR);
            expect(shouldUseElement(el)).toBe(true);
        });

        it('should return false if it does not match any known selector rules', () => {
            const el = createMockElement(false, false);
            expect(shouldUseElement(el)).toBe(false);
        });
    });
});
