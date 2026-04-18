/**
 * @jest-environment jsdom
 */

describe('block-navigation', () => {
    let testing;

    beforeEach(() => {
        jest.resetModules();
        document.documentElement.innerHTML =
            '<html><body><div id="cont"><div class="intro-header"></div><div class="post-content"><p>P1</p><p>P2</p></div></div></body></html>';

        // Mock scrollHeight
        Object.defineProperty(document.documentElement, 'scrollHeight', {
            value: 1000,
            configurable: true,
        });
        Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });
        window.scrollTo = jest.fn();

        require('../../js/block-navigation.js');
        testing = window.__BlockNavigationForTesting;
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
            delete window.requestAnimationFrame;

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
            delete window.requestAnimationFrame;

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

            window.requestAnimationFrame = jest.fn((cb) => cb());
            window.cancelAnimationFrame = jest.fn();

            debouncedFn();
            jest.advanceTimersByTime(100);

            expect(window.requestAnimationFrame).toHaveBeenCalled();
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should fall back to synchronous execution within timeout if requestAnimationFrame is unavailable', () => {
            const mockFn = jest.fn();
            const debouncedFn = testing.debounce(mockFn, 100);

            delete window.requestAnimationFrame;

            debouncedFn();
            jest.advanceTimersByTime(100);

            expect(mockFn).toHaveBeenCalledTimes(1);
        });
    });

    describe('performScroll', () => {
        let mockTarget;

        beforeEach(() => {
            window.scrollTo = jest.fn();
            window.console = { warn: jest.fn() };

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

        test('should use fallback window.scrollTo if scrollIntoView throws', () => {
            mockTarget.scrollIntoView.mockImplementation(() => {
                throw new Error('scrollIntoView error');
            });

            testing.performScroll(mockTarget, false, 'smooth', false);

            expect(window.console.warn).toHaveBeenCalledWith(
                '[block-navigation] scrollIntoView failed, using fallback:',
                expect.any(Error)
            );

            // Expected fallback logic using clampScrollTop
            // Offset = (500 - 200) / 2 = 150
            // Top = clampScrollTop(100 + 0 - 150) = clampScrollTop(-50) = 0
            expect(window.scrollTo).toHaveBeenCalledWith({
                top: 0,
                behavior: 'smooth',
            });
        });
    });
});
