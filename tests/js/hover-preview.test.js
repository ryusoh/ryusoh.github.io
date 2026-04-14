/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('hover-preview.js', () => {
    let context;
    let mockTo;
    let mockSetX;
    let mockSetY;

    beforeEach(() => {
        // Setup simple DOM structure
        document.body.innerHTML = `
            <table id="nav">
                <td class="portfolio-link"><a href="./p1/">Link 1</a></td>
                <td class="portfolio-link"><a href="./p2/">Link 2</a></td>
            </table>
        `;

        mockTo = jest.fn();
        mockSetX = jest.fn();
        mockSetY = jest.fn();

        const mockGsap = {
            to: mockTo,
            quickSetter: jest.fn().mockImplementation((target, prop) => {
                if (prop === 'x') {return mockSetX;}
                if (prop === 'y') {return mockSetY;}
                return jest.fn();
            }),
        };

        context = vm.createContext({
            document,
            window: {
                console: { warn: jest.fn() },
                requestAnimationFrame: jest.fn(),
            },
            gsap: mockGsap,
            requestAnimationFrame: jest.fn(),
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    test('initializes without throwing', () => {
        const code = fs.readFileSync(path.join(__dirname, '../../js/hover-preview.js'), 'utf8');

        expect(() => {
            vm.runInContext(code, context);
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();
    });

    test('gracefully handles missing GSAP', () => {
        const contextWithoutGsap = vm.createContext({
            document,
            window: { console: { warn: jest.fn() } },
        });
        const code = fs.readFileSync(path.join(__dirname, '../../js/hover-preview.js'), 'utf8');

        expect(() => {
            vm.runInContext(code, contextWithoutGsap);
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(contextWithoutGsap.window.console.warn).toHaveBeenCalledWith(
            'GSAP is not loaded. Skipping hover preview.'
        );
    });
});
