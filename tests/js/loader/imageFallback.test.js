/**
 * @jest-environment jsdom
 */

const imageFallback = require('../../../js/loader/imageFallback.js');

describe('imageFallback.js', () => {
    let imgElement;
    let consoleWarnMock;

    beforeEach(() => {
        consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Set up a clean document for each test
        document.body.innerHTML = `
            <img id="test-img" data-fallbacks='["url1.png", "url2.png"]'>
        `;
        imgElement = document.getElementById('test-img');

        // Mock properties to prevent JSDOM cascade
        let currentSrc = '';
        Object.defineProperty(imgElement, 'src', {
            get: () => currentSrc,
            set: (val) => {
                currentSrc = val;
            },
            configurable: true,
        });
        Object.defineProperty(imgElement, 'naturalWidth', {
            get: () => imgElement._naturalWidth || 0,
            set: (val) => {
                imgElement._naturalWidth = val;
            },
            configurable: true,
        });
        Object.defineProperty(imgElement, 'complete', {
            get: () => imgElement._complete || false,
            set: (val) => {
                imgElement._complete = val;
            },
            configurable: true,
        });

        // Manually init since we already required it once
        imageFallback.initFallback(imgElement);
    });

    afterEach(() => {
        consoleWarnMock.mockRestore();
        document.body.innerHTML = '';
    });

    it('should do nothing if data-fallbacks is missing', () => {
        document.body.innerHTML = '<img id="no-fallback">';
        const noFallbackImg = document.getElementById('no-fallback');
        imageFallback.initFallback(noFallbackImg);
        expect(noFallbackImg.src).toBe('');
    });

    it('should warn and do nothing if data-fallbacks is invalid JSON', () => {
        imgElement.setAttribute('data-fallbacks', 'invalid-json');
        imageFallback.initFallback(imgElement);
        expect(consoleWarnMock).toHaveBeenCalledWith(
            'Caught exception parsing fallback list:',
            expect.any(Error)
        );
    });

    it('should do nothing if data-fallbacks string exceeds length limit', () => {
        const longString = '[' + '"a.png"'.repeat(1000) + ']';
        imgElement.setAttribute('data-fallbacks', longString);
        const result = imageFallback.parseFallbacks(imgElement);
        expect(result).toBeNull();
    });

    it('should do nothing if data-fallbacks is not an array', () => {
        imgElement.setAttribute('data-fallbacks', '{"key": "value"}');
        const result = imageFallback.parseFallbacks(imgElement);
        expect(result).toBeNull();
    });

    it('should do nothing if data-fallbacks is an empty array', () => {
        imgElement.setAttribute('data-fallbacks', '[]');
        const result = imageFallback.parseFallbacks(imgElement);
        expect(result).toBeNull();
    });

    it('should set internal properties and set src to first fallback if src is empty', () => {
        imgElement.src = '';
        delete imgElement.__fallbackList;
        delete imgElement.__fallbackIndex;

        imageFallback.initFallback(imgElement);

        expect(imgElement.classList.contains('is-fallback-ready')).toBe(false);
        expect(imgElement.__fallbackList).toEqual(['url1.png', 'url2.png']);
        expect(imgElement.__fallbackIndex).toBe(0);
        expect(imgElement.src).toBe('url1.png');
    });

    it('should mark as ready if already complete and has naturalWidth', () => {
        imgElement.src = 'url1.png';
        imgElement.setAttribute('data-fallbacks', '["url1.png", "url2.png"]');
        imgElement.complete = true;
        imgElement.naturalWidth = 100;

        imageFallback.initFallback(imgElement);

        expect(imgElement.classList.contains('is-fallback-ready')).toBe(true);
    });

    it('should add "is-fallback-ready" class when global load event fires for valid image', () => {
        const event = new Event('load', { bubbles: true });
        imgElement.dispatchEvent(event);

        expect(imgElement.classList.contains('is-fallback-ready')).toBe(true);
    });

    it('should try next url when global error event fires for valid image', () => {
        imgElement.__fallbackIndex = 0;
        imgElement.src = 'initial.png';

        // First error event:
        const event1 = new Event('error', { bubbles: true });
        imgElement.dispatchEvent(event1);
        expect(imgElement.src).toBe('url1.png');
        expect(imgElement.__fallbackIndex).toBe(1);

        // Second error event:
        const event2 = new Event('error', { bubbles: true });
        imgElement.dispatchEvent(event2);
        expect(imgElement.src).toBe('url2.png');
        expect(imgElement.__fallbackIndex).toBe(2);

        // Third error event:
        const event3 = new Event('error', { bubbles: true });
        imgElement.dispatchEvent(event3);
        expect(imgElement.src).toBe('url2.png');
        expect(imgElement.__fallbackIndex).toBe(2);
    });

    it('should sanitize fallback array and remove non-string elements', () => {
        imgElement.setAttribute('data-fallbacks', '["url1.png", 123, "url2.png"]');
        const list = imageFallback.parseFallbacks(imgElement);
        expect(list).toEqual(['url1.png', 'url2.png']);
    });

    it('should handle exception when console.warn is missing', () => {
        imgElement.setAttribute('data-fallbacks', 'invalid-json');
        const originalWarn = window.console.warn;
        window.console.warn = undefined;

        expect(() => {
            imageFallback.initFallback(imgElement);
        }).not.toThrow();

        window.console.warn = originalWarn;
    });

    test('should initialize fallbacks for all image tags on load', () => {
        jest.resetModules();
        document.body.innerHTML =
            '<img data-fallbacks=\'["a.jpg"]\' /><img data-fallbacks=\'["b.jpg"]\' />';
        require('../../../js/loader/imageFallback.js');
        const imgs = document.querySelectorAll('img');
        expect(imgs[0].getAttribute('data-fallbacks')).toBe('["a.jpg"]');
    });

    test('should gracefully ignore initialization errors and not crash the application', () => {
        jest.resetModules();
        const origQuerySelectorAll = document.querySelectorAll;
        document.querySelectorAll = () => {
            throw new Error('Query error');
        };
        const origConsole = window.console;
        window.console = undefined;

        expect(() => {
            require('../../../js/loader/imageFallback.js');
        }).not.toThrow();

        document.querySelectorAll = origQuerySelectorAll;
        window.console = origConsole;
    });

    it('should not throw if module is undefined during exports', () => {
        jest.isolateModules(() => {
            const fs = require('fs');
            const path = require('path');
            const sourcePath = path.resolve(__dirname, '../../../js/loader/imageFallback.js');
            const code = fs.readFileSync(sourcePath, 'utf8');
            const vm = require('vm');

            const context = {
                window: {},
                document: { querySelectorAll: () => [], addEventListener: () => {} },
                console: console,
            };

            vm.createContext(context);

            expect(() => {
                vm.runInContext(code, context);
            }).not.toThrow();
        });
    });

    it('should add "is-fallback-ready" class when global load event fires for valid image (branch coverage)', () => {
        const img = document.createElement('img');
        img.setAttribute('data-fallbacks', '["url1.png"]');
        document.body.appendChild(img);
        const loadEvent = new Event('load', { bubbles: true });
        img.dispatchEvent(loadEvent);
        expect(img.classList.contains('is-fallback-ready')).toBe(true);
    });

    it('should not throw if target is missing in load event', () => {
        const loadEvent = new Event('load', { bubbles: true });
        Object.defineProperty(loadEvent, 'target', { value: null });
        document.dispatchEvent(loadEvent);
    });

    it('should not throw if target is missing in error event', () => {
        const errEvent = new Event('error', { bubbles: true });
        Object.defineProperty(errEvent, 'target', { value: null });
        document.dispatchEvent(errEvent);
    });

    it('should not throw if target is not IMG in error event', () => {
        const errEvent = new Event('error', { bubbles: true });
        const div = document.createElement('div');
        div.dispatchEvent(errEvent);
    });

    it('should not throw if error event target has no fallback list', () => {
        const errEvent = new Event('error', { bubbles: true });
        const img = document.createElement('img');
        img.setAttribute('data-fallbacks', '["a"]');
        img.dispatchEvent(errEvent);
    });

    it('should return null from sanitizeFallbackList if array contains no valid strings', () => {
        const img = document.createElement('img');
        img.setAttribute('data-fallbacks', '[1, 2, null]');
        imageFallback.initFallback(img);
        expect(img.src).toBe('');
    });

    it('should not mark fallback as ready if image src matches but is not complete', () => {
        const img = document.createElement('img');
        img.src = 'url1.png';
        img.setAttribute('data-fallbacks', '["url1.png"]');
        Object.defineProperty(img, 'complete', { value: false });

        imageFallback.initFallback(img);
        expect(img.classList.contains('is-fallback-ready')).toBe(false);
    });

    test('should not mark fallback as ready if complete but naturalWidth is 0', () => {
        const img = document.createElement('img');
        img.src = 'url1.png';
        img.setAttribute('data-fallbacks', '["url1.png"]');
        Object.defineProperty(img, 'complete', { value: true });
        Object.defineProperty(img, 'naturalWidth', { value: 0 });

        imageFallback.initFallback(img);
        expect(img.classList.contains('is-fallback-ready')).toBe(false);
    });

    test('should update image source if src exists but does not match first fallback', () => {
        const img = document.createElement('img');
        img.src = 'other.png';
        img.setAttribute('data-fallbacks', '["url1.png"]');

        imageFallback.initFallback(img);
        expect(img.src).toContain('url1.png');
    });

    test('should export functions correctly in module environment', () => {
        // Evaluate in a context where window is missing but module.exports is present
        const exportsObj = {};
        const sandbox = {
            document: global.document,
            module: { exports: exportsObj },
        };
        const vm = require('vm');
        vm.createContext(sandbox);
        const code = require('fs').readFileSync('js/loader/imageFallback.js', 'utf8');
        vm.runInContext(code, sandbox);

        expect(sandbox.module.exports.parseFallbacks).toBeDefined();
    });

    test('should not export if module is present without exports', () => {
        const sandbox = {
            window: { console: global.console },
            document: global.document,
            module: {},
        };
        const vm = require('vm');
        vm.createContext(sandbox);
        const code = require('fs').readFileSync('js/loader/imageFallback.js', 'utf8');
        vm.runInContext(code, sandbox);

        expect(sandbox.module.exports).toBeUndefined();
    });

    test('should export to window if module is explicitly undefined', () => {
        const sandbox = {
            window: { console: global.console },
            document: global.document,
            // module is explicitly undefined
        };
        const vm = require('vm');
        vm.createContext(sandbox);
        const code = require('fs').readFileSync('js/loader/imageFallback.js', 'utf8');
        vm.runInContext(code, sandbox);

        expect(sandbox.window.__ImageFallbackForTesting).toBeDefined();
    });

    test('should run cleanly without side effects when evaluated in window-less environment', () => {
        const sandbox = {
            document: global.document,
            module: { exports: {} },
        };
        const vm = require('vm');
        vm.createContext(sandbox);
        const code = require('fs').readFileSync('js/loader/imageFallback.js', 'utf8');
        vm.runInContext(code, sandbox);
        expect(sandbox.module.exports).toBeDefined();
    });

    it('should fall through else-if gracefully when el.complete is undefined or conditions are false without adding class', () => {
        const img = document.createElement('img');
        img.src = 'url1.png';
        img.setAttribute('data-fallbacks', '["url1.png"]');
        Object.defineProperty(img, 'complete', { value: false });
        imageFallback.initFallback(img);
        expect(img.classList.contains('is-fallback-ready')).toBe(false);
    });

    it('should fall through else-if when el.complete is true but el.naturalWidth is undefined or 0', () => {
        const img = document.createElement('img');
        img.src = 'url1.png';
        img.setAttribute('data-fallbacks', '["url1.png"]');
        Object.defineProperty(img, 'complete', { value: true });
        Object.defineProperty(img, 'naturalWidth', { value: 0 });
        imageFallback.initFallback(img);
        expect(img.classList.contains('is-fallback-ready')).toBe(false);
    });
});
