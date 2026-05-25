/**
 * @jest-environment jsdom
 */

describe('init.js', () => {
    test('adds js-enabled class to documentElement', () => {
        jest.isolateModules(() => {
            document.documentElement.classList.remove('js-enabled');
            require('../../js/init.js');
            expect(document.documentElement.classList.contains('js-enabled')).toBe(true);
        });
    });
});
