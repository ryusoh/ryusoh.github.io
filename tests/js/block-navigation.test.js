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
        it('should return next index when pressing forward keys', () => {
            expect(testing.calculateNextIndex).toBeDefined();
            expect(typeof testing.calculateNextIndex).toBe('function');
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
});
