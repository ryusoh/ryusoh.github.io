/**
 * @jest-environment jsdom
 */

describe('js/ambient/ambient.js', () => {
    let mockSketch;

    beforeEach(() => {
        jest.resetModules();

        mockSketch = {
            create: jest.fn().mockReturnValue({
                canvas: {
                    className: '',
                    style: {},
                    clientWidth: 800,
                    clientHeight: 600,
                },
                width: 800,
                height: 600,
            }),
        };

        window.Sketch = mockSketch;

        // Mock sessionStorage
        const mockStorage = {
            getItem: jest.fn(),
            removeItem: jest.fn(),
        };
        Object.defineProperty(window, 'sessionStorage', { value: mockStorage, configurable: true });

        document.body.innerHTML = '<body></body>';
        document.body.getAttribute = jest.fn().mockReturnValue('home');

        require('../../../js/ambient/ambient.js');
    });

    describe('getAmbientParam', () => {
        test('returns the value of ambient param', () => {
            const getAmbientParam = window.__AmbientForTesting.getAmbientParam;
            delete window.location;
            window.location = new URL('https://example.com/?ambient=debug');
            expect(getAmbientParam()).toBe('debug');
        });

        test('returns null if search is empty', () => {
            const getAmbientParam = window.__AmbientForTesting.getAmbientParam;
            delete window.location;
            window.location = new URL('https://example.com/');
            expect(getAmbientParam()).toBeNull();
        });
    });

    describe('metrics', () => {
        test('returns default metrics using window dimensions', () => {
            const metrics = window.__AmbientForTesting.metrics;
            const m = metrics();
            expect(m.cw).toBeDefined();
            expect(m.width).toBeDefined();
        });
    });

    describe('getConfig', () => {
        test('returns default configuration', () => {
            const getConfig = window.__AmbientForTesting.getConfig;
            const config = getConfig(null, false);
            expect(config.enabled).toBe(true);
            expect(config.minWidth).toBe(1024);
        });

        test('merges with window.AMBIENT_CONFIG', () => {
            window.AMBIENT_CONFIG = { minWidth: 800 };
            const getConfig = window.__AmbientForTesting.getConfig;
            const config = getConfig(null, false);
            expect(config.minWidth).toBe(800);
        });
    });

    test('initializes Sketch if conditions are met', () => {
        expect(mockSketch.create).toHaveBeenCalled();
        expect(window.AmbientTransitionController).toBeDefined();
    });
});
