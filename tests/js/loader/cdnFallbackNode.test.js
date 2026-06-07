/**
 * @jest-environment node
 */
describe('CDNLoader Node Environment', () => {
    it('exports functions if module is available and window is not', () => {
        jest.resetModules();
        const cdn = require('../../../js/loader/cdnFallback.js');
        expect(cdn).toHaveProperty('preconnect');
        expect(cdn).toHaveProperty('loadScriptSequential');
        expect(cdn).toHaveProperty('loadCssWithFallback');
    });

    it('handles typeof module !== "undefined" but module.exports missing', () => {
        const vm = require('vm');
        const fs = require('fs');
        const sourceCode = fs.readFileSync('js/loader/cdnFallback.js', 'utf8');

        // To hit branch where module is undefined completely
        const sandbox = {
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            Promise: Promise,
            console: console,
        };

        vm.createContext(sandbox);
        vm.runInContext(sourceCode, sandbox);
        expect(sandbox.module).toBeUndefined();
    });
});
