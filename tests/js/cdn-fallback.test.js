const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Tests for CDNLoader fallback mechanisms
 *
 * Uses a manual DOM mock within a Node vm context, similar to other tests,
 * because jest-environment-jsdom is not available.
 */

const sourcePath = path.resolve(__dirname, '../../js/loader/cdnFallback.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('CDNLoader.loadScriptSequential', () => {
    let loader;
    let context;
    let mockDocument;
    let mockHead;
    let createdElements = [];

    beforeEach(() => {
        createdElements = [];
        mockHead = {
            appendChild: jest.fn((element) => {
                // Simulate appending to the document
                createdElements.push(element);
            }),
        };

        mockDocument = {
            createElement: jest.fn((tagName) => {
                const element = {
                    tagName,
                    src: '',
                    crossOrigin: '',
                    defer: false,
                    async: false,
                    onload: null,
                    onerror: null,
                };
                return element;
            }),
            head: mockHead,
        };

        const mockWindow = {
            CDNLoader: null,
        };

        context = {
            document: mockDocument,
            window: mockWindow,
        };

        vm.createContext(context);
        vm.runInContext(code, context);

        loader = context.window.CDNLoader;
    });

    test('successfully loads the first script URL', async () => {
        const promise = loader.loadScriptSequential(['http://example.com/script1.js']);

        // Check if an element was created and appended
        expect(mockDocument.createElement).toHaveBeenCalledWith('script');
        expect(mockHead.appendChild).toHaveBeenCalled();
        expect(createdElements).toHaveLength(1);

        const scriptEl = createdElements[0];
        expect(scriptEl.src).toBe('http://example.com/script1.js');
        expect(scriptEl.crossOrigin).toBe('anonymous');

        // Simulate successful load
        expect(typeof scriptEl.onload).toBe('function');
        scriptEl.onload();

        await expect(promise).resolves.toBeUndefined();
    });

    test('falls back to second URL if first fails', async () => {
        const promise = loader.loadScriptSequential([
            'http://example.com/fail.js',
            'http://example.com/success.js',
        ]);

        expect(createdElements).toHaveLength(1);
        const firstScript = createdElements[0];
        expect(firstScript.src).toBe('http://example.com/fail.js');

        // Simulate failure on the first script
        expect(typeof firstScript.onerror).toBe('function');
        firstScript.onerror();

        // A second script element should be created and appended
        expect(createdElements).toHaveLength(2);
        const secondScript = createdElements[1];
        expect(secondScript.src).toBe('http://example.com/success.js');

        // Simulate success on the second script
        expect(typeof secondScript.onload).toBe('function');
        secondScript.onload();

        await expect(promise).resolves.toBeUndefined();
    });

    test('rejects with error if all URLs fail', async () => {
        const promise = loader.loadScriptSequential([
            'http://example.com/fail1.js',
            'http://example.com/fail2.js',
        ]);

        const firstScript = createdElements[0];
        firstScript.onerror();

        const secondScript = createdElements[1];
        secondScript.onerror();

        await expect(promise).rejects.toThrow(
            'all failed: http://example.com/fail1.js, http://example.com/fail2.js'
        );
    });

    test('applies defer and async attributes when provided', async () => {
        const promise = loader.loadScriptSequential(['http://example.com/script.js'], {
            defer: true,
            async: true,
        });

        const scriptEl = createdElements[0];
        expect(scriptEl.defer).toBe(true);
        expect(scriptEl.async).toBe(true);

        scriptEl.onload();

        await expect(promise).resolves.toBeUndefined();
    });
});
