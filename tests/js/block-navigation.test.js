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
    let handleEscapeKey;
    let getIndexFromFallback;
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
        handleEscapeKey = context.module.exports.handleEscapeKey;
        getIndexFromFallback = context.module.exports.getIndexFromFallback;
    });

    describe('calculateNextIndex', () => {
        beforeEach(() => {});

        it('should return next index when pressing forward keys', () => {
            const customCode = `
                let blocks = [1, 2, 3, 4];
                let currentIndex = 1;
                function getCurrentIndex() { return currentIndex; }
                const KEY_FORWARD = new Set(['ArrowRight', 'ArrowDown']);
                const KEY_BACKWARD = new Set(['ArrowLeft', 'ArrowUp']);
                ${code.match(/function calculateNextIndex\(key\) {[\s\S]*?return Math\.min\(Math\.max\(startIndex \+ delta, 0\), blocks\.length - 1\);\n    }/)[0]}
                module.exports.calculateNextIndexCustom = calculateNextIndex;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            expect(customContext.module.exports.calculateNextIndexCustom('ArrowRight')).toBe(2);
            expect(customContext.module.exports.calculateNextIndexCustom('ArrowDown')).toBe(2);
        });

        it('should return previous index when pressing backward keys', () => {
            const customCode = `
                let blocks = [1, 2, 3, 4];
                let currentIndex = 2;
                function getCurrentIndex() { return currentIndex; }
                const KEY_FORWARD = new Set(['ArrowRight', 'ArrowDown']);
                const KEY_BACKWARD = new Set(['ArrowLeft', 'ArrowUp']);
                ${code.match(/function calculateNextIndex\(key\) {[\s\S]*?return Math\.min\(Math\.max\(startIndex \+ delta, 0\), blocks\.length - 1\);\n    }/)[0]}
                module.exports.calculateNextIndexCustom = calculateNextIndex;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            expect(customContext.module.exports.calculateNextIndexCustom('ArrowLeft')).toBe(1);
            expect(customContext.module.exports.calculateNextIndexCustom('ArrowUp')).toBe(1);
        });

        it('should not exceed blocks.length - 1 when going forward', () => {
            const customCode = `
                let blocks = [1, 2, 3];
                let currentIndex = 2;
                function getCurrentIndex() { return currentIndex; }
                const KEY_FORWARD = new Set(['ArrowRight', 'ArrowDown']);
                const KEY_BACKWARD = new Set(['ArrowLeft', 'ArrowUp']);
                ${code.match(/function calculateNextIndex\(key\) {[\s\S]*?return Math\.min\(Math\.max\(startIndex \+ delta, 0\), blocks\.length - 1\);\n    }/)[0]}
                module.exports.calculateNextIndexCustom = calculateNextIndex;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            expect(customContext.module.exports.calculateNextIndexCustom('ArrowRight')).toBe(2);
        });

        it('should not fall below 0 when going backward', () => {
            const customCode = `
                let blocks = [1, 2, 3];
                let currentIndex = 0;
                function getCurrentIndex() { return currentIndex; }
                const KEY_FORWARD = new Set(['ArrowRight', 'ArrowDown']);
                const KEY_BACKWARD = new Set(['ArrowLeft', 'ArrowUp']);
                ${code.match(/function calculateNextIndex\(key\) {[\s\S]*?return Math\.min\(Math\.max\(startIndex \+ delta, 0\), blocks\.length - 1\);\n    }/)[0]}
                module.exports.calculateNextIndexCustom = calculateNextIndex;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            expect(customContext.module.exports.calculateNextIndexCustom('ArrowLeft')).toBe(0);
        });

        it('should handle currentIndex being -1 by falling back to getCurrentIndex', () => {
            const customCode = `
                let blocks = [1, 2, 3];
                let currentIndex = -1;
                function getCurrentIndex() { return 1; }
                const KEY_FORWARD = new Set(['ArrowRight', 'ArrowDown']);
                const KEY_BACKWARD = new Set(['ArrowLeft', 'ArrowUp']);
                ${code.match(/function calculateNextIndex\(key\) {[\s\S]*?return Math\.min\(Math\.max\(startIndex \+ delta, 0\), blocks\.length - 1\);\n    }/)[0]}
                module.exports.calculateNextIndexCustom = calculateNextIndex;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            expect(customContext.module.exports.calculateNextIndexCustom('ArrowRight')).toBe(2);
        });
    });

    describe('scrollFallback', () => {
        it('should scroll with top offset 0 if isFirstContentBlock is true', () => {
            const mockTarget = {
                getBoundingClientRect: jest.fn().mockReturnValue({ top: 100, height: 200 }),
                offsetHeight: 200,
            };
            const customCode = `
                ${code.match(/function clampScrollTop\(value\) {[\s\S]*?return Math\.max\(0, Math\.min\(value, maxScroll\)\);\n    }/)[0]}
                ${code.match(/function scrollFallback\(target, behavior, isFirstContentBlock\) {[\s\S]*?behavior,\n        \}\);\n    }/)[0]}
                module.exports.scrollFallbackCustom = scrollFallback;
            `;
            const customContext = {
                ...context,
                window: { ...context.window, scrollY: 50, innerHeight: 500 },
                document: { ...context.document, documentElement: { scrollHeight: 1000 } },
            };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            customContext.module.exports.scrollFallbackCustom(mockTarget, 'smooth', true);

            // top: clampScrollTop(100 + 50 - 0) = 150
            expect(customContext.window.scrollTo).toHaveBeenCalledWith({
                top: 150,
                behavior: 'smooth',
            });
        });

        it('should scroll with centered offset if isFirstContentBlock is false', () => {
            const mockTarget = {
                getBoundingClientRect: jest.fn().mockReturnValue({ top: 100, height: 200 }),
                offsetHeight: 200,
            };
            const customCode = `
                ${code.match(/function clampScrollTop\(value\) {[\s\S]*?return Math\.max\(0, Math\.min\(value, maxScroll\)\);\n    }/)[0]}
                ${code.match(/function scrollFallback\(target, behavior, isFirstContentBlock\) {[\s\S]*?behavior,\n        \}\);\n    }/)[0]}
                module.exports.scrollFallbackCustom = scrollFallback;
            `;
            const customContext = {
                ...context,
                window: { ...context.window, scrollY: 50, innerHeight: 500 },
                document: { ...context.document, documentElement: { scrollHeight: 1000 } },
            };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            customContext.module.exports.scrollFallbackCustom(mockTarget, 'smooth', false);

            // offset: Math.max(0, (500 - Math.max(200, 1)) / 2) = (500 - 200) / 2 = 150
            // top: clampScrollTop(100 + 50 - 150) = clampScrollTop(0) = 0
            expect(customContext.window.scrollTo).toHaveBeenCalledWith({
                top: 0,
                behavior: 'smooth',
            });
        });

        it('should use offsetHeight if getBoundingClientRect().height is falsy', () => {
            const mockTarget = {
                getBoundingClientRect: jest.fn().mockReturnValue({ top: 100, height: 0 }),
                offsetHeight: 200,
            };
            const customCode = `
                ${code.match(/function clampScrollTop\(value\) {[\s\S]*?return Math\.max\(0, Math\.min\(value, maxScroll\)\);\n    }/)[0]}
                ${code.match(/function scrollFallback\(target, behavior, isFirstContentBlock\) {[\s\S]*?behavior,\n        \}\);\n    }/)[0]}
                module.exports.scrollFallbackCustom = scrollFallback;
            `;
            const customContext = {
                ...context,
                window: { ...context.window, scrollY: 50, innerHeight: 500 },
                document: { ...context.document, documentElement: { scrollHeight: 1000 } },
            };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            customContext.module.exports.scrollFallbackCustom(mockTarget, 'smooth', false);

            // offset: Math.max(0, (500 - Math.max(200, 1)) / 2) = (500 - 200) / 2 = 150
            // top: clampScrollTop(100 + 50 - 150) = clampScrollTop(0) = 0
            expect(customContext.window.scrollTo).toHaveBeenCalledWith({
                top: 0,
                behavior: 'smooth',
            });
        });
    });

    describe('performScroll', () => {
        it('should scroll to top if isTopSentinel is true', () => {
            const mockTarget = {};
            const customCode = `
                ${code.match(/function performScroll\(target, isTopSentinel, behavior, isFirstContentBlock\) {[\s\S]*?scrollFallback\(target, behavior, isFirstContentBlock\);\n            }\n        }\n    }/)[0]}
                module.exports.performScrollCustom = performScroll;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            customContext.module.exports.performScrollCustom(mockTarget, true, 'smooth', true);

            expect(customContext.window.scrollTo).toHaveBeenCalledWith({
                top: 0,
                behavior: 'smooth',
            });
        });

        it("should use scrollIntoView if scrollIntoView is available and doesn't throw", () => {
            const mockTarget = { scrollIntoView: jest.fn() };
            const customCode = `
                ${code.match(/function performScroll\(target, isTopSentinel, behavior, isFirstContentBlock\) {[\s\S]*?scrollFallback\(target, behavior, isFirstContentBlock\);\n            }\n        }\n    }/)[0]}
                module.exports.performScrollCustom = performScroll;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            customContext.module.exports.performScrollCustom(mockTarget, false, 'smooth', true);

            expect(mockTarget.scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest',
            });
            expect(customContext.window.scrollTo).not.toHaveBeenCalled();
        });

        it('should fallback to scrollFallback if scrollIntoView is not available', () => {
            const mockTarget = {
                getBoundingClientRect: jest.fn().mockReturnValue({ top: 100, height: 200 }),
                offsetHeight: 200,
            };
            const customCode = `
                ${code.match(/function clampScrollTop\(value\) {[\s\S]*?return Math\.max\(0, Math\.min\(value, maxScroll\)\);\n    }/)[0]}
                ${code.match(/function scrollFallback\(target, behavior, isFirstContentBlock\) {[\s\S]*?behavior,\n        \}\);\n    }/)[0]}
                ${code.match(/function performScroll\(target, isTopSentinel, behavior, isFirstContentBlock\) {[\s\S]*?scrollFallback\(target, behavior, isFirstContentBlock\);\n            }\n        }\n    }/)[0]}
                module.exports.performScrollCustom = performScroll;
            `;
            const customContext = {
                ...context,
                window: { ...context.window, scrollY: 50, innerHeight: 500 },
                document: { ...context.document, documentElement: { scrollHeight: 1000 } },
            };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            customContext.module.exports.performScrollCustom(mockTarget, false, 'smooth', true);

            // top: clampScrollTop(100 + 50 - 0) = 150
            expect(customContext.window.scrollTo).toHaveBeenCalledWith({
                top: 150,
                behavior: 'smooth',
            });
        });

        it('should fallback to scrollFallback if scrollIntoView throws an error', () => {
            const mockTarget = {
                scrollIntoView: jest.fn().mockImplementation(() => {
                    throw new Error('Not supported');
                }),
                getBoundingClientRect: jest.fn().mockReturnValue({ top: 100, height: 200 }),
                offsetHeight: 200,
            };
            const customCode = `
                ${code.match(/function clampScrollTop\(value\) {[\s\S]*?return Math\.max\(0, Math\.min\(value, maxScroll\)\);\n    }/)[0]}
                ${code.match(/function scrollFallback\(target, behavior, isFirstContentBlock\) {[\s\S]*?behavior,\n        \}\);\n    }/)[0]}
                ${code.match(/function performScroll\(target, isTopSentinel, behavior, isFirstContentBlock\) {[\s\S]*?scrollFallback\(target, behavior, isFirstContentBlock\);\n            }\n        }\n    }/)[0]}
                module.exports.performScrollCustom = performScroll;
            `;
            const customContext = {
                ...context,
                window: { ...context.window, scrollY: 50, innerHeight: 500 },
                document: { ...context.document, documentElement: { scrollHeight: 1000 } },
            };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            customContext.module.exports.performScrollCustom(mockTarget, false, 'smooth', true);

            // top: clampScrollTop(100 + 50 - 0) = 150
            expect(customContext.window.scrollTo).toHaveBeenCalledWith({
                top: 150,
                behavior: 'smooth',
            });
        });
    });

    describe('scrollToIndex', () => {
        it('should not do anything if index is out of bounds', () => {
            const customCode = `
                let blocks = [1, 2];
                let topSentinel = null;
                function prefersReducedMotion() { return false; }
                function startPending() {}
                ${code.match(/function scrollToIndex\(index\) {[\s\S]*?startPending\(index, behavior\);\n    }/)[0]}
                module.exports.scrollToIndexCustom = scrollToIndex;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);

            customContext.module.exports.scrollToIndexCustom(-1);
            customContext.module.exports.scrollToIndexCustom(2);
            expect(customContext.window.scrollTo).not.toHaveBeenCalled();
        });

        it('should scroll top sentinel to 0', () => {
            const topSentinel = {};
            const customCode = `
                let topSentinel = window.__topSentinel;
                let blocks = [window.__topSentinel, 2];
                function prefersReducedMotion() { return false; }
                function startPending() {}
                ${code.match(/function clampScrollTop\(value\) {[\s\S]*?return Math\.max\(0, Math\.min\(value, maxScroll\)\);\n    }/)[0]}
                ${code.match(/function scrollFallback\(target, behavior, isFirstContentBlock\) {[\s\S]*?behavior,\n        \}\);\n    }/)[0]}
                ${code.match(/function performScroll\(target, isTopSentinel, behavior, isFirstContentBlock\) {[\s\S]*?scrollFallback\(target, behavior, isFirstContentBlock\);\n            }\n        }\n    }/)[0]}
                ${code.match(/function scrollToIndex\(index\) {[\s\S]*?startPending\(index, behavior\);\n    }/)[0]}
                module.exports.scrollToIndexCustom = scrollToIndex;
            `;
            const customContext = {
                ...context,
                window: { ...context.window, __topSentinel: topSentinel },
            };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);

            customContext.module.exports.scrollToIndexCustom(0);
            expect(customContext.window.scrollTo).toHaveBeenCalledWith({
                top: 0,
                behavior: 'smooth',
            });
        });

        it('should call scrollIntoView on the target block', () => {
            const mockTarget = { scrollIntoView: jest.fn() };
            const customCode = `
                let topSentinel = null;
                let blocks = [window.__mockTarget];
                function prefersReducedMotion() { return false; }
                function startPending() {}
                ${code.match(/function clampScrollTop\(value\) {[\s\S]*?return Math\.max\(0, Math\.min\(value, maxScroll\)\);\n    }/)[0]}
                ${code.match(/function scrollFallback\(target, behavior, isFirstContentBlock\) {[\s\S]*?behavior,\n        \}\);\n    }/)[0]}
                ${code.match(/function performScroll\(target, isTopSentinel, behavior, isFirstContentBlock\) {[\s\S]*?scrollFallback\(target, behavior, isFirstContentBlock\);\n            }\n        }\n    }/)[0]}
                ${code.match(/function scrollToIndex\(index\) {[\s\S]*?startPending\(index, behavior\);\n    }/)[0]}
                module.exports.scrollToIndexCustom = scrollToIndex;
            `;
            const customContext = {
                ...context,
                window: { ...context.window, __mockTarget: mockTarget },
            };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);

            customContext.module.exports.scrollToIndexCustom(0);
            expect(mockTarget.scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest',
            });
        });

        it('should call fallback window.scrollTo if scrollIntoView throws', () => {
            const mockTarget = {
                scrollIntoView: jest.fn().mockImplementation(() => {
                    throw new Error('Not supported');
                }),
                getBoundingClientRect: jest.fn().mockReturnValue({ top: 100, height: 50 }),
                offsetHeight: 50,
            };
            const customCode = `
                let topSentinel = null;
                let blocks = [window.__mockTarget];
                function prefersReducedMotion() { return false; }
                function startPending() {}
                ${code.match(/function clampScrollTop\(value\) {[\s\S]*?return Math\.max\(0, Math\.min\(value, maxScroll\)\);\n    }/)[0]}
                ${code.match(/function scrollFallback\(target, behavior, isFirstContentBlock\) {[\s\S]*?behavior,\n        \}\);\n    }/)[0]}
                ${code.match(/function performScroll\(target, isTopSentinel, behavior, isFirstContentBlock\) {[\s\S]*?scrollFallback\(target, behavior, isFirstContentBlock\);\n            }\n        }\n    }/)[0]}
                ${code.match(/function scrollToIndex\(index\) {[\s\S]*?startPending\(index, behavior\);\n    }/)[0]}
                module.exports.scrollToIndexCustom = scrollToIndex;
            `;
            const customContext = {
                ...context,
                window: {
                    ...context.window,
                    __mockTarget: mockTarget,
                    scrollY: 10,
                    innerHeight: 500,
                },
                document: { ...context.document, documentElement: { scrollHeight: 1000 } },
            };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);

            customContext.module.exports.scrollToIndexCustom(0);
            expect(customContext.window.scrollTo).toHaveBeenCalledWith({
                top: 110,
                behavior: 'smooth',
            });
        });
    });

    describe('handleEscapeKey', () => {
        it('should call click and prevent default if .nav-back exists', () => {
            const mockClick = jest.fn();
            const mockPreventDefault = jest.fn();
            const mockEvent = { preventDefault: mockPreventDefault };

            mockDocument.querySelector = jest.fn().mockImplementation((sel) => {
                if (sel === '.nav-back') {
                    return { click: mockClick };
                }
                return null;
            });

            handleEscapeKey(mockEvent);

            expect(mockDocument.querySelector).toHaveBeenCalledWith('.nav-back');
            expect(mockPreventDefault).toHaveBeenCalled();
            expect(mockClick).toHaveBeenCalled();
        });

        it('should do nothing if .nav-back does not exist', () => {
            const mockPreventDefault = jest.fn();
            const mockEvent = { preventDefault: mockPreventDefault };

            mockDocument.querySelector = jest.fn().mockReturnValue(null);

            handleEscapeKey(mockEvent);

            expect(mockDocument.querySelector).toHaveBeenCalledWith('.nav-back');
            expect(mockPreventDefault).not.toHaveBeenCalled();
        });
    });

    describe('debounce', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should debounce function calls and use requestAnimationFrame when available', () => {
            const mockFn = jest.fn();
            const mockCancelAnimationFrame = jest.fn();

            // We can test the exported `debounce` function directly. We just need to ensure
            // the `window` object in our test has the necessary functions.
            // Since `debounce` relies on lexical scope for `window`, we can test it within the vm context
            const customCode = `
                window.cancelAnimationFrame = function(id) {
                    window.__mockCancelAnimationFrame(id);
                };
                window.requestAnimationFrame = function(cb) {
                    window.__rAFCallback = cb;
                    return 123;
                };
                module.exports.debouncedFn = module.exports.debounce(function() {
                    window.__mockFn.apply(this, arguments);
                }, 100);
            `;
            // Must inject a fresh setTimeout mock implementation inside customContext because
            // fakeTimers doesn't automatically wrap vm context setTimeout.
            const customContext = {
                ...context,
                window: {
                    ...context.window,
                    __mockFn: mockFn,
                    __mockCancelAnimationFrame: mockCancelAnimationFrame,
                },
                setTimeout: setTimeout,
                clearTimeout: clearTimeout,
            };
            vm.createContext(customContext);
            vm.runInContext(code, customContext);
            vm.runInContext(customCode, customContext);

            const debouncedFn = customContext.module.exports.debouncedFn;
            debouncedFn('arg1');
            debouncedFn('arg2');

            jest.advanceTimersByTime(150);

            expect(customContext.window.__rAFCallback).not.toBeUndefined();
            customContext.window.__rAFCallback();

            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('arg2');

            debouncedFn('arg3');
            // The first call to setTimeout is scheduled, advance again to trigger cancel
            jest.advanceTimersByTime(150);
            expect(mockCancelAnimationFrame).toHaveBeenCalledWith(123);
        });

        it('should fallback to direct execution if requestAnimationFrame is not available', () => {
            const mockFn = jest.fn();

            const customCode = `
                delete window.requestAnimationFrame;
                delete window.cancelAnimationFrame;
                module.exports.debouncedFn = module.exports.debounce(function() {
                    window.__mockFn.apply(this, arguments);
                }, 100);
            `;
            const customContext = {
                ...context,
                window: { ...context.window, __mockFn: mockFn },
                setTimeout: setTimeout,
                clearTimeout: clearTimeout,
            };
            vm.createContext(customContext);
            vm.runInContext(code, customContext);
            vm.runInContext(customCode, customContext);

            const debouncedFn = customContext.module.exports.debouncedFn;
            debouncedFn('arg1');
            debouncedFn('arg2');

            jest.advanceTimersByTime(150);

            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('arg2');
        });
    });

    describe('getIndexFromFallback', () => {
        it('should return -1 if blockPositions is empty', () => {
            // Need to mock blockPositions, which is an internal variable in the IIFE.
            // Since we can't easily mock it, we'll create a scenario where blockPositions length is 0.
            const customCode = `
                let blockPositions = [];
                ${getIndexFromFallback.toString()}
                module.exports.getIndexFromFallbackCustom = getIndexFromFallback;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            expect(customContext.module.exports.getIndexFromFallbackCustom()).toBe(-1);
        });

        it('should calculate best index based on scroll position and blockPositions', () => {
            const customCode = `
                let blockPositions = [0, 400, 800, 1200];
                ${getIndexFromFallback.toString()}
                module.exports.getIndexFromFallbackCustom = getIndexFromFallback;
            `;
            const customContext = {
                ...context,
                window: { ...context.window, scrollY: 300, innerHeight: 500 },
            };
            // probe = 300 + 125 = 425
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            // 425 >= 0 (best=0), 425 >= 400 (best=1), 425 < 800 (break) -> returns 1
            expect(customContext.module.exports.getIndexFromFallbackCustom()).toBe(1);
        });

        it('should handle probe past all blocks', () => {
            const customCode = `
                let blockPositions = [0, 400, 800];
                ${getIndexFromFallback.toString()}
                module.exports.getIndexFromFallbackCustom = getIndexFromFallback;
            `;
            const customContext = {
                ...context,
                window: { ...context.window, scrollY: 1000, innerHeight: 500 },
            };
            // probe = 1000 + 125 = 1125
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            // 1125 >= 0, >= 400, >= 800 -> returns 2
            expect(customContext.module.exports.getIndexFromFallbackCustom()).toBe(2);
        });
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

    describe('isParagraphElement', () => {
        it('should return true if element matches .post-content p', () => {
            const mockElement = {
                matches: jest.fn().mockReturnValue(true),
            };
            const customCode = `
                ${code.match(/function isParagraphElement\(element\) {[\s\S]*?return \([\s\S]*?\);\n    }/)[0]}
                module.exports.isParagraphElementCustom = isParagraphElement;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            expect(customContext.module.exports.isParagraphElementCustom(mockElement)).toBe(true);
            expect(mockElement.matches).toHaveBeenCalledWith('.post-content p');
        });

        it('should return false if element does not match .post-content p', () => {
            const mockElement = {
                matches: jest.fn().mockReturnValue(false),
            };
            const customCode = `
                ${code.match(/function isParagraphElement\(element\) {[\s\S]*?return \([\s\S]*?\);\n    }/)[0]}
                module.exports.isParagraphElementCustom = isParagraphElement;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            expect(customContext.module.exports.isParagraphElementCustom(mockElement)).toBe(false);
            expect(mockElement.matches).toHaveBeenCalledWith('.post-content p');
        });

        it('should return falsy if element is falsy', () => {
            const customCode = `
                ${code.match(/function isParagraphElement\(element\) {[\s\S]*?return \([\s\S]*?\);\n    }/)[0]}
                module.exports.isParagraphElementCustom = isParagraphElement;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            expect(customContext.module.exports.isParagraphElementCustom(null)).toBeFalsy();
        });

        it('should return falsy if element has no matches method', () => {
            const mockElement = {};
            const customCode = `
                ${code.match(/function isParagraphElement\(element\) {[\s\S]*?return \([\s\S]*?\);\n    }/)[0]}
                module.exports.isParagraphElementCustom = isParagraphElement;
            `;
            const customContext = { ...context };
            vm.createContext(customContext);
            vm.runInContext(customCode, customContext);
            expect(customContext.module.exports.isParagraphElementCustom(mockElement)).toBe(false);
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
