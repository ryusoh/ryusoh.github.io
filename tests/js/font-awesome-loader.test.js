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
});
