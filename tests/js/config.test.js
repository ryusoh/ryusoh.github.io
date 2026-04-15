/**
 * @jest-environment jsdom
 */

describe('config.js', () => {
    beforeEach(() => {
        // Reset window.PortfolioConfig to ensure a clean state
        delete window.PortfolioConfig;
        jest.resetModules();
    });

    test('initializes window.PortfolioConfig with default values', () => {
        require('../../js/config.js');

        expect(window.PortfolioConfig).toBeDefined();
        expect(window.PortfolioConfig.enableHoverPreview).toBe(false);
        expect(window.PortfolioConfig.enableMouseParallax).toBe(false);
    });
});
