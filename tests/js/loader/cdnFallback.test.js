const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../../js/loader/cdnFallback.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('CDNLoader', () => {
    let loader;
    let context;
    let mockDocument;
    let mockWindow;

    beforeEach(() => {
        jest.clearAllMocks();

        mockDocument = {
            createElement: jest.fn((tagName) => {
                return {
                    tagName,
                    // mock properties
                };
            }),
            createDocumentFragment: jest.fn(() => {
                const children = [];
                return {
                    appendChild: jest.fn((el) => children.push(el)),
                    children,
                };
            }),
            head: {
                appendChild: jest.fn((el) => {
                    if (el.tagName === 'link' && el.onerror) {
                        // Simulate link failure to trigger the fallback fetch
                        el.onerror();
                    }
                }),
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
            console: console,
            setTimeout: setTimeout,
            Promise: Promise,
        };
        // Add circular reference like in font-awesome-loader
        context.window.document = mockDocument;
        context.document.defaultView = mockWindow;

        vm.createContext(context);
        vm.runInContext(code, context);

        loader = context.window.CDNLoader;
    });

    describe('loadCssWithFallback', () => {
        it('should resolve without throwing if fetch fails on the last URL', () => {
            const urls = ['https://cdn.example.com/style.css'];

            context.fetch.mockReturnValue(Promise.reject(new Error('Network Error')));

            return loader.loadCssWithFallback(urls).then(() => {
                expect(context.fetch).toHaveBeenCalledWith('https://cdn.example.com/style.css', {
                    mode: 'cors',
                });
                // Since fetch failed, it shouldn't have created a style tag
                expect(mockDocument.createElement).not.toHaveBeenCalledWith('style');
            });
        });

        it('should fetch css when on the last URL and resolve if OK', () => {
            const urls = ['https://cdn.example.com/style.css'];

            context.fetch.mockReturnValue(
                Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve('body { color: red; }'),
                })
            );

            return loader.loadCssWithFallback(urls).then(() => {
                expect(context.fetch).toHaveBeenCalledWith('https://cdn.example.com/style.css', {
                    mode: 'cors',
                });
                expect(mockDocument.createElement).toHaveBeenCalledWith('style');
                expect(mockDocument.head.appendChild).toHaveBeenCalled();
            });
        });

        it('should try first URL as link tag and resolve if it loads successfully', () => {
            const urls = [
                'https://cdn.example.com/style1.css',
                'https://cdn.example.com/style2.css',
            ];

            // Override head.appendChild to trigger onload for link tags
            mockDocument.head.appendChild = jest.fn((el) => {
                if (el.tagName === 'link' && el.onload) {
                    el.onload();
                }
            });

            return loader.loadCssWithFallback(urls).then(() => {
                expect(mockDocument.createElement).toHaveBeenCalledWith('link');
                expect(context.fetch).not.toHaveBeenCalled();
            });
        });
    });

    describe('preconnect', () => {
        it('should append link elements for each origin', () => {
            const origins = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
            loader.preconnect(origins);

            expect(mockDocument.createDocumentFragment).toHaveBeenCalled();
            expect(mockDocument.createElement).toHaveBeenCalledWith('link');
            expect(mockDocument.head.appendChild).toHaveBeenCalledTimes(1);
        });

        it('should gracefully handle errors', () => {
            mockDocument.createElement.mockImplementation(() => {
                throw new Error('createElement error');
            });
            expect(() => loader.preconnect(['https://example.com'])).not.toThrow();
        });
    });

    describe('loadScriptSequential', () => {
        it('should resolve when all scripts load successfully', () => {
            const urls = ['script1.js', 'script2.js'];

            mockDocument.head.appendChild = jest.fn((el) => {
                if (el.tagName === 'script' && el.onload) {
                    el.onload();
                }
            });

            return loader.loadScriptSequential(urls, { defer: true, async: true }).then(() => {
                expect(mockDocument.createElement).toHaveBeenCalledWith('script');
            });
        });
    });
});
