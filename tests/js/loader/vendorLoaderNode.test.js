/**
 * @jest-environment node
 */
describe('vendorLoader.js Node Environment', () => {
    it('covers typeof module !== undefined but module.exports is falsy', () => {
        jest.resetModules();

        const origWindow = global.window;
        const origModule = global.module;

        Object.defineProperty(global, 'window', {
            get() {
                return undefined;
            },
            configurable: true,
        });
        Object.defineProperty(global, 'module', {
            get() {
                return { exports: false };
            },
            configurable: true,
        });

        require('../../../js/loader/vendorLoader.js');

        Object.defineProperty(global, 'window', { value: origWindow, configurable: true });
        Object.defineProperty(global, 'module', { value: origModule, configurable: true });
    });
});
