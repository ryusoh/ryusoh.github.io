/**
 * @jest-environment node
 */
describe('loader.js Node Environment module checks', () => {
    it('covers typeof module !== undefined but exports false', () => {
        const sourceCode = require('fs').readFileSync('js/ambient/loader.js', 'utf8');
        const mockModule = { exports: false };
        const fn = new Function('module', 'window', 'console', sourceCode + '\nreturn module;');
        const result = fn(mockModule, undefined, console);
        expect(result.exports).toBe(false);
    });
});
