/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('js/hover-preview.js', () => {
    let mockTo;
    let mockSetX;
    let mockSetY;
    let context;
    let code;

    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = `
            <table id="nav">
                <td class="portfolio-link"><a href="./p1/">Link 1</a></td>
                <td class="portfolio-link"><a href="./p2/">Link 2</a></td>
            </table>
        `;

        mockTo = jest.fn();
        mockSetX = jest.fn();
        mockSetY = jest.fn();

        window.gsap = {
            to: mockTo,
            set: jest.fn(),
            quickSetter: jest.fn().mockImplementation((target, prop) => {
                if (prop === 'x') {
                    return mockSetX;
                }
                if (prop === 'y') {
                    return mockSetY;
                }
                return jest.fn();
            }),
        };

        window.PortfolioConfig = { enableHoverPreview: true };

        // requestAnimationFrame will just be a mock, not call callback directly
        // to avoid infinite loop callstack exceeded
        window.requestAnimationFrame = jest.fn();

        window.console = { warn: jest.fn() };

        code = fs.readFileSync(path.join(__dirname, '../../js/hover-preview.js'), 'utf8');

        context = {
            document: window.document,
            window: window,
            gsap: window.gsap,
            requestAnimationFrame: window.requestAnimationFrame,
            PortfolioConfig: window.PortfolioConfig,
            console: window.console,
        };
        // Need to attach events explicitly
        context.document.addEventListener = document.addEventListener.bind(document);
        context.document.createElement = document.createElement.bind(document);
        context.document.querySelectorAll = document.querySelectorAll.bind(document);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        delete window.PortfolioConfig;
    });

    test('initializes and runs animations correctly', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const link = document.querySelector('a');

        const mouseenterEvent = new MouseEvent('mouseenter', { clientX: 100, clientY: 100 });
        link.dispatchEvent(mouseenterEvent);

        expect(mockSetX).toHaveBeenCalledWith(120);
        expect(mockSetY).toHaveBeenCalledWith(120);

        const mouseleaveEvent = new MouseEvent('mouseleave');
        link.dispatchEvent(mouseleaveEvent);

        expect(mockTo).toHaveBeenCalledTimes(2); // once for enter, once for leave

        // Simulate mousemove
        const mousemoveEvent = new MouseEvent('mousemove', { clientX: 200, clientY: 200 });
        document.dispatchEvent(mousemoveEvent);
    });

    test('gracefully handles missing GSAP', () => {
        delete context.window.gsap;
        delete context.gsap;

        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(context.window.console.warn).toHaveBeenCalledWith(
            'GSAP is not loaded. Skipping hover preview.'
        );
    });

    test('gracefully exits when disabled via config', () => {
        context.window.PortfolioConfig.enableHoverPreview = false;

        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockSetX).not.toHaveBeenCalled();
    });

    test('exits gracefully if no links found', () => {
        document.body.innerHTML = ''; // No links

        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockSetX).not.toHaveBeenCalled();
    });
});
