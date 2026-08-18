/**
 * @jest-environment jsdom
 */

describe('Scroll Reveal', () => {
    let intersectionObserverMock;
    let observeMock;
    let unobserveMock;
    let matchMediaMock;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        document.body.removeAttribute('data-page-type');

        // Mock requestAnimationFrame
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => cb());

        // Mock IntersectionObserver
        observeMock = jest.fn();
        unobserveMock = jest.fn();
        intersectionObserverMock = jest.fn((callback) => ({
            observe: observeMock,
            unobserve: unobserveMock,
            disconnect: jest.fn(),
            callback: callback, // Save callback for manual triggering
        }));
        window.IntersectionObserver = intersectionObserverMock;

        // Mock window.matchMedia
        matchMediaMock = jest.fn().mockImplementation((query) => ({
            matches: false, // Default to no reduced motion
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));
        window.matchMedia = matchMediaMock;

        // Reset require cache to re-execute IIFE
        jest.resetModules();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('ignores non-IMG elements in IntersectionObserver callback', () => {
        document.body.setAttribute('data-page-type', 'project');
        // We need an element that is NOT an IMG but somehow gets observed or triggered in the callback.
        // The observer callback iterates over entries and checks `if (el.tagName === 'IMG')`
        // If we mock the observer and manually trigger it with a DIV, it hits lines 97-99 where it skips!
        document.body.innerHTML =
            '<div class="post-content"><img id="testImg" src="test.jpg"/></div>';
        require('../../js/scroll-reveal.js');

        const observerInstance = intersectionObserverMock.mock.results[0].value;
        const div = document.createElement('div');
        observerInstance.callback([{ isIntersecting: true, target: div }]);

        expect(unobserveMock).toHaveBeenCalledWith(div);
    });

    test('ignores non-intersecting entries in IntersectionObserver callback', () => {
        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML =
            '<div class="post-content"><img id="testImg" src="test.jpg"/></div>';
        require('../../js/scroll-reveal.js');

        const observerInstance = intersectionObserverMock.mock.results[0].value;
        const img = document.getElementById('testImg');

        // Trigger with isIntersecting = false
        observerInstance.callback([{ isIntersecting: false, target: img }]);

        // It shouldn't unobserve it
        expect(unobserveMock).not.toHaveBeenCalledWith(img);
    });

    test('should not run if not a project page', () => {
        document.body.innerHTML = '<div class="post-content"><img src="test.jpg"/></div>';
        require('../../js/scroll-reveal.js');
        expect(intersectionObserverMock).not.toHaveBeenCalled();
    });

    test('should not run if prefers-reduced-motion is true', () => {
        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML = '<div class="post-content"><img src="test.jpg"/></div>';

        matchMediaMock.mockImplementation((query) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
        }));

        require('../../js/scroll-reveal.js');
        expect(intersectionObserverMock).not.toHaveBeenCalled();
    });

    test('should mark images with scroll-reveal class', () => {
        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML =
            '<div class="post-content"><img id="img1" src="test1.jpg"/><img id="img2" src="test2.jpg"/></div>';

        require('../../js/scroll-reveal.js');

        const img1 = document.getElementById('img1');
        const img2 = document.getElementById('img2');
        expect(img1.classList.contains('scroll-reveal')).toBe(true);
        expect(img2.classList.contains('scroll-reveal')).toBe(true);
        expect(observeMock).toHaveBeenCalledTimes(2);
    });

    test('should reveal cached image instantly on intersection', () => {
        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML =
            '<div class="post-content"><img id="testImg" src="test.jpg"/></div>';
        const img = document.getElementById('testImg');

        // Mock image cache behavior
        Object.defineProperty(img, 'complete', { value: true, writable: false });

        require('../../js/scroll-reveal.js');

        // Trigger IntersectionObserver callback
        const observerInstance = intersectionObserverMock.mock.results[0].value;
        observerInstance.callback([{ isIntersecting: true, target: img }]);

        // With requestAnimationFrame mocked sequentially, it should process instantly
        expect(img.classList.contains('scroll-reveal--visible')).toBe(true);
        expect(unobserveMock).toHaveBeenCalledWith(img);
    });

    test('should wait for load event if image is not complete', () => {
        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML =
            '<div class="post-content"><img id="testImg" src="test.jpg"/></div>';
        const img = document.getElementById('testImg');

        // Image is not complete
        Object.defineProperty(img, 'complete', { value: false, writable: false });

        require('../../js/scroll-reveal.js');

        const observerInstance = intersectionObserverMock.mock.results[0].value;
        observerInstance.callback([{ isIntersecting: true, target: img }]);

        // Should not be visible yet
        expect(img.classList.contains('scroll-reveal--visible')).toBe(false);

        // Fire load event
        img.dispatchEvent(new Event('load'));

        // Now it should be visible
        expect(img.classList.contains('scroll-reveal--visible')).toBe(true);
        expect(unobserveMock).toHaveBeenCalledWith(img);
    });

    test('should reveal element on image error event', () => {
        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML =
            '<div class="post-content"><img id="testImg" src="broken.jpg"/></div>';
        const img = document.getElementById('testImg');

        // Image is not complete
        Object.defineProperty(img, 'complete', { value: false, writable: false });

        require('../../js/scroll-reveal.js');

        const observerInstance = intersectionObserverMock.mock.results[0].value;
        observerInstance.callback([{ isIntersecting: true, target: img }]);

        // Fire error event
        img.dispatchEvent(new Event('error'));

        // Now it should be visible
        expect(img.classList.contains('scroll-reveal--visible')).toBe(true);
        expect(unobserveMock).toHaveBeenCalledWith(img);
    });

    test('ignores load/error events if target is not IMG or not revealing', () => {
        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML =
            '<div class="post-content"><img id="testImg" src="test.jpg"/></div>';
        require('../../js/scroll-reveal.js');

        // Not an IMG
        const div = document.createElement('div');
        div.dispatchEvent(new Event('load'));

        // IMG without is-revealing
        const img = document.getElementById('testImg');
        img.dispatchEvent(new Event('load'));

        expect(img.classList.contains('scroll-reveal--visible')).toBe(false);
    });

    test('should reveal preloaded image even if load event fired before intersection observer callback', () => {
        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML =
            '<div class="post-content"><img id="heroImg" src="hero.jpg"/></div>';
        const img = document.getElementById('heroImg');

        Object.defineProperty(img, 'complete', { value: false, writable: true });

        require('../../js/scroll-reveal.js');

        // Early load event fires (before observer callback)
        img.dispatchEvent(new Event('load'));

        // Observer callback runs afterwards
        const observerInstance = intersectionObserverMock.mock.results[0].value;
        observerInstance.callback([{ isIntersecting: true, target: img }]);

        expect(img.classList.contains('scroll-reveal--visible')).toBe(true);
        expect(unobserveMock).toHaveBeenCalledWith(img);
    });

    test('should decode and reveal image via img.decode() promise', async () => {
        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML =
            '<div class="post-content"><img id="decodeImg" src="test.jpg"/></div>';
        const img = document.getElementById('decodeImg');

        Object.defineProperty(img, 'complete', { value: false, writable: true });
        let resolveDecode;
        img.decode = jest.fn(
            () =>
                new Promise((resolve) => {
                    resolveDecode = resolve;
                })
        );

        require('../../js/scroll-reveal.js');

        const observerInstance = intersectionObserverMock.mock.results[0].value;
        observerInstance.callback([{ isIntersecting: true, target: img }]);

        expect(img.classList.contains('is-revealing')).toBe(true);
        expect(img.classList.contains('scroll-reveal--visible')).toBe(false);

        // Resolve decode
        resolveDecode();
        await Promise.resolve();

        expect(img.classList.contains('scroll-reveal--visible')).toBe(true);
        expect(img.classList.contains('is-revealing')).toBe(false);
    });

    test('should log warning when img.decode() fails', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML =
            '<div class="post-content"><img id="decodeFailImg" src="fail.jpg"/></div>';
        const img = document.getElementById('decodeFailImg');

        Object.defineProperty(img, 'complete', { value: false, writable: true });
        let rejectDecode;
        img.decode = jest.fn(
            () =>
                new Promise((_, reject) => {
                    rejectDecode = reject;
                })
        );

        jest.isolateModules(() => {
            require('../../js/scroll-reveal.js');
        });

        // Get the inner callback passed to requestAnimationFrame
        const raf1 = window.requestAnimationFrame.mock.calls[0][0];
        window.requestAnimationFrame.mockClear();
        raf1();

        const raf2 = window.requestAnimationFrame.mock.calls[0][0];
        window.requestAnimationFrame.mockClear();
        raf2();

        const observerInstance = intersectionObserverMock.mock.results[0].value;
        observerInstance.callback([{ isIntersecting: true, target: img }]);

        const testError = new Error('Decode failed');
        rejectDecode(testError);

        // Wait for next tick so promise handlers resolve
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(warnSpy).toHaveBeenCalledWith(
            '[ScrollReveal] Image decode failed, falling back to event delegation:',
            testError
        );

        warnSpy.mockRestore();
    });

    test('should reveal image immediately if naturalWidth > 0', () => {
        document.body.setAttribute('data-page-type', 'project');
        document.body.innerHTML =
            '<div class="post-content"><img id="naturalImg" src="test.jpg"/></div>';
        const img = document.getElementById('naturalImg');

        Object.defineProperty(img, 'complete', { value: false, writable: false });
        Object.defineProperty(img, 'naturalWidth', { value: 800, writable: false });

        require('../../js/scroll-reveal.js');

        const observerInstance = intersectionObserverMock.mock.results[0].value;
        observerInstance.callback([{ isIntersecting: true, target: img }]);

        expect(img.classList.contains('scroll-reveal--visible')).toBe(true);
        expect(unobserveMock).toHaveBeenCalledWith(img);
    });

    test('should early return if .post-content container is missing', () => {
        document.body.setAttribute('data-page-type', 'project');
        // No .post-content
        document.body.innerHTML = '<div><img src="test.jpg"/></div>';

        require('../../js/scroll-reveal.js');

        expect(intersectionObserverMock).not.toHaveBeenCalled();
    });

    test('should early return if no images are present in .post-content', () => {
        document.body.setAttribute('data-page-type', 'project');
        // Container exists, but no images
        document.body.innerHTML = '<div class="post-content"><p>Text only</p></div>';

        require('../../js/scroll-reveal.js');

        expect(intersectionObserverMock).not.toHaveBeenCalled();
    });
});
