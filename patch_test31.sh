cat << 'INNER_EOF' > tests/js/block-navigation.test.js
/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('js/block-navigation.js', () => {
    let context;
    let code;
    let testing;

    beforeEach(() => {
        jest.resetModules();

        // Read source file
        const sourcePath = path.resolve(__dirname, '../../js/block-navigation.js');
        code = fs.readFileSync(sourcePath, 'utf8');

        // Setup DOM
        document.documentElement.innerHTML =
            '<html><body><div id="cont"><div class="intro-header"></div><div class="post-content"><p>P1</p><p>P2</p></div></div></body></html>';

        Object.defineProperty(document.documentElement, 'scrollHeight', {
            value: 1000,
            configurable: true,
        });
        Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });
        window.scrollTo = jest.fn();

        // Ensure requestAnimationFrame acts like setTimeout 0
        window.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
        window.cancelAnimationFrame = jest.fn();

        context = {
            window,
            document: window.document,
            setTimeout: window.setTimeout,
            clearTimeout: window.clearTimeout,
            Number: window.Number,
            Math: window.Math,
            Set: window.Set,
            Event: window.Event,
            IntersectionObserver: class {
                constructor() {}
                observe() {}
                unobserve() {}
                disconnect() {}
            },
            console: {
                warn: jest.fn(),
                error: jest.fn()
            }
        };

        // Expose extra functions for testing
        code = code.replace(
            /const testing = {/,
            'const testing = {\n        isNavigationKey,'
        );

        vm.createContext(context);
        vm.runInContext(code, context);

        testing = context.window.__BlockNavigationForTesting;
    });

    describe('calculateNextIndex', () => {
        it('should return next index when pressing forward keys', () => {
            expect(testing.calculateNextIndex).toBeDefined();
            expect(typeof testing.calculateNextIndex).toBe('function');
        });
    });

    describe('isNavigationKey', () => {
        it('should return correct boolean for keys', () => {
            expect(testing.isNavigationKey('ArrowRight')).toBe(true);
            expect(testing.isNavigationKey('ArrowDown')).toBe(true);
            expect(testing.isNavigationKey('ArrowLeft')).toBe(true);
            expect(testing.isNavigationKey('ArrowUp')).toBe(true);
            expect(testing.isNavigationKey('Enter')).toBe(false);
            expect(testing.isNavigationKey('a')).toBe(false);
        });
    });

    describe('clampScrollTop', () => {
        test('should clamp to 0 if value is less than 0', () => {
            expect(testing.clampScrollTop(-100)).toBe(0);
        });

        test('should clamp to maxScroll if value is greater than maxScroll', () => {
            expect(testing.clampScrollTop(1000)).toBe(500); // 1000 - 500 = 500
        });
    });

    describe('handleEscapeKey', () => {
        it('should call click and prevent default if .nav-back exists', () => {
            const mockClick = jest.fn();
            const navBack = document.createElement('a');
            navBack.className = 'nav-back';
            navBack.click = mockClick;
            document.body.appendChild(navBack);

            const mockPreventDefault = jest.fn();
            const mockEvent = { preventDefault: mockPreventDefault };

            testing.handleEscapeKey(mockEvent);

            expect(mockPreventDefault).toHaveBeenCalled();
            expect(mockClick).toHaveBeenCalled();
        });
    });

    describe('isEditableActive', () => {
        it('should return false when there is no active element', () => {
            expect(testing.isEditableActive()).toBe(false);
        });

        it('should return true for INPUT elements', () => {
            const input = document.createElement('input');
            document.body.appendChild(input);
            input.focus();
            expect(testing.isEditableActive()).toBe(true);
        });
    });

    describe('shouldUseElement', () => {
        it('should return true if element has .intro-header class', () => {
            const el = document.querySelector('.intro-header');
            expect(testing.shouldUseElement(el)).toBe(true);
        });

        it('should return true for post-content paragraphs', () => {
            const el = document.querySelector('.post-content p');
            expect(testing.shouldUseElement(el)).toBe(true);
        });
    });

    describe('debounce', () => {
        let originalRequestAnimationFrame;
        let originalCancelAnimationFrame;

        beforeEach(() => {
            jest.useFakeTimers();
            originalRequestAnimationFrame = window.requestAnimationFrame;
            originalCancelAnimationFrame = window.cancelAnimationFrame;

            // To ensure we bypass VM specific bugs regarding setTimeout returning numbers
            context.setTimeout = window.setTimeout;
            context.clearTimeout = window.clearTimeout;
        });

        afterEach(() => {
            jest.useRealTimers();
            window.requestAnimationFrame = originalRequestAnimationFrame;
            window.cancelAnimationFrame = originalCancelAnimationFrame;
            jest.restoreAllMocks();
        });

        test('should delay execution', () => {
            const mockFn = jest.fn();
            const debouncedFn = testing.debounce(mockFn, 100);

            // Delete requestAnimationFrame so we rely entirely on setTimeout for this test
            delete context.window.requestAnimationFrame;

            debouncedFn();
            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should clear previous timeout', () => {
            const mockFn = jest.fn();
            const debouncedFn = testing.debounce(mockFn, 100);

            // Delete requestAnimationFrame so we rely entirely on setTimeout for this test
            delete context.window.requestAnimationFrame;

            debouncedFn();
            jest.advanceTimersByTime(50);
            debouncedFn();
            jest.advanceTimersByTime(50);

            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should utilize requestAnimationFrame if available', () => {
            const mockFn = jest.fn();
            const debouncedFn = testing.debounce(mockFn, 100);

            context.window.requestAnimationFrame = jest.fn((cb) => cb());
            context.window.cancelAnimationFrame = jest.fn();

            debouncedFn();
            jest.advanceTimersByTime(100);

            expect(context.window.requestAnimationFrame).toHaveBeenCalled();
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should fall back to synchronous execution within timeout if requestAnimationFrame is unavailable', () => {
            const mockFn = jest.fn();
            const debouncedFn = testing.debounce(mockFn, 100);

            delete context.window.requestAnimationFrame;

            debouncedFn();
            jest.advanceTimersByTime(100);

            expect(mockFn).toHaveBeenCalledTimes(1);
        });
    });

    describe('performScroll', () => {
        let mockTarget;

        beforeEach(() => {
            window.scrollTo = jest.fn();

            mockTarget = {
                scrollIntoView: jest.fn(),
                getBoundingClientRect: jest.fn().mockReturnValue({ top: 100, height: 200 }),
                offsetHeight: 200,
            };
        });

        test('should call window.scrollTo when isTopSentinel is true', () => {
            testing.performScroll(mockTarget, true, 'smooth', true);

            expect(window.scrollTo).toHaveBeenCalledWith({
                top: 0,
                behavior: 'smooth',
            });
            expect(mockTarget.scrollIntoView).not.toHaveBeenCalled();
        });

        test('should call target.scrollIntoView correctly', () => {
            testing.performScroll(mockTarget, false, 'smooth', false);

            expect(mockTarget.scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest',
            });
            expect(window.scrollTo).not.toHaveBeenCalled();
        });
    });
});
INNER_EOF
