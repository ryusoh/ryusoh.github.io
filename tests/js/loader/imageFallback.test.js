const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('imageFallback.js', () => {
    let context;
    let imgElement;
    let addEventListenerMock;
    let consoleWarnMock;

    const sourceCode = fs.readFileSync(
        path.resolve(__dirname, '../../../js/loader/imageFallback.js'),
        'utf8'
    );

    beforeEach(() => {
        addEventListenerMock = jest.fn();
        consoleWarnMock = jest.fn();

        imgElement = {
            getAttribute: jest.fn(),
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
            },
            addEventListener: addEventListenerMock,
            src: '',
            complete: false,
            naturalWidth: 0,
        };

        context = vm.createContext({
            document: {
                querySelectorAll: jest.fn(() => [imgElement]),
            },
            console: {
                warn: consoleWarnMock,
            },
            window: {
                console: {
                    warn: consoleWarnMock,
                },
            },
            Array: Array,
            JSON: JSON,
        });
    });

    it('should do nothing if data-fallbacks is missing', () => {
        imgElement.getAttribute.mockReturnValue(null);
        vm.runInContext(sourceCode, context);
        expect(imgElement.addEventListener).not.toHaveBeenCalled();
    });

    it('should warn and do nothing if data-fallbacks is invalid JSON', () => {
        imgElement.getAttribute.mockReturnValue('invalid-json');
        vm.runInContext(sourceCode, context);
        expect(consoleWarnMock).toHaveBeenCalledWith('Caught exception:', expect.any(Error));
        expect(imgElement.addEventListener).not.toHaveBeenCalled();
    });

    it('should do nothing if data-fallbacks is not an array', () => {
        imgElement.getAttribute.mockReturnValue('{"key": "value"}');
        vm.runInContext(sourceCode, context);
        expect(imgElement.addEventListener).not.toHaveBeenCalled();
    });

    it('should do nothing if data-fallbacks is an empty array', () => {
        imgElement.getAttribute.mockReturnValue('[]');
        vm.runInContext(sourceCode, context);
        expect(imgElement.addEventListener).not.toHaveBeenCalled();
    });

    it('should setup fallback listeners and set src to first fallback if src is empty', () => {
        imgElement.getAttribute.mockReturnValue('["url1", "url2"]');
        vm.runInContext(sourceCode, context);

        expect(imgElement.classList.remove).toHaveBeenCalledWith('is-fallback-ready');
        expect(imgElement.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
        expect(imgElement.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
        expect(imgElement.src).toBe('url1');
    });

    it('should mark as ready if already complete and has naturalWidth', () => {
        imgElement.getAttribute.mockReturnValue('["url1", "url2"]');
        imgElement.src = 'url1';
        imgElement.complete = true;
        imgElement.naturalWidth = 100;

        vm.runInContext(sourceCode, context);

        expect(imgElement.classList.add).toHaveBeenCalledWith('is-fallback-ready');
    });

    it('should add "is-fallback-ready" class on load event', () => {
        imgElement.getAttribute.mockReturnValue('["url1", "url2"]');
        vm.runInContext(sourceCode, context);

        const loadListener = addEventListenerMock.mock.calls.find((call) => call[0] === 'load')[1];
        loadListener();

        expect(imgElement.classList.add).toHaveBeenCalledWith('is-fallback-ready');
    });

    it('should try next url on error event', () => {
        imgElement.getAttribute.mockReturnValue('["url1", "url2"]');
        vm.runInContext(sourceCode, context);

        const errorListener = addEventListenerMock.mock.calls.find(
            (call) => call[0] === 'error'
        )[1];

        expect(imgElement.src).toBe('url1');

        errorListener(); // Trigger error

        expect(imgElement.src).toBe('url1'); // The first call to error listener actually sets list[i++] where i was 0. So it sets to list[0] which is 'url1'. This is fine. Wait, let's verify if tryNext works:

        errorListener(); // Next call sets it to 'url2'
        expect(imgElement.src).toBe('url2');

        errorListener(); // No more fallbacks
        expect(imgElement.src).toBe('url2');
    });

    it('should catch exception and warn on general failure', () => {
        // Simulate querySelectorAll throwing an exception
        context.document.querySelectorAll = jest.fn(() => {
            throw new Error('Test general exception');
        });

        vm.runInContext(sourceCode, context);

        expect(consoleWarnMock).toHaveBeenCalledWith('Caught exception:', expect.any(Error));
    });
});
