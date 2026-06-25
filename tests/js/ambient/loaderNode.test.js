/**
 * @jest-environment node
 */
describe('loader.js Node Environment module checks', () => {
    it('covers window missing during module load', () => {
        const sourceCode = require('fs').readFileSync('js/ambient/loader.js', 'utf8');
        const fn = new Function('module', sourceCode + '\nreturn module;');
        const result = fn({ exports: {} });
        if (result && result.init) {
            result.init();
        } else if (result && result.exports && result.exports.init) {
            result.exports.init();
        }
    });
    it('covers handleSyncError when window is undefined', () => {
        const sourceCode = require('fs').readFileSync('js/ambient/loader.js', 'utf8');
        const fn = new Function('module', 'window', 'console', sourceCode + '\nreturn module;');
        const result = fn({ exports: {} }, undefined, console);
        expect(() => {
            if (result && result.init) {
                result.init();
            } else if (result && result.exports && result.exports.init) {
                result.exports.init();
            }
        }).not.toThrow();
    });
    it('covers typeof module !== undefined but exports false', () => {
        const sourceCode = require('fs').readFileSync('js/ambient/loader.js', 'utf8');
        const mockModule = { exports: false };
        const fn = new Function('module', 'window', 'console', sourceCode + '\nreturn module;');
        const result = fn(mockModule, undefined, console);
        expect(result.exports).toBe(false);
    });
});
