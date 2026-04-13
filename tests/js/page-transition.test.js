const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../js/page-transition.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');

// The new page-transition.js is a plain IIFE — no ES module imports to strip.
const codeToEvaluate = sourceCode;

describe('page-transition.js', () => {
    let context;
    let hasTransitionParam;
    let clampUnit;
    let updateHistoryUrl;
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
                offsetHeight: 0,
                querySelector: jest.fn().mockReturnValue(null),
            },
            querySelectorAll: jest.fn().mockReturnValue([]),
            querySelector: jest.fn().mockReturnValue(null),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockReturnValue({
                appendChild: jest.fn(),
                style: {},
                className: '',
                setAttribute: jest.fn(),
                offsetHeight: 0,
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
            Math: Math,
        };

        vm.createContext(context);

        // Run the code. The source exposes internals on window.__PageTransitionForTesting
        vm.runInContext(codeToEvaluate, context);
        hasTransitionParam = context.window.__PageTransitionForTesting.hasTransitionParam;
        clampUnit = context.window.__PageTransitionForTesting.clampUnit;
        updateHistoryUrl = context.window.__PageTransitionForTesting.updateHistoryUrl;
        getValidatedUrl = context.window.__PageTransitionForTesting.getValidatedUrl;
    });

    describe('getValidatedUrl', () => {
        beforeEach(() => {
            context.window.URL = URL;
            context.window.console = {
                error: jest.fn(),
                warn: jest.fn(),
            };
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
            expect(context.window.console.error).toHaveBeenCalledWith(
                '[page-transition] Blocked invalid URL',
                expect.anything()
            );
        });
    });

    describe('hasTransitionParam', () => {
        test('should return false when window.URL constructor throws an error', () => {
            context.window.URL = jest.fn().mockImplementation(() => {
                throw new Error('Invalid URL');
            });

            const result = hasTransitionParam();

            expect(result).toBe(false);
            expect(context.window.URL).toHaveBeenCalledWith('http://localhost/');
        });

        test('should return false when window is undefined', () => {
            const prevWindow = context.window;
            context.window = undefined;
            const result = hasTransitionParam();
            expect(result).toBe(false);
            context.window = prevWindow;
        });

        test('should return false when window.location is undefined', () => {
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

    describe('navigate - source code invariants', () => {
        test('page-transition.js must use location.assign for navigation', () => {
            const jsSource = fs.readFileSync(
                path.resolve(__dirname, '../../js/page-transition.js'),
                'utf8'
            );
            expect(jsSource).toMatch(/location\.assign/);
        });

        test('page-transition.js must not reference html2canvas', () => {
            const jsSource = fs.readFileSync(
                path.resolve(__dirname, '../../js/page-transition.js'),
                'utf8'
            );
            expect(jsSource).not.toMatch(/html2canvas/);
        });

        test('page-transition.js must not reference THREE or WebGL', () => {
            const jsSource = fs.readFileSync(
                path.resolve(__dirname, '../../js/page-transition.js'),
                'utf8'
            );
            expect(jsSource).not.toMatch(/\bTHREE\b/);
            expect(jsSource).not.toMatch(/WebGLRenderer/);
            expect(jsSource).not.toMatch(/ShaderMaterial/);
        });

        test('page-transition.js must not use sessionStorage for page capture', () => {
            const jsSource = fs.readFileSync(
                path.resolve(__dirname, '../../js/page-transition.js'),
                'utf8'
            );
            // The old system stored html2canvas screenshots in sessionStorage.
            // Cursor position storage is allowed (bridges cursor.js).
            expect(jsSource).not.toMatch(/captureData/);
            expect(jsSource).not.toMatch(/html2canvas/);
        });
    });
});
