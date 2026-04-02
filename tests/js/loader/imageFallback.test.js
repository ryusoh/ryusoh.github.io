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
            tagName: 'IMG',
            hasAttribute: jest.fn().mockImplementation((attr) => attr === 'data-fallbacks'),
            getAttribute: jest.fn(),
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
            },
            src: '',
            complete: false,
            naturalWidth: 0,
        };

        context = vm.createContext({
            document: {
                querySelectorAll: jest.fn(() => [imgElement]),
                addEventListener: addEventListenerMock,
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
        expect(imgElement.src).toBe(''); // No changes
    });

    it('should warn and do nothing if data-fallbacks is invalid JSON', () => {
        imgElement.getAttribute.mockReturnValue('invalid-json');
        vm.runInContext(sourceCode, context);
        expect(consoleWarnMock).toHaveBeenCalledWith('Caught exception:', expect.any(Error));
        expect(imgElement.src).toBe(''); // No changes
    });

    it('should do nothing if data-fallbacks string exceeds length limit', () => {
        const longString = '[' + '"a"'.repeat(1000) + ']';
        imgElement.getAttribute.mockReturnValue(longString);
        vm.runInContext(sourceCode, context);
        expect(imgElement.src).toBe(''); // No changes
    });

    it('should do nothing if data-fallbacks is not an array', () => {
        imgElement.getAttribute.mockReturnValue('{"key": "value"}');
        vm.runInContext(sourceCode, context);
        expect(imgElement.src).toBe(''); // No changes
    });

    it('should do nothing if data-fallbacks is an empty array', () => {
        imgElement.getAttribute.mockReturnValue('[]');
        vm.runInContext(sourceCode, context);
        expect(imgElement.src).toBe(''); // No changes
    });

    it('should set internal properties and set src to first fallback if src is empty', () => {
        imgElement.getAttribute.mockReturnValue('["url1", "url2"]');
        vm.runInContext(sourceCode, context);

        expect(imgElement.classList.remove).toHaveBeenCalledWith('is-fallback-ready');
        expect(imgElement.__fallbackList).toEqual(['url1', 'url2']);
        expect(imgElement.__fallbackIndex).toBe(0);
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

    it('should bind global document load and error event listeners correctly', () => {
        vm.runInContext(sourceCode, context);
        expect(addEventListenerMock).toHaveBeenCalledWith('load', expect.any(Function), true);
        expect(addEventListenerMock).toHaveBeenCalledWith('error', expect.any(Function), true);
    });

    it('should add "is-fallback-ready" class when global load event fires for valid image', () => {
        imgElement.getAttribute.mockReturnValue('["url1", "url2"]');
        vm.runInContext(sourceCode, context);

        const loadListener = addEventListenerMock.mock.calls.find((call) => call[0] === 'load')[1];

        loadListener({ target: imgElement });

        expect(imgElement.classList.add).toHaveBeenCalledWith('is-fallback-ready');
    });

    it('should try next url when global error event fires for valid image', () => {
        imgElement.getAttribute.mockReturnValue('["url1", "url2"]');
        vm.runInContext(sourceCode, context);

        const errorListener = addEventListenerMock.mock.calls.find(
            (call) => call[0] === 'error'
        )[1];

        expect(imgElement.src).toBe('url1');

        errorListener({ target: imgElement }); // First error listener triggers list[i++] where i=0, so it sets it to list[0] which is 'url1'

        expect(imgElement.src).toBe('url1');

        errorListener({ target: imgElement }); // Next sets it to 'url2'
        expect(imgElement.src).toBe('url2');

        errorListener({ target: imgElement }); // No more fallbacks
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

    it('should sanitize fallback array and remove non-string elements', () => {
        imgElement.getAttribute.mockReturnValue('["url1", 123, "url2", null, {}, "url3"]');
        vm.runInContext(sourceCode, context);

        expect(imgElement.src).toBe('url1');

        const errorListener = addEventListenerMock.mock.calls.find(
            (call) => call[0] === 'error'
        )[1];

        errorListener({ target: imgElement }); // Next sets src to list[0] which is url1
        expect(imgElement.src).toBe('url1');

        errorListener({ target: imgElement }); // Next should be url2
        expect(imgElement.src).toBe('url2');

        errorListener({ target: imgElement }); // Next should be url3
        expect(imgElement.src).toBe('url3');

        errorListener({ target: imgElement }); // Stop at url3
        expect(imgElement.src).toBe('url3');
    });
});
