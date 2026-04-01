const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Consolidated tests for cdnFallback.js
 */

const sourcePath = path.resolve(__dirname, '../../../js/loader/cdnFallback.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('CDNLoader', () => {
    let loader;
    let context;
    let mockDocument;
    let mockWindow;
    let createdElements = [];

    beforeEach(() => {
        jest.clearAllMocks();
        createdElements = [];

        mockDocument = {
            createElement: jest.fn((tagName) => {
                const el = {
                    tagName: tagName.toLowerCase(),
                    src: '',
                    href: '',
                    rel: '',
                    crossOrigin: '',
                    defer: false,
                    async: false,
                    onload: null,
                    onerror: null,
                    textContent: '',
                };
                createdElements.push(el);
                return el;
            }),
            createDocumentFragment: jest.fn(() => {
                const children = [];
                return {
                    appendChild: jest.fn((el) => children.push(el)),
                    children,
                };
            }),
            head: {
                appendChild: jest.fn(),
            },
            body: {
                appendChild: jest.fn(),
            },
        };

        mockWindow = {};

        context = {
            document: mockDocument,
            window: mockWindow,
            fetch: jest.fn(),
            console: {
                error: jest.fn(),
                warn: jest.fn(),
                log: jest.fn(),
            },
            setTimeout: jest.fn((fn) => fn()),
            Promise: Promise,
        };

        context.window.document = mockDocument;
        context.document.defaultView = mockWindow;

        vm.createContext(context);
        vm.runInContext(code, context);

        loader = context.window.CDNLoader;
    });

    describe('initialization', () => {
        it('should exit early if window.CDNLoader already exists', () => {
            const existingLoader = { preconnect: jest.fn() };
            const customContext = {
                window: {
                    CDNLoader: existingLoader,
                },
            };
            vm.createContext(customContext);
            vm.runInContext(code, customContext);

            // It should not have been overwritten
            expect(customContext.window.CDNLoader).toBe(existingLoader);
        });
    });

    describe('preconnect', () => {
        it('should append link elements for each origin', () => {
            const origins = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
            loader.preconnect(origins);

            expect(mockDocument.createDocumentFragment).toHaveBeenCalled();
            expect(mockDocument.createElement).toHaveBeenCalledWith('link');
            expect(mockDocument.head.appendChild).toHaveBeenCalledTimes(1);

            const links = createdElements.filter((el) => el.tagName === 'link');
            expect(links).toHaveLength(2);
            expect(links[0].rel).toBe('preconnect');
            expect(links[0].href).toBe(origins[0]);
            expect(links[1].href).toBe(origins[1]);
        });

        it('should gracefully handle and log errors', () => {
            const error = new Error('createElement error');
            mockDocument.createElement.mockImplementationOnce(() => {
                throw error;
            });
            expect(() => loader.preconnect(['https://example.com'])).not.toThrow();
            expect(context.console.error).toHaveBeenCalledWith('Preconnect failed:', error);
        });

        it('should not append anything if origins array is empty', () => {
            loader.preconnect([]);
            expect(mockDocument.createElement).not.toHaveBeenCalled();
            expect(mockDocument.head.appendChild).toHaveBeenCalled();
        });
    });

    describe('loadScriptSequential', () => {
        it('should resolve when the first script loads successfully', async () => {
            const urls = ['script1.js', 'script2.js'];
            const promise = loader.loadScriptSequential(urls);

            const scriptEl = createdElements.find((el) => el.tagName === 'script');
            expect(scriptEl.src).toBe('script1.js');

            scriptEl.onload();
            await expect(promise).resolves.toBeUndefined();
        });

        it('should fallback to second URL if first fails', async () => {
            const urls = ['fail.js', 'success.js'];
            const promise = loader.loadScriptSequential(urls);

            const firstScript = createdElements[0];
            firstScript.onerror();

            const secondScript = createdElements[1];
            expect(secondScript.src).toBe('success.js');

            secondScript.onload();
            await expect(promise).resolves.toBeUndefined();
        });

        it('should reject with error if all URLs fail', async () => {
            const urls = ['fail1.js', 'fail2.js'];
            const promise = loader.loadScriptSequential(urls);

            createdElements[0].onerror();
            createdElements[1].onerror();

            await expect(promise).rejects.toThrow('all failed: fail1.js, fail2.js');
        });

        it('should apply defer and async attributes when provided', async () => {
            const promise = loader.loadScriptSequential(['script.js'], {
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

    describe('loadCssWithFallback', () => {
        it('should resolve if the first URL as link tag loads successfully', async () => {
            const urls = ['style1.css', 'style2.css'];
            const promise = loader.loadCssWithFallback(urls);

            const linkEl = createdElements.find((el) => el.tagName === 'link');
            expect(linkEl.href).toBe('style1.css');

            linkEl.onload();
            await expect(promise).resolves.toBeUndefined();
            expect(context.fetch).not.toHaveBeenCalled();
        });

        it('should try second URL if first link tag fails', async () => {
            const urls = ['fail.css', 'success.css'];
            const promise = loader.loadCssWithFallback(urls);

            const firstLink = createdElements[0];
            firstLink.onerror();

            const secondLink = createdElements[1];
            expect(secondLink.href).toBe('success.css');

            secondLink.onload();
            await expect(promise).resolves.toBeUndefined();
        });

        it('should fetch css when all link tags fail and resolve if OK', async () => {
            const urls = ['style.css'];
            context.fetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('body { color: red; }'),
            });

            const promise = loader.loadCssWithFallback(urls);
            const linkEl = createdElements.find((el) => el.tagName === 'link');
            linkEl.onerror();

            await promise;
            expect(context.fetch).toHaveBeenCalledWith('style.css', { mode: 'cors' });
            const styleTag = createdElements.find((el) => el.tagName === 'style');
            expect(styleTag.textContent).toBe('body { color: red; }');
        });

        it('should resolve without throwing if fetch fails after link tag fails', async () => {
            const urls = ['style.css'];
            context.fetch.mockRejectedValueOnce(new Error('Network Error'));

            const promise = loader.loadCssWithFallback(urls);
            const linkEl = createdElements.find((el) => el.tagName === 'link');
            linkEl.onerror();

            await expect(promise).resolves.toBeUndefined();
            expect(mockDocument.createElement).not.toHaveBeenCalledWith('style');
        });

        it('should resolve if fetch response is not ok after link tag fails', async () => {
            const urls = ['style.css'];
            context.fetch.mockResolvedValueOnce({ ok: false });

            const promise = loader.loadCssWithFallback(urls);
            const linkEl = createdElements.find((el) => el.tagName === 'link');
            linkEl.onerror();

            await expect(promise).resolves.toBeUndefined();
        });

        it('should resolve immediately if urls is empty', async () => {
            const promise = loader.loadCssWithFallback([]);
            await expect(promise).resolves.toBeUndefined();
        });
    });

    describe('empty urls edge case for loadScriptSequential', () => {
        it('should reject if urls is empty', async () => {
            const { loadScriptSequential } = context.window.CDNLoader;
            await expect(loadScriptSequential([])).rejects.toThrow('all failed: ');
        });
    });
});
