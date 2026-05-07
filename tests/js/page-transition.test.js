/**
 * @jest-environment jsdom
 */
const path = require('path');
const fs = require('fs');

describe('page-transition.js', () => {
    let hasTransitionParam;
    let clampUnit;
    let updateHistoryUrl;
    let getValidatedUrl;
    let isStandardMouseEvent;
    let shouldSkipNavBack;
    let isEligibleAnchor;

    beforeEach(() => {
        // Clear modules and re-require the source for each test to ensure fresh state
        jest.resetModules();

        // Reset the DOM
        document.documentElement.innerHTML = '<html><body></body></html>';

        // Mock window.location
        delete window.location;
        window.location = new URL('https://example.com/');
        window.location.assign = jest.fn();

        // Mock history.replaceState
        window.history.replaceState = jest.fn();

        // Mock console
        window.console = {
            error: jest.fn(),
            warn: jest.fn(),
            log: jest.fn(),
        };

        // Load the source file
        require('../../js/page-transition.js');

        const testing = window.__PageTransitionForTesting;
        hasTransitionParam = testing.hasTransitionParam;
        clampUnit = testing.clampUnit;
        updateHistoryUrl = testing.updateHistoryUrl;
        getValidatedUrl = testing.getValidatedUrl;
        isStandardMouseEvent = testing.isStandardMouseEvent;
        shouldSkipNavBack = testing.shouldSkipNavBack;
        isEligibleAnchor = testing.isEligibleAnchor;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('isStandardMouseEvent', () => {
        test('returns true for a standard left click with no modifiers', () => {
            const event = {
                button: 0,
                metaKey: false,
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
            };
            expect(isStandardMouseEvent(event)).toBe(true);
        });

        test('returns false for non-primary mouse buttons', () => {
            expect(
                isStandardMouseEvent({
                    button: 1,
                    metaKey: false,
                    ctrlKey: false,
                    shiftKey: false,
                    altKey: false,
                })
            ).toBe(false); // Middle click
            expect(
                isStandardMouseEvent({
                    button: 2,
                    metaKey: false,
                    ctrlKey: false,
                    shiftKey: false,
                    altKey: false,
                })
            ).toBe(false); // Right click
        });

        test('returns false when modifier keys are pressed', () => {
            expect(
                isStandardMouseEvent({
                    button: 0,
                    metaKey: true,
                    ctrlKey: false,
                    shiftKey: false,
                    altKey: false,
                })
            ).toBe(false); // Cmd/Win key
            expect(
                isStandardMouseEvent({
                    button: 0,
                    metaKey: false,
                    ctrlKey: true,
                    shiftKey: false,
                    altKey: false,
                })
            ).toBe(false); // Ctrl key
            expect(
                isStandardMouseEvent({
                    button: 0,
                    metaKey: false,
                    ctrlKey: false,
                    shiftKey: true,
                    altKey: false,
                })
            ).toBe(false); // Shift key
            expect(
                isStandardMouseEvent({
                    button: 0,
                    metaKey: false,
                    ctrlKey: false,
                    shiftKey: false,
                    altKey: true,
                })
            ).toBe(false); // Alt key
            expect(
                isStandardMouseEvent({
                    button: 0,
                    metaKey: true,
                    ctrlKey: true,
                    shiftKey: true,
                    altKey: true,
                })
            ).toBe(false); // All modifiers
        });
    });

    describe('shouldSkipNavBack', () => {
        test('returns false for null or undefined elements', () => {
            expect(shouldSkipNavBack(null)).toBe(false);
            expect(shouldSkipNavBack(undefined)).toBe(false);
        });

        test('returns false for elements without a classList', () => {
            expect(shouldSkipNavBack({})).toBe(false); // Plain object
            expect(shouldSkipNavBack({ className: 'nav-back' })).toBe(false); // No classList property
        });

        test('returns false for elements without the nav-back class', () => {
            const el = document.createElement('a');
            el.className = 'some-other-class';
            expect(shouldSkipNavBack(el)).toBe(false);

            const el2 = document.createElement('div');
            expect(shouldSkipNavBack(el2)).toBe(false); // No classes at all
        });

        test('returns true for elements with the nav-back class', () => {
            const el = document.createElement('a');
            el.className = 'nav-back';
            expect(shouldSkipNavBack(el)).toBe(true);

            const el2 = document.createElement('a');
            el2.className = 'some-other-class nav-back another-class';
            expect(shouldSkipNavBack(el2)).toBe(true);
        });
    });

    describe('isEligibleAnchor', () => {
        test('returns false for anchors with target="_blank" or other targets', () => {
            const anchor = document.createElement('a');
            anchor.href = 'https://example.com/page';
            anchor.setAttribute('target', '_blank');
            expect(isEligibleAnchor(anchor)).toBe(false);

            anchor.setAttribute('target', '_parent');
            expect(isEligibleAnchor(anchor)).toBe(false);
        });

        test('returns true for anchors with target="_self"', () => {
            const anchor = document.createElement('a');
            anchor.href = 'https://example.com/page';
            anchor.setAttribute('target', '_self');
            expect(isEligibleAnchor(anchor)).toBe(true);
        });

        test('returns false for anchors with a download attribute', () => {
            const anchor = document.createElement('a');
            anchor.href = 'https://example.com/file.pdf';
            anchor.setAttribute('download', '');
            expect(isEligibleAnchor(anchor)).toBe(false);
        });

        test('returns false for anchors with empty or hash-only hrefs', () => {
            const anchor = document.createElement('a');

            // Empty href
            expect(isEligibleAnchor(anchor)).toBe(false);

            // Hash only
            anchor.setAttribute('href', '#');
            expect(isEligibleAnchor(anchor)).toBe(false);

            // Hash section
            anchor.setAttribute('href', '#section');
            expect(isEligibleAnchor(anchor)).toBe(false);
        });

        test('returns false if the anchor url matches current window location', () => {
            const anchor = document.createElement('a');
            anchor.href = window.location.href;
            expect(isEligibleAnchor(anchor)).toBe(false);
        });

        test('returns true for valid, eligible anchors', () => {
            const anchor = document.createElement('a');
            anchor.href = 'https://example.com/other-page';
            expect(isEligibleAnchor(anchor)).toBe(true);
        });
    });

    describe('getValidatedUrl', () => {
        test('returns null for non-string input', () => {
            expect(getValidatedUrl(null)).toBeNull();
            expect(getValidatedUrl(undefined)).toBeNull();
            expect(getValidatedUrl(123)).toBeNull();
        });

        test('validates and returns clean same-origin URL', () => {
            expect(getValidatedUrl('/page')).toBe('/page');
            expect(getValidatedUrl('https://example.com/page')).toBe('https://example.com/page');
        });

        test('strips leading whitespace and control characters', () => {
            expect(getValidatedUrl('  /page')).toBe('/page');
            expect(getValidatedUrl('\n/page')).toBe('/page');
        });

        test('blocks non-http/https protocols', () => {
            expect(getValidatedUrl('javascript:alert(1)')).toBeNull();
            expect(getValidatedUrl('data:text/html,foo')).toBeNull();
            expect(window.console.error).toHaveBeenCalledWith(
                expect.stringContaining('Blocked potentially malicious URL scheme')
            );
        });

        test('blocks cross-origin navigation', () => {
            expect(getValidatedUrl('https://malicious.com')).toBeNull();
            expect(window.console.error).toHaveBeenCalledWith(
                expect.stringContaining('Blocked cross-origin navigation')
            );
        });

        test('returns null when URL parsing throws', () => {
            // Force URL to throw by making window.URL invalid
            const originalURL = window.URL;
            window.URL = jest.fn().mockImplementation(() => {
                throw new Error('Invalid URL');
            });
            expect(getValidatedUrl('/page')).toBeNull();
            expect(window.console.error).toHaveBeenCalledWith(
                '[page-transition] Blocked invalid URL',
                expect.anything()
            );
            window.URL = originalURL;
        });
    });

    describe('hasTransitionParam', () => {
        test('should return false when window.URL constructor throws an error', () => {
            const originalURL = window.URL;
            window.URL = jest.fn().mockImplementation(() => {
                throw new Error('Invalid URL');
            });
            expect(hasTransitionParam()).toBe(false);
            expect(window.console.warn).toHaveBeenCalled();
            window.URL = originalURL;
        });

        test('should return false when window.location is undefined', () => {
            const prevLocation = window.location;
            delete window.location;
            expect(hasTransitionParam()).toBe(false);
            window.location = prevLocation;
        });

        test('should not throw if console missing in catch block', () => {
            const originalURL = window.URL;
            window.URL = jest.fn().mockImplementation(() => {
                throw new Error('err');
            });
            const prevConsole = window.console;
            delete window.console;
            expect(() => hasTransitionParam()).not.toThrow();
            window.console = prevConsole;
            window.URL = originalURL;
        });

        test('should console.warn if parsing fails', () => {
            const originalURL = window.URL;
            window.URL = jest.fn().mockImplementation(() => {
                throw new Error('err');
            });
            hasTransitionParam();
            expect(window.console.warn).toHaveBeenCalled();
            window.URL = originalURL;
        });

        test('should return true when transition param is present', () => {
            window.location = new URL('https://example.com/?__pt=1');
            expect(hasTransitionParam()).toBe(true);
        });
    });

    describe('clearTransitionParam', () => {
        test('should catch error and gracefully fallback missing console', () => {
            const originalURL = window.URL;
            window.URL = jest.fn().mockImplementation(() => {
                throw new Error('err');
            });
            const prevConsole = window.console;
            delete window.console;
            expect(() => window.__PageTransitionForTesting.clearTransitionParam()).not.toThrow();
            window.console = prevConsole;
            window.URL = originalURL;
        });

        test('should catch error and gracefully fallback console.warn', () => {
            const originalURL = window.URL;
            window.URL = jest.fn().mockImplementation(() => {
                throw new Error('err');
            });
            window.__PageTransitionForTesting.clearTransitionParam();
            expect(window.console.warn).toHaveBeenCalled();
            window.URL = originalURL;
        });
    });

    describe('clampUnit', () => {
        test('should return the value if it is between 0 and 1', () => {
            expect(clampUnit(0.5)).toBe(0.5);
        });

        test('should clamp values less than 0 to 0', () => {
            expect(clampUnit(-0.1)).toBe(0);
        });

        test('should clamp values greater than 1 to 1', () => {
            expect(clampUnit(1.1)).toBe(1);
        });

        test('should return exactly 0 for 0 and 1 for 1', () => {
            expect(clampUnit(0)).toBe(0);
            expect(clampUnit(1)).toBe(1);
        });
    });

    describe('updateHistoryUrl', () => {
        test('should replace history state with new url components', () => {
            const mockUrl = {
                pathname: '/new-path',
                search: '?foo=bar',
                hash: '#section',
            };
            updateHistoryUrl(mockUrl);
            expect(window.history.replaceState).toHaveBeenCalledWith(
                {},
                '',
                '/new-path?foo=bar#section'
            );
        });

        test('should not throw if window.history is undefined', () => {
            const prevHistory = window.history;
            delete window.history;
            expect(() => updateHistoryUrl({})).not.toThrow();
            window.history = prevHistory;
        });

        test('should not throw if replaceState is not a function', () => {
            const prevReplaceState = window.history.replaceState;
            window.history.replaceState = 'not a function';
            expect(() => updateHistoryUrl({})).not.toThrow();
            window.history.replaceState = prevReplaceState;
        });
    });

    describe('#cont layout containment', () => {
        const cssPath = path.resolve(__dirname, '../../css/main_style.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        test('#cont must have contain: layout to prevent external style recalc from shifting its children', () => {
            expect(cssContent).toMatch(/#cont\s*\{[^}]*contain:\s*layout/);
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
    });

    describe('storeCursorPositionForTransition', () => {
        test('stores position in sessionStorage', () => {
            const setItemMock = jest.fn();
            const originalSessionStorage = window.sessionStorage;
            Object.defineProperty(window, 'sessionStorage', {
                value: { setItem: setItemMock },
                writable: true,
                configurable: true,
            });

            window.__PageTransitionForTesting.storeCursorPositionForTransition(100.5, 200.1);
            expect(setItemMock).toHaveBeenCalledWith('customCursorPosition', '{"x":101,"y":200}');

            window.sessionStorage = originalSessionStorage;
        });

        test('gracefully handles unavailable sessionStorage', () => {
            const originalSessionStorage = window.sessionStorage;
            Object.defineProperty(window, 'sessionStorage', {
                value: undefined,
                writable: true,
                configurable: true,
            });

            expect(() => {
                window.__PageTransitionForTesting.storeCursorPositionForTransition(10, 10);
            }).not.toThrow();

            window.sessionStorage = originalSessionStorage;
        });

        test('gracefully handles sessionStorage errors', () => {
            const setItemMock = jest.fn().mockImplementation(() => {
                throw new Error('Quota exceeded');
            });
            const originalSessionStorage = window.sessionStorage;
            Object.defineProperty(window, 'sessionStorage', {
                value: { setItem: setItemMock },
                writable: true,
                configurable: true,
            });

            window.__PageTransitionForTesting.storeCursorPositionForTransition(10, 10);
            expect(window.console.warn).toHaveBeenCalledWith(
                '[page-transition] cursor position store failed:',
                expect.any(Error)
            );

            window.sessionStorage = originalSessionStorage;
        });
    });

    describe('exitPage', () => {
        test('adds page-transition--exiting class and calls flushStoredPosition', () => {
            document.documentElement.classList.remove('page-transition--exiting');
            const flushMock = jest.fn();
            window.cursorInstances = {
                cursor: { flushStoredPosition: flushMock },
            };

            const doneMock = jest.fn();
            jest.useFakeTimers();

            window.__PageTransitionForTesting.exitPage(doneMock);

            expect(flushMock).toHaveBeenCalled();
            expect(document.documentElement.classList.contains('page-transition--exiting')).toBe(
                true
            );

            jest.advanceTimersByTime(80);
            expect(doneMock).toHaveBeenCalled();

            jest.useRealTimers();
            delete window.cursorInstances;
        });
    });

    describe('applyStaggeredEntrance', () => {
        test('applies styles and transitions to matched elements', () => {
            document.body.innerHTML =
                '<div class="intro-header"></div><div class="post-content"></div>';

            window.__PageTransitionForTesting.applyStaggeredEntrance();

            const header = document.querySelector('.intro-header');
            const content = document.querySelector('.post-content');

            expect(header.style.opacity).toBe('1');
            expect(header.style.transform).toBe('scale(1) translateY(0)');
            expect(header.style.transition).toContain('opacity 280ms');

            expect(content.style.opacity).toBe('1');
            expect(content.style.transform).toBe('scale(1) translateY(0)');
            expect(content.style.transition).toContain('opacity 280ms');
            expect(content.style.transition).toContain('50ms'); // Stagger delay

            document.body.innerHTML = '';
        });
    });
});
