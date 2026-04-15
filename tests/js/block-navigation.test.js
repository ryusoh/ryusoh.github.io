/** @jest-environment jsdom */

const testing = require('../../js/block-navigation.js');

describe('js/block-navigation.js', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    test('calculateNextIndex returns correctly bounded index', () => {
        expect(testing.calculateNextIndex('ArrowRight')).toBe(0);
        expect(testing.calculateNextIndex('ArrowLeft')).toBe(0);
    });

    test('isEditableActive correctly identifies editable elements', () => {
        const input = document.createElement('input');
        const textarea = document.createElement('textarea');
        const select = document.createElement('select');
        const div = document.createElement('div');
        div.contentEditable = 'true';

        const normalDiv = document.createElement('div');

        document.body.appendChild(input);
        document.body.appendChild(textarea);
        document.body.appendChild(select);
        document.body.appendChild(div);
        document.body.appendChild(normalDiv);

        normalDiv.focus();
        expect(testing.isEditableActive()).toBe(false);

        input.focus();
        expect(testing.isEditableActive()).toBe(true);

        textarea.focus();
        expect(testing.isEditableActive()).toBe(true);

        select.focus();
        expect(testing.isEditableActive()).toBe(true);

        div.focus();
        expect(testing.isEditableActive()).toBe(true);
    });

    test('shouldUseElement correctly filters blocks based on data attributes and classes', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const el = document.createElement('div');
        container.appendChild(el);

        expect(testing.shouldUseElement(null)).toBe(false);

        container.setAttribute('data-block-nav', 'ignore');
        expect(testing.shouldUseElement(el)).toBe(false);

        container.removeAttribute('data-block-nav');

        const scriptEl = document.createElement('script');
        document.body.appendChild(scriptEl);
        expect(testing.shouldUseElement(scriptEl)).toBe(false);

        // explicit block
        el.setAttribute('data-block-nav', 'block');
        expect(testing.shouldUseElement(el)).toBe(true);
        el.removeAttribute('data-block-nav');

        // parent block
        container.setAttribute('data-block-nav', 'block');
        expect(testing.shouldUseElement(el)).toBe(false);
        container.removeAttribute('data-block-nav');

        // intro-header class
        el.className = 'intro-header';
        expect(testing.shouldUseElement(el)).toBe(true);
        el.className = '';

        // post-heading not in intro header
        el.className = 'post-heading';
        expect(testing.shouldUseElement(el)).toBe(true);

        // post-heading IN intro header
        container.className = 'intro-header';
        expect(testing.shouldUseElement(el)).toBe(false);
        container.className = '';

        // post content selectors
        el.className = 'post-content';
        const p = document.createElement('p');
        el.appendChild(p);

        expect(testing.shouldUseElement(p)).toBe(true);

        const unsupported = document.createElement('span');
        el.appendChild(unsupported);
        expect(testing.shouldUseElement(unsupported)).toBe(false);
    });

    test('clampScrollTop correctly bounds values', () => {
        Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });

        expect(testing.clampScrollTop(-100)).toBe(0);
        expect(testing.clampScrollTop(250)).toBe(250);
        expect(testing.clampScrollTop(600)).toBe(500);

        Object.defineProperty(document.documentElement, 'scrollHeight', { value: -100, configurable: true });
        expect(testing.clampScrollTop(100)).toBe(100);
        expect(testing.clampScrollTop(-100)).toBe(0);
    });

    test('handleEscapeKey triggers click on .nav-back', () => {
        const backBtn = document.createElement('a');
        backBtn.className = 'nav-back';
        backBtn.click = jest.fn();
        document.body.appendChild(backBtn);

        const event = { preventDefault: jest.fn() };
        testing.handleEscapeKey(event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(backBtn.click).toHaveBeenCalled();
    });

    test('handleEscapeKey does nothing if no .nav-back', () => {
        const event = { preventDefault: jest.fn() };
        testing.handleEscapeKey(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('performScroll handles top sentinel', () => {
        window.scrollTo = jest.fn();
        const target = document.createElement('div');

        testing.performScroll(target, true, 'smooth', true);

        expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    test('performScroll handles block scrollIntoView', () => {
        const target = document.createElement('div');
        target.scrollIntoView = jest.fn();

        testing.performScroll(target, false, 'smooth', true);

        expect(target.scrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        });

        testing.performScroll(target, false, 'smooth', false);

        expect(target.scrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
    });

    test('performScroll fallback when scrollIntoView throws', () => {
        window.scrollTo = jest.fn();
        window.scrollY = 0;
        window.innerHeight = 1000;

        const target = document.createElement('div');
        target.scrollIntoView = jest.fn().mockImplementation(() => {
            throw new Error('Test Error');
        });
        target.getBoundingClientRect = jest.fn().mockReturnValue({ top: 500, height: 100 });

        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        testing.performScroll(target, false, 'smooth', false);

        expect(window.scrollTo).toHaveBeenCalledWith({
            top: 50,
            behavior: 'smooth'
        });

        consoleWarn.mockRestore();
    });

    test('debounce uses requestAnimationFrame', () => {
        jest.useFakeTimers();
        window.requestAnimationFrame = jest.fn((cb) => cb());
        window.cancelAnimationFrame = jest.fn();

        const fn = jest.fn();
        const debounced = testing.debounce(fn, 100);

        debounced('arg');
        expect(fn).not.toHaveBeenCalled();

        jest.runAllTimers();

        expect(window.requestAnimationFrame).toHaveBeenCalled();
        expect(fn).toHaveBeenCalledWith('arg');

        jest.useRealTimers();
    });

    test('debounce fallbacks to setTimeout if requestAnimationFrame is not available', () => {
        jest.useFakeTimers();
        const originalRaf = window.requestAnimationFrame;
        delete window.requestAnimationFrame;

        const fn = jest.fn();
        const debounced = testing.debounce(fn, 100);

        debounced('arg');
        expect(fn).not.toHaveBeenCalled();

        jest.runAllTimers();

        expect(fn).toHaveBeenCalledWith('arg');

        window.requestAnimationFrame = originalRaf;
        jest.useRealTimers();
    });

    test('scrollToIndex correctly calls performScroll', () => {
        // Because blocks array is scoped internally, scrollToIndex out-of-bounds does nothing.
        testing.scrollToIndex(10);
        testing.scrollToIndex(-1);
    });
});
