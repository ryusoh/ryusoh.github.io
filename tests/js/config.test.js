/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('config.js', () => {
    let context;

    beforeEach(() => {
        context = vm.createContext({
            window: {},
        });
    });

    test('should correctly define window.PortfolioConfig with specific values', () => {
        const code = fs.readFileSync(path.join(__dirname, '../../js/config.js'), 'utf8');

        vm.runInContext(code, context);

        expect(context.window.PortfolioConfig).toBeDefined();
        expect(context.window.PortfolioConfig.enableHoverPreview).toBe(false);
        expect(context.window.PortfolioConfig.enableMouseParallax).toBe(false);
    });
});
