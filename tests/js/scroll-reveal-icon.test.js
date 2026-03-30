const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('scroll-reveal-icon.js', () => {
    let context;
    let iconElement;
    let addEventListenerMock;
    let setTimeoutMock;
    const sourceCode = fs.readFileSync(
        path.resolve(__dirname, '../../js/scroll-reveal-icon.js'),
        'utf8'
    );

    beforeEach(() => {
        iconElement = {
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
            },
        };

        addEventListenerMock = jest.fn();
        setTimeoutMock = jest.fn((cb) => cb());

        context = vm.createContext({
            document: {
                querySelector: jest.fn((selector) => {
                    if (selector === '.scroll-reveal-instagram') {
                        return iconElement;
                    }
                    return null;
                }),
                documentElement: {
                    scrollHeight: 1000,
                    scrollTop: 0,
                },
            },
            window: {
                scrollY: 0,
                innerHeight: 500,
                addEventListener: addEventListenerMock,
                requestAnimationFrame: jest.fn((cb) => cb()),
            },
            setTimeout: setTimeoutMock,
        });
    });

    it('should register event listeners when icon exists', () => {
        vm.runInContext(sourceCode, context);
        expect(addEventListenerMock).toHaveBeenCalledWith('scroll', expect.any(Function), {
            passive: true,
        });
        expect(addEventListenerMock).toHaveBeenCalledWith('resize', expect.any(Function), {
            passive: true,
        });
        expect(addEventListenerMock).toHaveBeenCalledWith('load', expect.any(Function));
        expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it('should abort early if icon does not exist', () => {
        context.document.querySelector = jest.fn(() => null);
        vm.runInContext(sourceCode, context);
        expect(addEventListenerMock).not.toHaveBeenCalled();
    });

    it('should add "is-visible" class when scrolled to bottom', () => {
        context.window.scrollY = 450; // 450 + 500 = 950 >= 1000 - 50
        vm.runInContext(sourceCode, context);

        const onScrollOrResize = addEventListenerMock.mock.calls.find(
            (call) => call[0] === 'scroll'
        )[1];

        expect(iconElement.classList.add).toHaveBeenCalledWith('is-visible');
        expect(iconElement.classList.remove).not.toHaveBeenCalled();

        iconElement.classList.add.mockClear();
        iconElement.classList.remove.mockClear();

        context.window.scrollY = 900;
        onScrollOrResize();
        expect(iconElement.classList.add).toHaveBeenCalledWith('is-visible');
    });

    it('should remove "is-visible" class when not scrolled to bottom', () => {
        context.window.scrollY = 0; // 0 + 500 = 500 < 1000 - 50
        vm.runInContext(sourceCode, context);

        const onScrollOrResize = addEventListenerMock.mock.calls.find(
            (call) => call[0] === 'scroll'
        )[1];

        expect(iconElement.classList.remove).toHaveBeenCalledWith('is-visible');
        expect(iconElement.classList.add).not.toHaveBeenCalled();

        iconElement.classList.add.mockClear();
        iconElement.classList.remove.mockClear();

        context.window.scrollY = 400;
        onScrollOrResize();
        expect(iconElement.classList.remove).toHaveBeenCalledWith('is-visible');
    });

    it('should use documentElement.scrollTop if window.scrollY is falsy', () => {
        context.window.scrollY = 0;
        context.document.documentElement.scrollTop = 450; // 450 + 500 = 950 >= 1000 - 50
        vm.runInContext(sourceCode, context);
        expect(iconElement.classList.add).toHaveBeenCalledWith('is-visible');
    });
});
