const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- DOM XSS Security Tests ---

const sourcePath = path.resolve(__dirname, '../../js/page-transition.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');

// Strip out the ES module import statement for VM execution
const codeToEvaluate = sourceCode.replace(
    /import\s+\*\s+as\s+THREE\s+from\s+['"][^'"]+['"];/,
    'const THREE = { Vector2: class {}, Vector3: class { set() {} }, Scene: class { add() {} }, OrthographicCamera: class {}, WebGLRenderer: class { setPixelRatio() {}; setSize() {}; setClearColor() {}; render() {} }, Clock: class { start() {}; getDelta() { return 0.016 } }, ShaderMaterial: class {}, Mesh: class {}, PlaneGeometry: class {}, CanvasTexture: class {}, Texture: class { constructor() { this.needsUpdate = false; this.minFilter = 0; this.magFilter = 0; } }, LinearFilter: 0, ClampToEdgeWrapping: 0 };'
);

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
            },
            querySelectorAll: jest.fn().mockReturnValue([]),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockReturnValue({
                appendChild: jest.fn(),
                style: {},
                setAttribute: jest.fn(),
                getContext: jest.fn().mockReturnValue({
                    createLinearGradient: jest.fn().mockReturnValue({
                        addColorStop: jest.fn(),
                    }),
                    fillRect: jest.fn(),
                }),
                toDataURL: jest.fn().mockReturnValue('data:image/png;base64,fake'),
            }),
            getElementById: jest.fn().mockReturnValue(null),
            head: { appendChild: jest.fn() },
        };

        const mockWindow = {
            location: {
                href: 'http://localhost/',
                assign: jest.fn(),
            },
            URL: URL, // Use Node's URL
            URLSearchParams: URLSearchParams,
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
            requestAnimationFrame: jest.fn((cb) => setTimeout(() => cb(Date.now()), 16)),
            cancelAnimationFrame: jest.fn((id) => clearTimeout(id)),
            setTimeout: jest.fn((cb, ms) => setTimeout(cb, ms)),
            clearTimeout: jest.fn((id) => clearTimeout(id)),
            WebGLRenderingContext: true,
            html2canvas: jest.fn().mockResolvedValue({
                toDataURL: jest.fn().mockReturnValue('data:image/png;base64,fake'),
            }),
        };

        context = {
            window: mockWindow,
            document: mockDocument,
            Promise: Promise,
            console: {
                error: jest.fn(),
                log: jest.fn(),
            },
            setTimeout: mockWindow.setTimeout,
            clearTimeout: mockWindow.clearTimeout,
            requestAnimationFrame: mockWindow.requestAnimationFrame,
            cancelAnimationFrame: mockWindow.cancelAnimationFrame,
            Image: class {
                constructor() {
                    setTimeout(() => {
                        if (this.onload) {
                            this.onload();
                        }
                    }, 0);
                }
            },
        };

        vm.createContext(context);
        vm.runInContext(codeToEvaluate, context);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        // Clear all timers
        jest.clearAllTimers();
    });

    test('PageTransition.navigate should block javascript: URLs', () => {
        const PageTransition = context.window.__PageTransitionForTesting._Constructor;
        const pt = new PageTransition();

        pt.navigate('javascript:alert(1)');

        expect(context.window.location.assign).not.toHaveBeenCalled();
        expect(context.console.error).toHaveBeenCalledWith(
            expect.stringContaining('Blocked potentially malicious javascript: URL')
        );
    });

    test('PageTransition.navigate should allow valid same-origin URLs', () => {
        const PageTransition = context.window.__PageTransitionForTesting._Constructor;
        const pt = new PageTransition();

        pt.navigate('/about.html');

        // Should eventually call location.assign (either immediately or after animation)
        // For simplicity, we disable the transition or mock the end of it
        pt.enabled = false;
        pt.navigate('/about.html');
        expect(context.window.location.assign).toHaveBeenCalledWith('/about.html');
    });

    test('PageTransition should block javascript: URLs even with leading whitespace or different case', () => {
        const PageTransition = context.window.__PageTransitionForTesting._Constructor;
        const pt = new PageTransition();

        pt.navigate('  JAVASCRIPT:alert(1)');

        expect(context.window.location.assign).not.toHaveBeenCalled();
        expect(context.console.error).toHaveBeenCalled();
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
