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

    describe('startChecking and stopChecking', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
            jest.restoreAllMocks();
        });

        test('should clear interval and call showIcons when loaded', () => {
            const loader = new FontAwesomeLoader();
            loader.checkInterval = null;
            loader.testElement = document.createElement('i');

            jest.spyOn(loader, 'isFontAwesomeLoaded').mockReturnValue(true);
            const showIconsSpy = jest.spyOn(loader, 'showIcons').mockImplementation(() => {});
            const stopSpy = jest.spyOn(loader, 'stopChecking');

            loader.startChecking();

            // Fast-forward 100ms
            jest.advanceTimersByTime(100);

            expect(loader.fontAwesomeLoaded).toBe(true);
            expect(showIconsSpy).toHaveBeenCalled();
            expect(stopSpy).toHaveBeenCalled();
        });

        test('should increment retryCount and handleLoadFailure when maxRetries is reached', () => {
            const loader = new FontAwesomeLoader();
            loader.maxRetries = 2;
            loader.retryCount = 0;
            loader.testElement = document.createElement('i');

            jest.spyOn(loader, 'isFontAwesomeLoaded').mockReturnValue(false);
            const handleLoadFailureSpy = jest
                .spyOn(loader, 'handleLoadFailure')
                .mockImplementation(() => {});
            const stopSpy = jest.spyOn(loader, 'stopChecking');

            loader.startChecking();

            // Advance by first 100ms
            jest.advanceTimersByTime(100);
            expect(loader.retryCount).toBe(1);
            expect(handleLoadFailureSpy).not.toHaveBeenCalled();
            expect(stopSpy).not.toHaveBeenCalled();

            // Advance by second 100ms
            jest.advanceTimersByTime(100);
            expect(loader.retryCount).toBe(2);
            expect(handleLoadFailureSpy).toHaveBeenCalled();
            expect(stopSpy).toHaveBeenCalled();
        });

        test('stopChecking clears checkInterval and cleans up testElement', () => {
            const loader = new FontAwesomeLoader();

            // Setup an interval to clear
            const mockInterval = setInterval(() => {}, 1000);
            loader.checkInterval = mockInterval;

            // Setup a testElement attached to DOM
            const testEl = document.createElement('i');
            document.body.appendChild(testEl);
            loader.testElement = testEl;

            loader.stopChecking();

            // checkInterval should be null
            expect(loader.checkInterval).toBeNull();

            // The test element should be removed from DOM
            expect(testEl.parentNode).toBeNull();
            expect(loader.testElement).toBeNull();
        });

        test('cleanupTestElement safely does nothing if element is missing', () => {
            const loader = new FontAwesomeLoader();
            loader.testElement = null;

            expect(() => {
                loader.cleanupTestElement();
            }).not.toThrow();
        });

        test('handleLoadFailure sets display:none for non-chevron icons', () => {
            const loader = new FontAwesomeLoader();

            const normalIcon = document.createElement('i');
            normalIcon.className = 'fa fa-heart';
            normalIcon.dataset.fahidden = 'true';

            loader.faIcons = [normalIcon];

            loader.handleLoadFailure();

            expect(normalIcon.style.display).toBe('none');
        });
    });
});
