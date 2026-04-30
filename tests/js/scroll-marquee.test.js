/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('scroll-marquee.js', () => {
    let context;
    let marqueeScript;

    beforeEach(() => {
        // Mock DOM
        document.body.innerHTML = `
            <div class="post-heading">
                <h1>Test Title</h1>
            </div>
        `;
        document.body.setAttribute('data-page-type', 'project');

        // Mock window methods
        window.matchMedia = jest.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
        }));

        // Provide requestAnimationFrame mock for immediate execution
        window.requestAnimationFrame = jest.fn((cb) => {
            // We won't automatically loop in tests to avoid infinite recursion
            return setTimeout(cb, 0);
        });

        // Set up the VM context
        context = {
            window,
            document,
            requestAnimationFrame: window.requestAnimationFrame,
            setTimeout,
            console,
        };

        vm.createContext(context);

        // Load the script
        marqueeScript = fs.readFileSync(
            path.resolve(__dirname, '../../js/scroll-marquee.js'),
            'utf8'
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
        document.body.removeAttribute('data-page-type');
    });

    it('should create and append the marquee wrapper on a project page', () => {
        vm.runInContext(marqueeScript, context);
        const wrapper = document.querySelector('.scroll-marquee-wrapper');
        expect(wrapper).toBeTruthy();
        expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    });

    it('should use the post heading text for the marquee content', () => {
        vm.runInContext(marqueeScript, context);
        const content = document.querySelector('.scroll-marquee-content');
        expect(content).toBeTruthy();
        expect(content.textContent).toContain('Test Title — ');
    });

    it('should not initialize if not on a project page', () => {
        document.body.removeAttribute('data-page-type');
        vm.runInContext(marqueeScript, context);
        const wrapper = document.querySelector('.scroll-marquee-wrapper');
        expect(wrapper).toBeNull();
    });

    it('should not initialize if prefers-reduced-motion is true', () => {
        window.matchMedia.mockImplementation((query) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
        }));
        vm.runInContext(marqueeScript, context);
        const wrapper = document.querySelector('.scroll-marquee-wrapper');
        expect(wrapper).toBeNull();
    });
});
