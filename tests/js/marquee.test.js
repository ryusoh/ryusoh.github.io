/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('js/marquee.js', () => {
    let context;
    let code;
    let mockRequestAnimationFrame;

    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = `
            <table id="nav"></table>
        `;
        document.body.setAttribute('data-page-type', 'home');

        mockRequestAnimationFrame = jest.fn((cb) => {
            cb();
        });

        window.requestAnimationFrame = mockRequestAnimationFrame;
        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });

        code = fs.readFileSync(path.join(__dirname, '../../js/marquee.js'), 'utf8');

        context = {
            document: window.document,
            window: window,
            requestAnimationFrame: window.requestAnimationFrame,
            console: window.console,
        };
        context.document.addEventListener = document.addEventListener.bind(document);
        context.document.createElement = document.createElement.bind(document);
        context.window.addEventListener = window.addEventListener.bind(window);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.body.removeAttribute('data-page-type');
    });

    test('initializes marquee elements and appends to DOM', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const wrapper = document.querySelector('.marquee-wrapper');
        const inner = document.querySelector('.marquee-inner');

        expect(wrapper).not.toBeNull();
        expect(inner).not.toBeNull();
        expect(inner.innerHTML).toContain('San Francisco');
        expect(inner.innerHTML).toContain('Street Photography');
        expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    });

    test('updates transform on scroll', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const inner = document.querySelector('.marquee-inner');

        // Simulate scroll
        window.scrollY = 100;
        const scrollEvent = new Event('scroll');
        window.dispatchEvent(scrollEvent);

        expect(mockRequestAnimationFrame).toHaveBeenCalled();
        expect(inner.style.transform).toBe('translate3d(-50px, 0, 0)');
    });

    test('does not initialize if data-page-type is not home', () => {
        document.body.setAttribute('data-page-type', 'project');

        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const wrapper = document.querySelector('.marquee-wrapper');
        expect(wrapper).toBeNull();
    });
});
