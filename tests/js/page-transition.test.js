const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../js/page-transition.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');

// Strip out the ES module import statement because vm.runInContext runs in script mode
// and cannot parse 'import' syntax. We replace it with an empty object mock for THREE.
const codeToEvaluate = sourceCode.replace(
    /import\s+\*\s+as\s+THREE\s+from\s+['"][^'"]+['"];/,
    'const THREE = {};'
);

describe('page-transition.js', () => {
    let context;
    let hasTransitionParam;
    let clampUnit;
    let parseRgbFunction;
    let hexToRgbArray;
    let parseColor;
    let updateHistoryUrl;
    let storeCaptureData;
    let consumeCaptureData;
    let getValidatedUrl;

    beforeEach(() => {
        // Mock the minimal DOM environment needed to bypass IIFE execution errors
        const mockDocument = {
            readyState: 'complete',
            documentElement: {
                classList: { add: jest.fn(), remove: jest.fn() },
                scrollHeight: 1000,
                clientWidth: 1024,
                clientHeight: 768,
            },
            body: {
                getAttribute: jest.fn(),
                appendChild: jest.fn(),
                style: {},
            },
            querySelectorAll: jest.fn().mockReturnValue([]),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockReturnValue({
                appendChild: jest.fn(),
                style: {},
            }),
            getElementById: jest.fn().mockReturnValue(null),
            head: { appendChild: jest.fn() },
        };

        const mockWindow = {
            location: {
                href: 'http://localhost/',
            },
            URL: jest.fn(),
            addEventListener: jest.fn(),
            matchMedia: jest.fn().mockReturnValue({ matches: false }),
            getComputedStyle: jest.fn().mockReturnValue({
                getPropertyValue: jest.fn().mockReturnValue(''),
            }),
            sessionStorage: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
            },
            innerWidth: 1024,
            innerHeight: 768,
            devicePixelRatio: 1,
            requestAnimationFrame: jest.fn(),
            cancelAnimationFrame: jest.fn(),
            setTimeout: jest.fn(),
            clearTimeout: jest.fn(),
        };

        context = {
            window: mockWindow,
            document: mockDocument,
            Promise: Promise,
            console: console,
            setTimeout: mockWindow.setTimeout,
            clearTimeout: mockWindow.clearTimeout,
            URL: URL, // Use native URL for tests that don't mock it
        };

        vm.createContext(context);

        // Run the code. The modified source exposes internals on window.__PageTransitionForTesting
        vm.runInContext(codeToEvaluate, context);
        hasTransitionParam = context.window.__PageTransitionForTesting.hasTransitionParam;
        clampUnit = context.window.__PageTransitionForTesting.clampUnit;
        parseRgbFunction = context.window.__PageTransitionForTesting.parseRgbFunction;
        hexToRgbArray = context.window.__PageTransitionForTesting.hexToRgbArray;
        parseColor = context.window.__PageTransitionForTesting.parseColor;
        updateHistoryUrl = context.window.__PageTransitionForTesting.updateHistoryUrl;
        storeCaptureData = context.window.__PageTransitionForTesting.storeCaptureData;
        consumeCaptureData = context.window.__PageTransitionForTesting.consumeCaptureData;
        getValidatedUrl = context.window.__PageTransitionForTesting.getValidatedUrl;
    });

    describe('getValidatedUrl', () => {
        beforeEach(() => {
            context.window.URL = URL;
            context.window.console = {
                error: jest.fn(),
                warn: jest.fn(),
            };
            // Since getValidatedUrl relies on console, we need to inject our mock into the context's console
            // since the code uses window.console directly if available, but in Node context it might use the global console.
            // Let's ensure the context has the mock console
            context.console = context.window.console;
        });

        test('returns null for non-string input', () => {
            expect(getValidatedUrl(null)).toBeNull();
            expect(getValidatedUrl(undefined)).toBeNull();
            expect(getValidatedUrl({})).toBeNull();
        });

        test('validates and returns clean same-origin URL', () => {
            context.window.location.href = 'https://example.com/page1';
            context.window.location.origin = 'https://example.com';
            expect(getValidatedUrl('https://example.com/page2')).toBe('https://example.com/page2');
            expect(getValidatedUrl('/page2')).toBe('/page2');
        });

        test('strips leading whitespace and control characters', () => {
            context.window.location.href = 'https://example.com/page1';
            context.window.location.origin = 'https://example.com';
            // Include spaces and null byte
            const maliciousUrl = '   \u0000\u001F/page2';
            expect(getValidatedUrl(maliciousUrl)).toBe('/page2');
        });

        test('blocks non-http/https protocols', () => {
            context.window.location.href = 'https://example.com/';
            context.window.location.origin = 'https://example.com';
            expect(getValidatedUrl('javascript:alert(1)')).toBeNull();
            expect(getValidatedUrl('data:text/html,<html>')).toBeNull();
            expect(context.window.console.error).toHaveBeenCalledWith(
                '[page-transition] Blocked potentially malicious URL scheme'
            );
        });

        test('blocks cross-origin navigation', () => {
            context.window.location.href = 'https://example.com/';
            context.window.location.origin = 'https://example.com';
            expect(getValidatedUrl('https://evil.com/page')).toBeNull();
            expect(context.window.console.error).toHaveBeenCalledWith(
                '[page-transition] Blocked cross-origin navigation'
            );
        });

        test('returns null when URL parsing throws', () => {
            context.window.URL = jest.fn().mockImplementation(() => {
                throw new Error('Invalid URL');
            });
            expect(getValidatedUrl('/page')).toBeNull();
            // Error objects generated within Node's vm context in Jest should use expect.anything()
            expect(context.window.console.error).toHaveBeenCalledWith(
                '[page-transition] Blocked invalid URL',
                expect.anything()
            );
        });
    });

    describe('support', () => {
        test('canUseWebGL should catch error and handle missing console', () => {
            const getContext = jest.fn().mockImplementation(() => {
                throw new Error('foo');
            });
            context.document.createElement = jest.fn().mockReturnValue({ getContext });
            context.window.WebGLRenderingContext = {}; // mock it
            const prevConsole = context.window.console;
            context.window.console = undefined;
            expect(() => context.window.__PageTransitionForTesting.canUseWebGL()).not.toThrow();
            context.window.console = prevConsole;
        });

        test('canUseWebGL should catch error and handle console.warn', () => {
            const getContext = jest.fn().mockImplementation(() => {
                throw new Error('foo');
            });
            context.document.createElement = jest.fn().mockReturnValue({ getContext });
            context.window.WebGLRenderingContext = {}; // mock it
            context.window.console = { warn: jest.fn() };
            expect(() => context.window.__PageTransitionForTesting.canUseWebGL()).not.toThrow();
            expect(context.window.console.warn).toHaveBeenCalled();
        });
    });

    describe('hasTransitionParam', () => {
        test('should return false when window.URL constructor throws an error', () => {
            // Mock window.URL to throw an error
            context.window.URL = jest.fn().mockImplementation(() => {
                throw new Error('Invalid URL');
            });

            const result = hasTransitionParam();

            expect(result).toBe(false);
            expect(context.window.URL).toHaveBeenCalledWith('http://localhost/');
        });

        test('should return false when window is undefined', () => {
            // Simulate missing window
            const prevWindow = context.window;
            context.window = undefined;
            const result = hasTransitionParam();
            expect(result).toBe(false);
            context.window = prevWindow;
        });

        test('should return false when window.location is undefined', () => {
            // Simulate missing location
            const prevLocation = context.window.location;
            context.window.location = undefined;
            const result = hasTransitionParam();
            expect(result).toBe(false);
            context.window.location = prevLocation;
        });

        test('should not throw if console missing in catch block', () => {
            context.window.URL = jest.fn().mockImplementation(() => {
                throw new Error('foo');
            });
            const prevConsole = context.window.console;
            context.window.console = undefined;
            expect(() => hasTransitionParam()).not.toThrow();
            context.window.console = prevConsole;
        });

        test('should console.warn if parsing fails', () => {
            context.window.URL = jest.fn().mockImplementation(() => {
                throw new Error('foo');
            });
            context.window.console = { warn: jest.fn() };
            expect(() => hasTransitionParam()).not.toThrow();
            expect(context.window.console.warn).toHaveBeenCalled();
        });

        test('should return true when transition param is present', () => {
            context.window.URL = jest.fn().mockImplementation(() => ({
                searchParams: {
                    has: jest.fn().mockReturnValue(true),
                },
            }));
            expect(hasTransitionParam()).toBe(true);
        });
    });

    describe('clearTransitionParam', () => {
        test('should catch error and gracefully fallback missing console', () => {
            context.window.URL = jest.fn().mockImplementation(() => {
                throw new Error('foo');
            });
            const prevConsole = context.window.console;
            context.window.console = undefined;
            expect(() =>
                context.window.__PageTransitionForTesting.clearTransitionParam()
            ).not.toThrow();
            context.window.console = prevConsole;
        });

        test('should catch error and gracefully fallback console.warn', () => {
            context.window.URL = jest.fn().mockImplementation(() => {
                throw new Error('foo');
            });
            context.window.console = { warn: jest.fn() };
            expect(() =>
                context.window.__PageTransitionForTesting.clearTransitionParam()
            ).not.toThrow();
            expect(context.window.console.warn).toHaveBeenCalled();
        });
    });

    describe('clampUnit', () => {
        test('should return the value if it is between 0 and 1', () => {
            expect(clampUnit(0.5)).toBe(0.5);
            expect(clampUnit(0.1)).toBe(0.1);
            expect(clampUnit(0.9)).toBe(0.9);
        });

        test('should clamp values less than 0 to 0', () => {
            expect(clampUnit(-0.1)).toBe(0);
            expect(clampUnit(-1)).toBe(0);
        });

        test('should clamp values greater than 1 to 1', () => {
            expect(clampUnit(1.1)).toBe(1);
            expect(clampUnit(2)).toBe(1);
        });

        test('should return exactly 0 for 0 and 1 for 1', () => {
            expect(clampUnit(0)).toBe(0);
            expect(clampUnit(1)).toBe(1);
        });
    });

    describe('parseRgbFunction', () => {
        test('valid rgb() parsing', () => {
            expect(parseRgbFunction('rgb(255, 0, 128)')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 1,
            });
            expect(parseRgbFunction('RGB(255, 0, 128)')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 1,
            });
        });

        test('valid rgba() parsing', () => {
            expect(parseRgbFunction('rgba(255, 0, 128, 0.5)')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 0.5,
            });
            expect(parseRgbFunction('RGBA(255, 0, 128, 0.5)')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 0.5,
            });
        });

        test('space handling', () => {
            expect(parseRgbFunction('rgb( 255 ,  0  ,   128 )')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 1,
            });
            expect(parseRgbFunction('rgba(  255  ,0 ,128,  0.5 )')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 0.5,
            });
        });

        test('out of bounds values are clamped', () => {
            // Values are divided by 255. 300/255 > 1, so it is clamped to 1. -50 < 0, clamped to 0.
            expect(parseRgbFunction('rgb(300, -50, 255)')).toEqual({ rgb: [1, 0, 1], alpha: 1 });
            expect(parseRgbFunction('rgba(300, -50, 255, 1.5)')).toEqual({
                rgb: [1, 0, 1],
                alpha: 1,
            });
            expect(parseRgbFunction('rgba(300, -50, 255, -0.5)')).toEqual({
                rgb: [1, 0, 1],
                alpha: 0,
            });
        });

        test('malformed strings return null', () => {
            expect(parseRgbFunction('rgb(255, 0)')).toBeNull(); // Missing B
            expect(parseRgbFunction('rgb(255)')).toBeNull(); // Missing G, B
            expect(parseRgbFunction('rgb()')).toBeNull(); // Empty
            expect(parseRgbFunction('255, 0, 0')).toBeNull(); // No rgb() wrapper
            expect(parseRgbFunction('rgb(255, 0, 0')).toBeNull(); // Missing parenthesis
            expect(parseRgbFunction('rgb 255 0 0')).toBeNull(); // No parentheses
            expect(parseRgbFunction('rg(255, 0, 0)')).toBeNull(); // Typo
        });

        test('invalid numeric values return null', () => {
            expect(parseRgbFunction('rgb(a, b, c)')).toBeNull();
            expect(parseRgbFunction('rgb(255, b, 0)')).toBeNull();
            expect(parseRgbFunction('rgb(NaN, 0, 0)')).toBeNull();
        });

        test('missing alpha defaults to 1', () => {
            expect(parseRgbFunction('rgba(255, 0, 0)')).toEqual({ rgb: [1, 0, 0], alpha: 1 });
        });

        test('empty string returns null', () => {
            expect(parseRgbFunction('')).toBeNull();
        });
    });

    describe('hexToRgbArray', () => {
        test('valid 6-digit hex parsing', () => {
            expect(hexToRgbArray('#ff0080')).toEqual([1, 0, 128 / 255]);
            expect(hexToRgbArray('#00ff00')).toEqual([0, 1, 0]);
            expect(hexToRgbArray('#ffffff')).toEqual([1, 1, 1]);
            expect(hexToRgbArray('#000000')).toEqual([0, 0, 0]);
        });

        test('valid 3-digit hex parsing', () => {
            expect(hexToRgbArray('#f08')).toEqual([1, 0, 136 / 255]);
            expect(hexToRgbArray('#0f0')).toEqual([0, 1, 0]);
            expect(hexToRgbArray('#fff')).toEqual([1, 1, 1]);
            expect(hexToRgbArray('#000')).toEqual([0, 0, 0]);
        });

        test('case insensitivity', () => {
            expect(hexToRgbArray('#FF0080')).toEqual([1, 0, 128 / 255]);
            expect(hexToRgbArray('#F08')).toEqual([1, 0, 136 / 255]);
        });

        test('handling missing # prefix', () => {
            expect(hexToRgbArray('ff0080')).toEqual([1, 0, 128 / 255]);
            expect(hexToRgbArray('f08')).toEqual([1, 0, 136 / 255]);
        });

        test('invalid hex returns null', () => {
            // Note: The current implementation only checks for clean.length === 3 or 6.
            // It does not strictly validate that characters are valid hex or that length is exact BEFORE parsing.
            // However, it should return null if it cannot parse a valid 3 or 6 digit hex.
            expect(hexToRgbArray('')).toBeNull();
            expect(hexToRgbArray(' ')).toBeNull();
            expect(hexToRgbArray('#ff008')).toBeNull(); // Length 5 (after removing #)
            expect(hexToRgbArray('#ff00800')).toBeNull(); // Length 7 (after removing #)
        });
    });

    describe('parseColor', () => {
        const fallback = { rgb: [0, 0, 0], alpha: 0.5 };

        test('returns default if value is falsy', () => {
            expect(parseColor(null, fallback)).toEqual(fallback);
            expect(parseColor('', fallback)).toEqual(fallback);
            expect(parseColor(undefined, fallback)).toEqual(fallback);
        });

        test('parses valid 6-digit hex and retains fallback alpha', () => {
            expect(parseColor('#ff0000', fallback)).toEqual({
                rgb: [1, 0, 0],
                alpha: 0.5,
            });
            expect(parseColor('  #00ff00  ', fallback)).toEqual({
                rgb: [0, 1, 0],
                alpha: 0.5,
            });
        });

        test('parses valid 3-digit hex and retains fallback alpha', () => {
            expect(parseColor('#00f', fallback)).toEqual({
                rgb: [0, 0, 1],
                alpha: 0.5,
            });
        });

        test('parses rgb() function and retains rgb alpha from function', () => {
            expect(parseColor('rgb(255, 128, 0)', fallback)).toEqual({
                rgb: [1, 128 / 255, 0],
                alpha: 1, // rgb() implies full opacity
            });
        });

        test('parses rgba() function and sets parsed alpha', () => {
            expect(parseColor('rgba(255, 255, 255, 0.8)', fallback)).toEqual({
                rgb: [1, 1, 1],
                alpha: 0.8,
            });
        });

        test('returns fallback for completely invalid color strings', () => {
            expect(parseColor('invalid', fallback)).toEqual(fallback);
            expect(parseColor('foo', fallback)).toEqual(fallback);
        });
    });

    describe('updateHistoryUrl', () => {
        test('should replace history state with new url components', () => {
            const mockReplaceState = jest.fn();
            context.window.history = { replaceState: mockReplaceState };
            context.document.title = 'Test Title';

            const mockUrl = {
                pathname: '/test-path',
                search: '?param=1',
                hash: '#section',
            };

            updateHistoryUrl(mockUrl);

            expect(mockReplaceState).toHaveBeenCalledWith(
                {},
                'Test Title',
                '/test-path?param=1#section'
            );
        });

        test('should not throw if window.history is undefined', () => {
            context.window.history = undefined;
            expect(() => updateHistoryUrl({})).not.toThrow();
        });

        test('should not throw if replaceState is not a function', () => {
            context.window.history = { replaceState: null };
            expect(() => updateHistoryUrl({})).not.toThrow();
        });
    });

    describe('storeCaptureData', () => {
        test('should set item in sessionStorage if dataUrl is provided', () => {
            context.window.sessionStorage.setItem.mockClear();
            storeCaptureData('data:image/png;base64,1234');

            expect(context.window.sessionStorage.setItem).toHaveBeenCalledWith(
                'page-transition:capture',
                'data:image/png;base64,1234'
            );
        });

        test('should catch and log error if dataUrl payload exceeds 5MB limit', () => {
            context.window.sessionStorage.setItem.mockClear();

            // Generate a string larger than 5242880 characters
            const largeString = 'a'.repeat(5242881);
            storeCaptureData(largeString);

            expect(context.window.sessionStorage.setItem).not.toHaveBeenCalled();
        });

        test('should return early if dataUrl is falsy', () => {
            context.window.sessionStorage.setItem.mockClear();
            storeCaptureData(null);
            storeCaptureData('');
            storeCaptureData(undefined);

            expect(context.window.sessionStorage.setItem).not.toHaveBeenCalled();
        });

        test('should catch and log error if sessionStorage throws (e.g., Safari private browsing)', () => {
            const error = new Error('QuotaExceededError');
            context.window.sessionStorage.setItem.mockImplementation(() => {
                throw error;
            });
            context.window.console = { warn: jest.fn() };

            expect(() => storeCaptureData('data:image/png;base64,test')).not.toThrow();
            expect(context.window.console.warn).toHaveBeenCalledWith(
                '[page-transition] sessionStorage access error:',
                error
            );
        });

        test('should not throw if window or console is missing during error', () => {
            const error = new Error('QuotaExceededError');
            context.window.sessionStorage.setItem.mockImplementation(() => {
                throw error;
            });

            const prevConsole = context.window.console;
            context.window.console = undefined;

            expect(() => storeCaptureData('data:image/png;base64,test')).not.toThrow();

            context.window.console = prevConsole;
        });
    });

    describe('initReveal - project page skips intro animation', () => {
        let Constructor;

        beforeEach(() => {
            Constructor = context.window.__PageTransitionForTesting._Constructor;
            context.window.URL = jest.fn().mockImplementation(() => ({
                searchParams: {
                    has: jest.fn((param) => param === '__pt'),
                    delete: jest.fn(),
                },
                pathname: '/',
                search: '',
                hash: '',
            }));
            context.window.history = { replaceState: jest.fn() };
        });

        function createMockInstance(pageType) {
            return {
                enabled: true,
                pageType: pageType,
                container: { style: {} },
                uniforms: { uProgress: { value: 0 } },
                setupThree: jest.fn(),
                refreshColorUniforms: jest.fn(),
                applyStoredCaptureTexture: jest.fn(),
                setProgress: jest.fn(),
                hideOverlay: jest.fn(),
                showOverlay: jest.fn(),
                prepareDestinationTexture: jest.fn().mockReturnValue(Promise.resolve()),
                playIntro: jest.fn(),
            };
        }

        test('project pages with transition param should hide overlay immediately without intro', () => {
            const instance = createMockInstance('project');
            Constructor.prototype.initReveal.call(instance);

            expect(instance.setProgress).toHaveBeenCalledWith(0);
            expect(instance.hideOverlay).toHaveBeenCalledWith(true);
            expect(instance.showOverlay).not.toHaveBeenCalled();
            expect(instance.prepareDestinationTexture).not.toHaveBeenCalled();
        });

        test('non-project pages with transition param should show overlay and start intro', () => {
            const instance = createMockInstance('home');
            Constructor.prototype.initReveal.call(instance);

            expect(instance.setProgress).toHaveBeenCalledWith(1);
            expect(instance.showOverlay).toHaveBeenCalledWith(true);
        });

        test('project page with null pageType should still play intro', () => {
            const instance = createMockInstance(null);
            Constructor.prototype.initReveal.call(instance);

            expect(instance.showOverlay).toHaveBeenCalledWith(true);
            expect(instance.hideOverlay).not.toHaveBeenCalled();
        });
    });

    describe('#cont layout containment', () => {
        const cssPath = path.resolve(__dirname, '../../css/main_style.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        test('#cont must have contain: layout to prevent external style recalc from shifting its children', () => {
            const contBlockMatch = cssContent.match(
                /#cont\s*\{[^}]*contain\s*:\s*[^;]*layout[^;]*;/
            );
            expect(contBlockMatch).not.toBeNull();
        });
    });

    describe('overlay must not modify document.documentElement.classList', () => {
        let Constructor;

        beforeEach(() => {
            Constructor = context.window.__PageTransitionForTesting._Constructor;
        });

        test('showOverlay (non-immediate) must not add class to documentElement', () => {
            const addSpy = context.document.documentElement.classList.add;
            addSpy.mockClear();
            const instance = {
                enabled: true,
                visible: false,
                container: { style: {}, offsetHeight: 0 },
                startRender: jest.fn(),
            };
            Constructor.prototype.showOverlay.call(instance, false);

            expect(addSpy).not.toHaveBeenCalledWith('page-transition--active');
        });

        test('showOverlay (immediate) must not add class to documentElement', () => {
            const addSpy = context.document.documentElement.classList.add;
            addSpy.mockClear();
            const instance = {
                enabled: true,
                visible: false,
                container: { style: {}, offsetHeight: 0 },
                startRender: jest.fn(),
            };
            Constructor.prototype.showOverlay.call(instance, true);

            expect(addSpy).not.toHaveBeenCalledWith('page-transition--active');
        });

        test('hideOverlay must not remove class from documentElement', () => {
            const removeSpy = context.document.documentElement.classList.remove;
            removeSpy.mockClear();
            const instance = {
                visible: true,
                container: { style: {}, offsetHeight: 0 },
                hideTimeout: null,
            };
            context.window.setTimeout = jest.fn();
            context.window.clearTimeout = jest.fn();
            Constructor.prototype.hideOverlay.call(instance, false);

            expect(removeSpy).not.toHaveBeenCalledWith('page-transition--active');
        });
    });

    describe('navigate - no layout shift on page content', () => {
        let Constructor;

        beforeEach(() => {
            Constructor = context.window.__PageTransitionForTesting._Constructor;
            context.window.URL = URL;
            context.window.location = {
                href: 'https://example.com/',
                origin: 'https://example.com',
                assign: jest.fn(),
            };
            context.window.console = { error: jest.fn(), warn: jest.fn() };
        });

        function createNavigateInstance(capturedDataUrl) {
            return {
                enabled: true,
                isAnimating: false,
                duration: 750,
                capturedDataUrl: capturedDataUrl || null,
                uniforms: { uProgress: { value: 0 } },
                buildTransitionUrl: jest.fn((u) => u),
                showOverlay: jest.fn(),
                dimContent: jest.fn(),
                setProgress: jest.fn(),
                captureAndStoreCurrentScene: jest.fn(() => Promise.resolve()),
                animateProgress: jest.fn(),
            };
        }

        test('navigate stores pre-captured data URL then navigates immediately', () => {
            context.window.sessionStorage.setItem.mockClear();
            const instance = createNavigateInstance('data:image/png;base64,precaptured');
            Constructor.prototype.navigate.call(instance, 'https://example.com/p1');

            expect(context.window.sessionStorage.setItem).toHaveBeenCalledWith(
                'page-transition:capture',
                'data:image/png;base64,precaptured'
            );
            expect(context.window.location.assign).toHaveBeenCalled();
        });

        test('navigate works without pre-captured data', () => {
            context.window.sessionStorage.setItem.mockClear();
            const instance = createNavigateInstance(null);
            const result = Constructor.prototype.navigate.call(instance, 'https://example.com/p1');

            expect(result).toBe(true);
            expect(context.window.sessionStorage.setItem).not.toHaveBeenCalled();
            expect(context.window.location.assign).toHaveBeenCalled();
        });

        test('navigate must not touch DOM — no overlay, no animation, no dimming', () => {
            const instance = createNavigateInstance();
            Constructor.prototype.navigate.call(instance, 'https://example.com/p1');

            expect(instance.showOverlay).not.toHaveBeenCalled();
            expect(instance.animateProgress).not.toHaveBeenCalled();
            expect(instance.setProgress).not.toHaveBeenCalled();
            expect(instance.dimContent).not.toHaveBeenCalled();
            expect(instance.captureAndStoreCurrentScene).not.toHaveBeenCalled();
        });
    });

    describe('navigate - no outgoing animation on source page', () => {
        test('navigate source code must not contain showOverlay or animateProgress calls', () => {
            const jsSource = fs.readFileSync(
                path.resolve(__dirname, '../../js/page-transition.js'),
                'utf8'
            );
            const navigateBlock = jsSource.match(
                /PageTransition\.prototype\.navigate\s*=\s*function[\s\S]*?return true;\s*\}/
            );
            expect(navigateBlock).not.toBeNull();
            expect(navigateBlock[0]).not.toMatch(/showOverlay/);
            expect(navigateBlock[0]).not.toMatch(/animateProgress/);
            expect(navigateBlock[0]).toMatch(/location\.assign/);
        });
    });

    describe('consumeCaptureData', () => {
        test('should return data and remove item from sessionStorage if data exists', () => {
            context.window.sessionStorage.getItem.mockReturnValue('data:image/png;base64,1234');
            context.window.sessionStorage.removeItem.mockClear();

            const result = consumeCaptureData();

            expect(result).toBe('data:image/png;base64,1234');
            expect(context.window.sessionStorage.getItem).toHaveBeenCalledWith(
                'page-transition:capture'
            );
            expect(context.window.sessionStorage.removeItem).toHaveBeenCalledWith(
                'page-transition:capture'
            );
        });

        test('should return null and not call removeItem if no data exists', () => {
            context.window.sessionStorage.getItem.mockReturnValue(null);
            context.window.sessionStorage.removeItem.mockClear();

            const result = consumeCaptureData();

            expect(result).toBeNull();
            expect(context.window.sessionStorage.getItem).toHaveBeenCalledWith(
                'page-transition:capture'
            );
            expect(context.window.sessionStorage.removeItem).not.toHaveBeenCalled();
        });

        test('should catch and log error if sessionStorage throws, and return null', () => {
            const error = new Error('SecurityError');
            context.window.sessionStorage.getItem.mockImplementation(() => {
                throw error;
            });
            context.window.console = { warn: jest.fn() };

            const result = consumeCaptureData();

            expect(result).toBeNull();
            expect(context.window.console.warn).toHaveBeenCalledWith(
                '[page-transition] sessionStorage access error:',
                error
            );
        });

        test('should not throw if window or console is missing during error, and return null', () => {
            const error = new Error('SecurityError');
            context.window.sessionStorage.getItem.mockImplementation(() => {
                throw error;
            });

            const prevConsole = context.window.console;
            context.window.console = undefined;

            let result;
            expect(() => {
                result = consumeCaptureData();
            }).not.toThrow();
            expect(result).toBeNull();

            context.window.console = prevConsole;
        });
    });
});
