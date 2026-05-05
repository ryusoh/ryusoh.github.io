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
                error: jest.fn(),
            },
        };

        // Expose extra functions for testing
        code = code.replace(/const testing = {/, 'const testing = {\n        isNavigationKey,');

        vm.createContext(context);
        vm.runInContext(code, context);

        testing = context.window.__BlockNavigationForTesting;
    });

    describe('calculateNextIndex', () => {
        it('should return correct index based on bounds for empty state', () => {
            // blocks.length is 3 due to beforeEach document setup
            expect(testing.calculateNextIndex('ArrowRight')).toBe(1);
            expect(testing.calculateNextIndex('ArrowLeft')).toBe(0);
        });
    });

    describe('getIndexFromFallback', () => {
        it('should return correct fallback index', () => {
            window.scrollY = 0;
            window.innerHeight = 500;
            expect(testing.getIndexFromFallback()).toBe(2);
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

    describe('rapid ArrowDown bounce bug', () => {
        let observedElements;
        let observerCallback;
        let bounceContext;
        let bounceTesting;

        beforeEach(() => {
            jest.useFakeTimers();

            // Setup DOM with multiple image blocks for scrollable content
            document.documentElement.innerHTML = `<html><body data-page-type="project">
                <div class="intro-header" data-block-nav="block"></div>
                <div class="post-content">
                    <img src="img1.jpg" alt="1" />
                    <img src="img2.jpg" alt="2" />
                    <img src="img3.jpg" alt="3" />
                    <img src="img4.jpg" alt="4" />
                    <img src="img5.jpg" alt="5" />
                </div>
            </body></html>`;

            Object.defineProperty(document.documentElement, 'scrollHeight', {
                value: 5000,
                configurable: true,
            });
            Object.defineProperty(document.body, 'scrollHeight', {
                value: 5000,
                configurable: true,
            });

            observedElements = new Set();

            // Functional IntersectionObserver mock that tracks observed elements
            const MockIO = class {
                constructor(callback) {
                    observerCallback = callback;
                }
                observe(el) {
                    observedElements.add(el);
                }
                unobserve(el) {
                    observedElements.delete(el);
                }
                disconnect() {
                    observedElements.clear();
                }
            };

            // Must set on window so code's `window.IntersectionObserver` check works
            window.IntersectionObserver = MockIO;

            window.scrollTo = jest.fn();
            window.scrollY = 0;

            // Mock scrollIntoView to prevent jsdom warnings
            Element.prototype.scrollIntoView = jest.fn();

            // Create a fresh context with IntersectionObserver on window
            bounceContext = {
                window,
                document: window.document,
                setTimeout: window.setTimeout,
                clearTimeout: window.clearTimeout,
                Number: window.Number,
                Math: window.Math,
                Set: window.Set,
                Event: window.Event,
                console: { warn: jest.fn(), error: jest.fn() },
            };

            const freshCode = code.replace(
                /const testing = {/,
                'const testing = {\n        isNavigationKey,'
            );
            vm.createContext(bounceContext);
            vm.runInContext(freshCode, bounceContext);
            bounceTesting = bounceContext.window.__BlockNavigationForTesting;
        });

        afterEach(() => {
            jest.useRealTimers();
            delete window.IntersectionObserver;
            delete Element.prototype.scrollIntoView;
        });

        it('should NOT observe topSentinel (document.body) with IntersectionObserver', () => {
            // document.body is blocks[0] (topSentinel) — it always intersects
            // the narrow probe zone, causing getIndexFromObserver to return 0
            // when no content block is visible, which resets currentIndex
            expect(observedElements.has(document.body)).toBe(false);
        });

        it('should preserve intended index when pendingTimeout fires mid-scroll', () => {
            // Simulate pressing ArrowDown 3 times rapidly
            for (let i = 0; i < 3; i++) {
                const event = new Event('keydown', { bubbles: true });
                event.key = 'ArrowDown';
                event.preventDefault = jest.fn();
                document.dispatchEvent(event);
            }

            // After 3 presses, calculateNextIndex should return 4 (current=3, +1)
            expect(bounceTesting.calculateNextIndex('ArrowDown')).toBe(4);

            // Simulate observer firing with ONLY topSentinel visible
            // (this is what happens mid-scroll when between content blocks)
            if (observerCallback) {
                observerCallback([{ target: document.body, isIntersecting: true }]);
            }

            // Now simulate the pendingTimeout firing (600ms for smooth scroll)
            jest.advanceTimersByTime(600);

            // After timeout, calculateNextIndex should STILL return 4
            // Bug: without fix, syncCurrentIndex() recalculates from observer
            // which sees body (index 0) as highest visible, resetting currentIndex to 0
            expect(bounceTesting.calculateNextIndex('ArrowDown')).toBe(4);
        });

        it('should not bounce back when no content block is in probe zone after timeout', () => {
            // Press ArrowDown 3 times
            for (let i = 0; i < 3; i++) {
                const event = new Event('keydown', { bubbles: true });
                event.key = 'ArrowDown';
                event.preventDefault = jest.fn();
                document.dispatchEvent(event);
            }

            // Advance past pending timeout
            jest.advanceTimersByTime(600);

            // Simulate observer firing with no blocks visible
            // (mid-scroll, between content blocks, probe zone is empty)
            if (observerCallback) {
                observerCallback([]);
            }

            // Fire scroll-debounce syncCurrentIndex (150ms)
            jest.advanceTimersByTime(200);

            // After all timers settle, the next ArrowDown should continue
            // from index 3, not bounce back to 1
            const nextIndex = bounceTesting.calculateNextIndex('ArrowDown');
            expect(nextIndex).toBeGreaterThanOrEqual(4);
        });
    });

    describe('performScroll', () => {
        let mockTarget;

        beforeEach(() => {
            context.window.scrollTo = jest.fn();
            context.window.console = { warn: jest.fn() };

            mockTarget = {
                scrollIntoView: jest.fn(),
                getBoundingClientRect: jest.fn().mockReturnValue({ top: 100, height: 200 }),
                offsetHeight: 200,
            };
        });

        test('should call window.scrollTo when isTopSentinel is true', () => {
            testing.performScroll(mockTarget, true, 'smooth', true);

            expect(context.window.scrollTo).toHaveBeenCalledWith({
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
            expect(context.window.scrollTo).not.toHaveBeenCalled();
        });

        test('should use fallback window.scrollTo if scrollIntoView throws', () => {
            mockTarget.scrollIntoView.mockImplementation(() => {
                throw new Error('scrollIntoView error');
            });

            testing.performScroll(mockTarget, false, 'smooth', false);

            expect(context.window.console.warn).toHaveBeenCalledWith(
                '[block-navigation] scrollIntoView failed, using fallback:',
                expect.any(Error)
            );

            // Expected fallback logic using clampScrollTop
            // Offset = (500 - 200) / 2 = 150
            // Top = clampScrollTop(100 + 0 - 150) = clampScrollTop(-50) = 0
            expect(context.window.scrollTo).toHaveBeenCalledWith({
                top: 0,
                behavior: 'smooth',
            });
        });
    });
});
