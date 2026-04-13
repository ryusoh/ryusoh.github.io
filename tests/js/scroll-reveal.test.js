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
