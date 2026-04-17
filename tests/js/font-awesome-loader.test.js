/**
 * @jest-environment jsdom
 */

describe('FontAwesomeLoader', () => {
    let FontAwesomeLoader;

    beforeEach(() => {
        jest.resetModules();
        document.documentElement.innerHTML =
            '<html><body><i class="fa fa-test" data-fahidden="true"></i></body></html>';

        require('../../js/font-awesome-loader.js');
        FontAwesomeLoader = window.__FontAwesomeLoaderForTesting.FontAwesomeLoader;
    });

    test('should identify if Font Awesome is loaded via computed style', () => {
        const loader = new FontAwesomeLoader();

        // Mock getComputedStyle to return content
        window.getComputedStyle = jest.fn().mockReturnValue({
            content: '"\\f004"',
        });

        expect(loader.isFontAwesomeLoaded()).toBe(true);

        // Mock to return none
        window.getComputedStyle = jest.fn().mockReturnValue({
            content: 'none',
        });
        loader.testElement = null; // force recreation
        expect(loader.isFontAwesomeLoaded()).toBe(false);
    });

    test('showIcons should remove hidden attribute and reset visibility', () => {
        const loader = new FontAwesomeLoader();
        const icon = document.querySelector('.fa');
        loader.faIcons = [icon];

        loader.showIcons();

        expect(icon.style.visibility).toBe('');
        expect(icon.dataset.fahidden).toBe('');
    });

    test('handleLoadFailure should provide fallback for chevron icons', () => {
        const loader = new FontAwesomeLoader();
        const icon = document.createElement('i');
        icon.className = 'fa-chevron-left';
        icon.dataset.fahidden = 'true';
        loader.faIcons = [icon];

        loader.handleLoadFailure();

        expect(icon.textContent).toBe('←');
        expect(icon.style.visibility).toBe('visible');
    });

    test('init should show icons immediately if already loaded', () => {
        const loader = new FontAwesomeLoader();
        jest.spyOn(loader, 'isFontAwesomeLoaded').mockReturnValue(true);
        const showSpy = jest.spyOn(loader, 'showIcons');

        loader.init();

        expect(showSpy).toHaveBeenCalled();
        expect(loader.fontAwesomeLoaded).toBe(true);
    });

    describe('waitForFontLoad', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should assign onload handler to font-awesome link', () => {
            const loader = new FontAwesomeLoader();
            jest.spyOn(loader, 'showIcons').mockImplementation(() => {});
            jest.spyOn(loader, 'stopChecking').mockImplementation(() => {});

            // Create fake links
            const wrongLink = document.createElement('link');
            wrongLink.rel = 'stylesheet';
            wrongLink.href = 'https://example.com/other.css';

            const faLink = document.createElement('link');
            faLink.rel = 'stylesheet';
            faLink.href = 'https://example.com/font-awesome.min.css';

            document.head.appendChild(wrongLink);
            document.head.appendChild(faLink);

            loader.waitForFontLoad();

            // Run setTimeout
            jest.advanceTimersByTime(50);

            expect(typeof faLink.onload).toBe('function');

            // Trigger onload
            faLink.onload();

            expect(loader.fontAwesomeLoaded).toBe(true);
            expect(loader.showIcons).toHaveBeenCalled();
            expect(loader.stopChecking).toHaveBeenCalled();

            // Clean up
            document.head.removeChild(wrongLink);
            document.head.removeChild(faLink);
        });

        test('should not do anything if already loaded', () => {
            const loader = new FontAwesomeLoader();
            loader.fontAwesomeLoaded = true;
            jest.spyOn(loader, 'showIcons').mockImplementation(() => {});
            jest.spyOn(loader, 'stopChecking').mockImplementation(() => {});

            const faLink = document.createElement('link');
            faLink.rel = 'stylesheet';
            faLink.href = 'https://example.com/font-awesome.min.css';
            document.head.appendChild(faLink);

            loader.waitForFontLoad();
            jest.advanceTimersByTime(50);

            // Trigger onload
            faLink.onload();

            expect(loader.showIcons).not.toHaveBeenCalled();
            expect(loader.stopChecking).not.toHaveBeenCalled();

            document.head.removeChild(faLink);
        });
    });
});