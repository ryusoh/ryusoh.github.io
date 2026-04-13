/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

describe('DOM XSS Security Tests', () => {
    let getValidatedUrl;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetModules();

        // Reset the DOM
        document.documentElement.innerHTML = '<html><head></head><body></body></html>';

        // Mock window.location
        delete window.location;
        window.location = new URL('http://localhost/');
        window.location.assign = jest.fn();

        // Mock console
        window.console = {
            error: jest.fn(),
            warn: jest.fn(),
            log: jest.fn(),
        };

        // Load the source file
        require('../../js/page-transition.js');
        getValidatedUrl = window.__PageTransitionForTesting.getValidatedUrl;
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        jest.clearAllTimers();
    });

    test('getValidatedUrl should block malicious URL schemes', () => {
        expect(getValidatedUrl('javascript:alert(1)')).toBeNull();
        expect(window.console.error).toHaveBeenCalledWith(
            expect.stringContaining('Blocked potentially malicious URL scheme')
        );

        expect(getValidatedUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(getValidatedUrl('vbscript:msgbox(1)')).toBeNull();
    });

    test('getValidatedUrl should allow valid same-origin URLs', () => {
        const result = getValidatedUrl('/about.html');
        expect(result).toBe('/about.html');
    });

    test('getValidatedUrl should block cross-origin URLs', () => {
        expect(getValidatedUrl('http://example.com/login.html')).toBeNull();
        expect(window.console.error).toHaveBeenCalledWith(
            expect.stringContaining('Blocked cross-origin navigation')
        );

        expect(getValidatedUrl('https://malicious-site.com/exploit')).toBeNull();
    });

    test('getValidatedUrl should block javascript: URLs even with leading whitespace or different case', () => {
        expect(getValidatedUrl('  JAVASCRIPT:alert(1)')).toBeNull();
        expect(window.console.error).toHaveBeenCalledWith(
            expect.stringContaining('Blocked potentially malicious URL scheme')
        );
    });

    test('getValidatedUrl should block javascript: URLs even with leading control characters', () => {
        expect(getValidatedUrl('\x01\x02\x09\x1fjavascript:alert(1)')).toBeNull();
        expect(window.console.error).toHaveBeenCalledWith(
            expect.stringContaining('Blocked potentially malicious URL scheme')
        );
    });

    test('PageTransition should not inject inline style elements (CSP compliance)', () => {
        // Since we are using JSDOM and required the file in beforeEach,
        // we can just check the current document.
        const styles = document.getElementsByTagName('style');
        expect(styles.length).toBe(0);
    });
});

// --- CSP Compliance: Page transition styles in external CSS ---

describe('CSP Compliance: page transition styles in external CSS', () => {
    const requiredSelectors = ['.page-transition-overlay'];

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

function findTags(html, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*>`, 'gi');
    return html.match(regex) || [];
}

function getAttribute(tag, attrName) {
    const regex = new RegExp(`${attrName}=["']([^"']*)["']`, 'i');
    const match = tag.match(regex);
    return match ? match[1] : null;
}

describe('Security: target="_blank" links', () => {
    const rootDir = path.resolve(__dirname, '../../');

    function getHtmlFiles(dir, fileList = []) {
        const files = fs.readdirSync(dir);

        files.forEach((file) => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
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
