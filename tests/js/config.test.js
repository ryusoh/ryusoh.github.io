/**
 * @jest-environment jsdom
 */

describe('js/config.js', () => {
    beforeEach(() => {
        jest.resetModules();
        delete window.PortfolioConfig;
    });

    test('should define PortfolioConfig with defaults', () => {
        require('../../js/config.js');
        expect(window.PortfolioConfig).toBeDefined();
        expect(window.PortfolioConfig.enableHoverPreview).toBe(true);
        expect(window.PortfolioConfig.enableMouseParallax).toBe(true);
    });
});
