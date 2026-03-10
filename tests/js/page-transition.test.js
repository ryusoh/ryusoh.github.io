const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Tests for hexToRgbArray in PageTransition
 */

const sourcePath = path.resolve(__dirname, '../../js/page-transition.js');
let code = fs.readFileSync(sourcePath, 'utf8');
// Remove ES module import so we can evaluate this as a standard script in VM
code = code.replace(/import\s+\*\s+as\s+THREE\s+from\s+['"][^'"]+['"];?/g, '');

describe('hexToRgbArray', () => {
    let hexToRgbArray;

    beforeEach(() => {
        // Prepare context for VM
        const mockDocument = {
            documentElement: {
                clientWidth: 1024,
                clientHeight: 768,
                classList: {
                    add: jest.fn(),
                    remove: jest.fn()
                }
            },
            body: {
                appendChild: jest.fn(),
                getAttribute: jest.fn()
            },
            createElement: jest.fn().mockImplementation((tag) => {
                if (tag === 'style') {
                    return {};
                }
                if (tag === 'div') {
                    return {
                        appendChild: jest.fn(),
                        style: {}
                    };
                }
                if (tag === 'canvas') {
                    return {
                        getContext: jest.fn().mockReturnValue({
                            createLinearGradient: jest.fn().mockReturnValue({
                                addColorStop: jest.fn()
                            }),
                            fillRect: jest.fn()
                        })
                    };
                }
                return {};
            }),
            head: {
                appendChild: jest.fn()
            },
            getElementById: jest.fn().mockReturnValue(null),
            readyState: 'complete',
            querySelectorAll: jest.fn().mockReturnValue([])
        };

        const mockWindow = {
            devicePixelRatio: 1,
            innerWidth: 1024,
            innerHeight: 768,
            getComputedStyle: jest.fn().mockReturnValue({
                getPropertyValue: jest.fn().mockReturnValue(null)
            }),
            addEventListener: jest.fn(),
            matchMedia: jest.fn().mockReturnValue({ matches: false }),
            URL: class {
                constructor(url) {
                    this.href = url;
                    this.searchParams = new Map();
                }
            },
            location: { href: 'http://localhost' },
            sessionStorage: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn()
            }
        };

        // Create a module object to capture exports
        const mockModule = {
            exports: {}
        };

        const context = {
            document: mockDocument,
            window: mockWindow,
            module: mockModule,
            exports: mockModule.exports,
            console: console,
            setTimeout: jest.fn(),
            clearTimeout: jest.fn(),
            requestAnimationFrame: jest.fn(),
            cancelAnimationFrame: jest.fn(),
            Math: Math,
            Number: Number,
            parseInt: parseInt,
            parseFloat: parseFloat,
            Promise: Promise,
            Array: Array
        };

        // Handle circular reference correctly
        context.window.document = mockDocument;

        // Provide a mock THREE object
        context.THREE = {
            WebGLRenderer: jest.fn(),
            Scene: jest.fn(),
            OrthographicCamera: jest.fn(),
            ShaderMaterial: jest.fn(),
            Mesh: jest.fn(),
            PlaneGeometry: jest.fn(),
            Clock: jest.fn(),
            Vector2: jest.fn(),
            Vector3: jest.fn(),
            CanvasTexture: jest.fn()
        };
        context.window.THREE = context.THREE;

        vm.createContext(context);

        // Run the code
        vm.runInContext(code, context);

        // Retrieve the function
        hexToRgbArray = context.module.exports.hexToRgbArray;
    });

    test('should correctly parse 3-character hex without #', () => {
        expect(hexToRgbArray('FFF')).toEqual([1, 1, 1]);
        expect(hexToRgbArray('000')).toEqual([0, 0, 0]);
        // 'abc' -> [170/255, 187/255, 204/255] -> roughly [0.66, 0.73, 0.8]
        expect(hexToRgbArray('abc')).toEqual([170/255, 187/255, 204/255]);
    });

    test('should correctly parse 3-character hex with #', () => {
        expect(hexToRgbArray('#FFF')).toEqual([1, 1, 1]);
        expect(hexToRgbArray('#000')).toEqual([0, 0, 0]);
        expect(hexToRgbArray('#abc')).toEqual([170/255, 187/255, 204/255]);
    });

    test('should correctly parse 6-character hex without #', () => {
        expect(hexToRgbArray('FFFFFF')).toEqual([1, 1, 1]);
        expect(hexToRgbArray('000000')).toEqual([0, 0, 0]);
        expect(hexToRgbArray('aabbcc')).toEqual([170/255, 187/255, 204/255]);
    });

    test('should correctly parse 6-character hex with #', () => {
        expect(hexToRgbArray('#FFFFFF')).toEqual([1, 1, 1]);
        expect(hexToRgbArray('#000000')).toEqual([0, 0, 0]);
        expect(hexToRgbArray('#aabbcc')).toEqual([170/255, 187/255, 204/255]);
    });

    test('should handle invalid hex length', () => {
        expect(hexToRgbArray('#FF')).toBeNull();
        expect(hexToRgbArray('F')).toBeNull();
        expect(hexToRgbArray('#FFFF')).toBeNull();
        expect(hexToRgbArray('#FFFFF')).toBeNull();
        expect(hexToRgbArray('1234567')).toBeNull();
    });

    test('should handle non-hex characters gracefully (NaN)', () => {
        const result = hexToRgbArray('#xyz');
        expect(result).not.toBeNull();
        expect(Number.isNaN(result[0])).toBe(true);
        expect(Number.isNaN(result[1])).toBe(true);
        expect(Number.isNaN(result[2])).toBe(true);
    });
});
