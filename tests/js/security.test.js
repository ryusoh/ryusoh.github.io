const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- DOM XSS Security Tests ---

const sourcePath = path.resolve(__dirname, '../../js/page-transition.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');

// The source is a plain IIFE with no ES module imports, so it runs directly in vm.
const codeToEvaluate = sourceCode;

describe('DOM XSS Security Tests', () => {
    let context;

    beforeEach(() => {
        jest.useFakeTimers();
        // Mock the minimal DOM environment
        const mockDocument = {
            readyState: 'complete',
            documentElement: {
                classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
                clientWidth: 1024,
                clientHeight: 768,
            },
            body: {
                getAttribute: jest.fn(),
                appendChild: jest.fn(),
                removeChild: jest.fn(),
                offsetHeight: 0,
                querySelector: jest.fn().mockReturnValue(null),
            },
            querySelectorAll: jest.fn().mockReturnValue([]),
            querySelector: jest.fn().mockReturnValue(null),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockReturnValue({
                appendChild: jest.fn(),
                style: {},
                setAttribute: jest.fn(),
                className: '',
                offsetHeight: 0,
            }),
            getElementById: jest.fn().mockReturnValue(null),
            head: { appendChild: jest.fn() },
        };

        const mockWindow = {
            console: {
                error: jest.fn(),
                warn: jest.fn(),
                log: jest.fn(),
            },
            location: {
                href: 'http://localhost/',
                origin: 'http://localhost',
                assign: jest.fn(),
            },
            URL: URL, // Use Node's URL
            URLSearchParams: URLSearchParams,
            addEventListener: jest.fn(),
            matchMedia: jest.fn().mockReturnValue({ matches: false }),
            getComputedStyle: jest.fn().mockReturnValue({
                getPropertyValue: jest.fn().mockReturnValue(''),
            }),
            innerWidth: 1024,
            innerHeight: 768,
            devicePixelRatio: 1,
            requestAnimationFrame: jest.fn((cb) => setTimeout(() => cb(Date.now()), 16)),
            cancelAnimationFrame: jest.fn((id) => clearTimeout(id)),
            setTimeout: jest.fn((cb, ms) => setTimeout(cb, ms)),
            clearTimeout: jest.fn((id) => clearTimeout(id)),
        };

        context = {
            window: mockWindow,
            document: mockDocument,
            Promise: Promise,
            setTimeout: mockWindow.setTimeout,
            clearTimeout: mockWindow.clearTimeout,
            requestAnimationFrame: mockWindow.requestAnimationFrame,
            cancelAnimationFrame: mockWindow.cancelAnimationFrame,
        };

        vm.createContext(context);
        vm.runInContext(codeToEvaluate, context);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        jest.clearAllTimers();
    });

    test('getValidatedUrl should block malicious URL schemes', () => {
        const getValidatedUrl = context.window.__PageTransitionForTesting.getValidatedUrl;

        expect(getValidatedUrl('javascript:alert(1)')).toBeNull();
        expect(context.window.console.error).toHaveBeenCalledWith(
            expect.stringContaining('Blocked potentially malicious URL scheme')
        );

        expect(getValidatedUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(getValidatedUrl('vbscript:msgbox(1)')).toBeNull();
    });

    test('getValidatedUrl should allow valid same-origin URLs', () => {
        const getValidatedUrl = context.window.__PageTransitionForTesting.getValidatedUrl;

        const result = getValidatedUrl('/about.html');
        expect(result).toBe('/about.html');
    });

    test('getValidatedUrl should block cross-origin URLs', () => {
        const getValidatedUrl = context.window.__PageTransitionForTesting.getValidatedUrl;

        expect(getValidatedUrl('http://example.com/login.html')).toBeNull();
        expect(context.window.console.error).toHaveBeenCalledWith(
            expect.stringContaining('Blocked cross-origin navigation')
        );

        expect(getValidatedUrl('https://malicious-site.com/exploit')).toBeNull();
    });

    test('getValidatedUrl should block javascript: URLs even with leading whitespace or different case', () => {
        const getValidatedUrl = context.window.__PageTransitionForTesting.getValidatedUrl;

        expect(getValidatedUrl('  JAVASCRIPT:alert(1)')).toBeNull();
        expect(context.window.console.error).toHaveBeenCalledWith(
            expect.stringContaining('Blocked potentially malicious URL scheme')
        );
    });

    test('getValidatedUrl should block javascript: URLs even with leading control characters', () => {
        const getValidatedUrl = context.window.__PageTransitionForTesting.getValidatedUrl;

        expect(getValidatedUrl('\x01\x02\x09\x1fjavascript:alert(1)')).toBeNull();
        expect(context.window.console.error).toHaveBeenCalledWith(
            expect.stringContaining('Blocked potentially malicious URL scheme')
        );
    });

    test('PageTransition should not inject inline style elements (CSP compliance)', () => {
        // Verify no <style> element was created and appended to <head>
        const createCalls = context.document.createElement.mock.calls;
        const styleCreations = createCalls.filter((call) => call[0] === 'style');
        expect(styleCreations).toHaveLength(0);

        const headAppendCalls = context.document.head.appendChild.mock.calls;
        expect(headAppendCalls).toHaveLength(0);
    });
});

// --- CSP Compliance: Page transition styles in external CSS ---

describe('CSP Compliance: page transition styles in external CSS', () => {
    const requiredSelectors = [
        '.page-transition-overlay',
    ];

    const cssFiles = [
        path.resolve(__dirname, '../../css/main_style.css'),
        path.resolve(__dirname, '../../css/style.css'),
    ];

    cssFiles.forEach((cssFile) => {
        const fileName = path.basename(cssFile);

        describe(fileName, () => {
            const css = fs.readFileSync(cssFile, 'utf8');

            requiredSelectors.forEach((selector) => {
                test(`should contain "${selector}" rule`, () => {
                    expect(css).toContain(selector);
                });
            });
        });
    });

    test('page-transition.js source should not contain injectStyles or createElement style', () => {
        const jsSource = fs.readFileSync(
            path.resolve(__dirname, '../../js/page-transition.js'),
            'utf8'
        );
        expect(jsSource).not.toMatch(/createElement\s*\(\s*['"]style['"]\s*\)/);
    });
});

// --- Security: target="_blank" links Tests ---

// Simple regex parser as we don't have jsdom installed
// and the environment is node (based on earlier check)
function findTags(html, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*>`, 'gi');
    return html.match(regex) || [];
}

function getAttribute(tag, attrName) {
    // Regex to match attribute safely, handling single or double quotes
    const regex = new RegExp(`${attrName}=["']([^"']*)["']`, 'i');
    const match = tag.match(regex);
    return match ? match[1] : null;
}

describe('Security: target="_blank" links', () => {
    const rootDir = path.resolve(__dirname, '../../');

    // Find all HTML files
    function getHtmlFiles(dir, fileList = []) {
        const files = fs.readdirSync(dir);

        files.forEach((file) => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                // Ignore node_modules, .git, etc
                if (!file.startsWith('.') && file !== 'node_modules') {
                    getHtmlFiles(filePath, fileList);
                }
            } else if (file.endsWith('.html')) {
                fileList.push(filePath);
            }
        });

        return fileList;
    }

    const htmlFiles = getHtmlFiles(rootDir);

    htmlFiles.forEach((file) => {
        it(`should have rel="noopener noreferrer" for all target="_blank" links in ${path.relative(rootDir, file)}`, () => {
            const content = fs.readFileSync(file, 'utf8');
            const links = findTags(content, 'a');

            links.forEach((link) => {
                const target = getAttribute(link, 'target');
                if (target === '_blank') {
                    const rel = getAttribute(link, 'rel');
                    expect(rel).toBeDefined();
                    expect(rel).not.toBeNull();

                    const relParts = rel.split(' ').filter(Boolean);
                    expect(relParts).toContain('noopener');
                    expect(relParts).toContain('noreferrer');
                }
            });
        });
    });
});
