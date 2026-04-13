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
        expect(consoleWarnMock).toHaveBeenCalledWith('Caught exception:', expect.any(Error));
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
});
