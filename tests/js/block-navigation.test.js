const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Tests for block-navigation.js
 */

const sourcePath = path.resolve(__dirname, '../../js/block-navigation.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('block-navigation', () => {
    let clampScrollTop;
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
});
