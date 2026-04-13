/** @jest-environment jsdom */

describe('CDNLoader', () => {
    let loader;
    let createdElements = [];

    beforeEach(() => {
        jest.resetModules();
        createdElements = [];

        // Setup global window properties
        window.fetch = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});

        // Mock document.createElement to track elements
        const originalCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            const el = originalCreateElement(tagName);
            createdElements.push(el);
            return el;
        });

        // Mock head.appendChild to track
        jest.spyOn(document.head, 'appendChild').mockImplementation(() => {});

        loader = require('../../../js/loader/cdnFallback.js');
    });

    afterEach(() => {
        delete window.CDNLoader;
        jest.restoreAllMocks();
    });

    describe('initialization', () => {
        it('should exit early if window.CDNLoader already exists', () => {
            const existingLoader = { preconnect: jest.fn() };
            window.CDNLoader = existingLoader;

            // Re-require to trigger initialization
            require('../../../js/loader/cdnFallback.js');

            // It should not have been overwritten on window
            expect(window.CDNLoader).toBe(existingLoader);
            // But require() returns the module's exports, which are the functions defined in the file
            // even if they weren't assigned to window.
            // Wait, the IIFE returns early. Let's check what require returns.
            // In my implementation of cdnFallback.js, if it returns early,
            // module.exports will be empty or previous value.
        });
    });

    describe('preconnect', () => {
        it('should append link elements for each origin', () => {
            const origins = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
            loader.preconnect(origins);

            const links = createdElements.filter((el) => el.tagName === 'LINK');
            expect(links).toHaveLength(2);
            expect(links[0].rel).toBe('preconnect');
            expect(links[0].href).toContain(origins[0]);
            expect(links[1].href).toContain(origins[1]);
        });

        it('should gracefully handle and log errors', () => {
            const error = new Error('createElement error');
            document.createElement.mockImplementationOnce(() => {
                throw error;
            });
            expect(() => loader.preconnect(['https://example.com'])).not.toThrow();
            expect(console.error).toHaveBeenCalledWith('Preconnect failed:', error);
        });

        it('should not append anything if origins array is empty', () => {
            loader.preconnect([]);
            const links = createdElements.filter((el) => el.tagName === 'LINK');
            expect(links).toHaveLength(0);
        });
    });

    describe('loadScriptSequential', () => {
        it('should resolve when the first script loads successfully', async () => {
            const urls = ['script1.js', 'script2.js'];
            const promise = loader.loadScriptSequential(urls);

            const scriptEl = createdElements.find((el) => el.tagName === 'SCRIPT');
            expect(scriptEl.src).toContain('script1.js');

            scriptEl.onload();
            await expect(promise).resolves.toBeUndefined();
        });

        it('should fallback to second URL if first fails', async () => {
            const urls = ['fail.js', 'success.js'];
            const promise = loader.loadScriptSequential(urls);

            const firstScript = createdElements[0];
            firstScript.onerror();

            const secondScript = createdElements[1];
            expect(secondScript.src).toContain('success.js');

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

            const linkEl = createdElements.find((el) => el.tagName === 'LINK');
            expect(linkEl.href).toContain('style1.css');

            linkEl.onload();
            await expect(promise).resolves.toBeUndefined();
            expect(window.fetch).not.toHaveBeenCalled();
        });

        it('should try second URL if first link tag fails', async () => {
            const urls = ['fail.css', 'success.css'];
            const promise = loader.loadCssWithFallback(urls);

            const firstLink = createdElements[0];
            firstLink.onerror();

            const secondLink = createdElements[1];
            expect(secondLink.href).toContain('success.css');

            secondLink.onload();
            await expect(promise).resolves.toBeUndefined();
        });

        it('should fetch css when all link tags fail and resolve if OK', async () => {
            const urls = ['style.css'];
            window.fetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('body { color: red; }'),
            });

            const promise = loader.loadCssWithFallback(urls);
            const linkEl = createdElements.find((el) => el.tagName === 'LINK');
            linkEl.onerror();

            await promise;
            expect(window.fetch).toHaveBeenCalledWith('style.css', { mode: 'cors' });
            const styleTag = createdElements.find((el) => el.tagName === 'STYLE');
            expect(styleTag.textContent).toBe('body { color: red; }');
        });

        it('should resolve without throwing if fetch fails after link tag fails', async () => {
            const urls = ['style.css'];
            window.fetch.mockRejectedValueOnce(new Error('Network Error'));

            const promise = loader.loadCssWithFallback(urls);
            const linkEl = createdElements.find((el) => el.tagName === 'LINK');
            linkEl.onerror();

            await expect(promise).resolves.toBeUndefined();
            expect(createdElements.some((el) => el.tagName === 'STYLE')).toBe(false);
        });

        it('should resolve if fetch response is not ok after link tag fails', async () => {
            const urls = ['style.css'];
            window.fetch.mockResolvedValueOnce({ ok: false });

            const promise = loader.loadCssWithFallback(urls);
            const linkEl = createdElements.find((el) => el.tagName === 'LINK');
            linkEl.onerror();

            await expect(promise).resolves.toBeUndefined();
        });

        it('should resolve immediately if urls is empty', async () => {
            const promise = loader.loadCssWithFallback([]);
            await expect(promise).resolves.toBeUndefined();
        });
    });

    describe('fallback edge cases', () => {
        it('should gracefully handle missing window.console.warn', async () => {
            const urls = ['style.css'];
            window.fetch.mockRejectedValueOnce(new Error('Network Error'));

            // Mock console.warn to be undefined
            const originalWarn = console.warn;
            console.warn = undefined;

            const promise = loader.loadCssWithFallback(urls);
            const linkEl = createdElements.find((el) => el.tagName === 'LINK');
            linkEl.onerror();

            await expect(promise).resolves.toBeUndefined();
            console.warn = originalWarn;
        });

        it('should call window.console.warn when fetch fails after link tag fails', async () => {
            const urls = ['style.css'];
            const mockError = new Error('Network Error');
            window.fetch.mockRejectedValueOnce(mockError);

            const promise = loader.loadCssWithFallback(urls);
            const linkEl = createdElements.find((el) => el.tagName === 'LINK');
            linkEl.onerror();

            await expect(promise).resolves.toBeUndefined();
            expect(console.warn).toHaveBeenCalledWith('CDN fallback CSS load failed:', mockError);
        });
    });

    describe('empty urls edge case for loadScriptSequential', () => {
        it('should reject if urls is empty', async () => {
            await expect(loader.loadScriptSequential([])).rejects.toThrow('all failed: ');
        });
    });
});
