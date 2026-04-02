const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('js/ambient/ambient.js', () => {
    let context;
    let code;
    let mockSketch;

    beforeEach(() => {
        const sourcePath = path.resolve(__dirname, '../../../js/ambient/ambient.js');
        code = fs.readFileSync(sourcePath, 'utf8');

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

        context = {
            window: {
                matchMedia: jest.fn().mockReturnValue({ matches: false }),
                innerWidth: 1200,
                innerHeight: 800,
                location: { search: '' },
                URLSearchParams: require('url').URLSearchParams,
                devicePixelRatio: 1,
                performance: { now: () => 1000 },
                Sketch: mockSketch,
                sessionStorage: {
                    getItem: jest.fn(),
                    removeItem: jest.fn(),
                },
                console: console, // explicitly use console here for `trace && window.console` check
            },
            document: {
                body: {
                    getAttribute: jest.fn().mockReturnValue('home'),
                },
            },
            Math: Math,
            Date: Date,
            console: console,
            Object: Object,
            String: String,
        };

        // Setup circular references
        context.window.document = context.document;
    });

    describe('getAmbientParam', () => {
        let getAmbientParam;

        beforeEach(() => {
            vm.createContext(context);
            vm.runInContext(code, context);
            getAmbientParam = context.window.__AmbientForTesting.getAmbientParam;
        });

        test('returns null if URLSearchParams is missing', () => {
            delete context.window.URLSearchParams;
            expect(getAmbientParam()).toBeNull();
        });

        test('returns the value of ambient param', () => {
            context.window.location.search = '?ambient=debug';
            expect(getAmbientParam()).toBe('debug');
        });

        test('returns null if search is empty', () => {
            context.window.location.search = '';
            expect(getAmbientParam()).toBeNull();
        });

        test('returns null if ambient is not present', () => {
            context.window.location.search = '?other=true';
            expect(getAmbientParam()).toBeNull();
        });
    });

    describe('metrics', () => {
        let metrics;
        let mockSketchInstance;

        beforeEach(() => {
            vm.createContext(context);
            vm.runInContext(code, context);
            metrics = context.window.__AmbientForTesting.metrics;
            // Get the instance created inside the script
            mockSketchInstance = mockSketch.create.mock.results[0].value;
        });

        test('returns default metrics using window dimensions', () => {
            mockSketchInstance.canvas = null; // simulate missing canvas
            const m = metrics();
            expect(m.cw).toBe(1200);
            expect(m.ch).toBe(800);
            expect(m.width).toBe(1200);
            expect(m.height).toBe(800);
            expect(m.ratio).toBe(1);
        });

        test('returns metrics based on canvas dimensions', () => {
            mockSketchInstance.canvas.clientWidth = 500;
            mockSketchInstance.canvas.clientHeight = 400;
            mockSketchInstance.canvas.width = 1000;
            mockSketchInstance.canvas.height = 800;
            context.window.devicePixelRatio = 2;

            const m = metrics();
            expect(m.cw).toBe(500);
            expect(m.ch).toBe(400);
            expect(m.width).toBe(500);
            expect(m.height).toBe(400);
            expect(m.ratio).toBe(2);
        });

        test('handles missing devicePixelRatio gracefully', () => {
            delete context.window.devicePixelRatio;
            const m = metrics();
            expect(m.ratio).toBe(1);
        });
    });

    describe('shouldSkip', () => {
        let shouldSkip;
        let getConfig;

        beforeEach(() => {
            vm.createContext(context);
            vm.runInContext(code, context);
            shouldSkip = context.window.__AmbientForTesting.shouldSkip;
            getConfig = context.window.__AmbientForTesting.getConfig;
        });

        test('returns true if window.Sketch is missing', () => {
            delete context.window.Sketch;
            expect(shouldSkip(getConfig(null, false), false)).toBe(true);
        });

        test('returns false if force is true', () => {
            expect(shouldSkip(getConfig(null, false), true)).toBe(false);
        });

        test('handles window.matchMedia throwing an error and logs warning', () => {
            context.window.matchMedia.mockImplementation(() => {
                throw new Error('matchMedia error');
            });
            context.window.console.warn = jest.fn();

            // Re-eval in fresh context to reset cached media query
            const freshContext = { ...context };
            freshContext.window.matchMedia = jest.fn().mockImplementation(() => {
                throw new Error('matchMedia error');
            });
            freshContext.window.console.warn = jest.fn();
            vm.createContext(freshContext);
            vm.runInContext(code, freshContext);

            const freshShouldSkip = freshContext.window.__AmbientForTesting.shouldSkip;
            const freshGetConfig = freshContext.window.__AmbientForTesting.getConfig;

            const C = freshGetConfig(null, false);
            expect(freshShouldSkip(C, false)).toBe(false); // falls back to false for reduce
            expect(freshContext.window.console.warn).toHaveBeenCalledWith(
                '[ambient] prefersReducedMotion error:',
                expect.anything()
            );
        });

        test('returns true if C.enabled is false', () => {
            const C = getConfig(null, false);
            C.enabled = false;
            expect(shouldSkip(C, false)).toBe(true);
        });

        test('returns true if reduce is true and respectReducedMotion is true', () => {
            const modifiedCode = code.replace(
                /let prefersReducedMotionMediaQuery = null;/g,
                'var prefersReducedMotionMediaQuery = null;'
            );
            const freshContext = {
                ...context,
                window: {
                    ...context.window,
                    matchMedia: jest.fn().mockReturnValue({ matches: true }),
                    location: { search: '?ambient=on' }, // force it to load so __AmbientForTesting is attached
                },
            };
            vm.createContext(freshContext);
            vm.runInContext(modifiedCode, freshContext);

            const freshShouldSkip = freshContext.window.__AmbientForTesting.shouldSkip;
            const freshGetConfig = freshContext.window.__AmbientForTesting.getConfig;

            const C = freshGetConfig(null, false);
            C.respectReducedMotion = true;
            C.minWidth = 0; // Ensure minWidth doesn't cause it to be true independently
            freshContext.window.innerWidth = 1000;
            expect(freshShouldSkip(C, false)).toBe(true);
        });

        test('returns false if reduce is true but respectReducedMotion is false', () => {
            const modifiedCode = code.replace(
                /let prefersReducedMotionMediaQuery = null;/g,
                'var prefersReducedMotionMediaQuery = null;'
            );
            const freshContext = {
                ...context,
                window: {
                    ...context.window,
                    matchMedia: jest.fn().mockReturnValue({ matches: true }),
                    location: { search: '?ambient=on' },
                },
            };
            vm.createContext(freshContext);
            vm.runInContext(modifiedCode, freshContext);

            const freshShouldSkip = freshContext.window.__AmbientForTesting.shouldSkip;
            const freshGetConfig = freshContext.window.__AmbientForTesting.getConfig;

            const C = freshGetConfig(null, false);
            C.respectReducedMotion = false;
            C.minWidth = 0;
            freshContext.window.innerWidth = 1000;
            expect(freshShouldSkip(C, false)).toBe(false);
        });

        test('returns true if not large enough', () => {
            const C = getConfig(null, false);
            context.window.innerWidth = 500;
            expect(shouldSkip(C, false)).toBe(true);
        });
    });

    describe('getConfig', () => {
        let getConfig;

        beforeEach(() => {
            vm.createContext(context);
            vm.runInContext(code, context);
            getConfig = context.window.__AmbientForTesting.getConfig;
        });

        test('returns default configuration', () => {
            const config = getConfig(null, false);
            expect(config.enabled).toBe(true);
            expect(config.minWidth).toBe(1024);
            expect(config.maxParticles).toBe(120);
            expect(config.radius).toEqual({ min: 4.0, max: 8.0 });
        });

        test('merges with window.AMBIENT_CONFIG', () => {
            context.window.AMBIENT_CONFIG = { minWidth: 800, maxParticles: 200 };
            const config = getConfig(null, false);
            expect(config.minWidth).toBe(800);
            expect(config.maxParticles).toBe(200);
        });

        test('applies force overrides when force is debug', () => {
            const config = getConfig('debug', false);
            expect(config.zIndex).toBe(999);
            expect(config.radius).toEqual({ min: 8.0, max: 16.0 });
            expect(config.alpha.max).toBe(0.8);
            expect(config.speed).toBeGreaterThanOrEqual(0.3);
        });

        test('applies trace overrides when trace is true', () => {
            const config = getConfig(null, true);
            expect(config.zIndex).toBe(999);
            expect(config.radius).toEqual({ min: 8.0, max: 16.0 });
        });
    });

    test('initializes Sketch if conditions are met', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockSketch.create).toHaveBeenCalledWith({
            container: context.document.body,
            retina: true,
            interval: 2,
            globals: false,
            autopause: true,
        });

        // Test if the controller is attached
        expect(context.window.AmbientTransitionController).toBeDefined();
        expect(typeof context.window.AmbientTransitionController.playIntro).toBe('function');
        expect(typeof context.window.AmbientTransitionController.playExit).toBe('function');
    });

    test('does not initialize if window.Sketch is missing', () => {
        delete context.window.Sketch;

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.window.AmbientTransitionController).toBeUndefined();
    });

    test('does not initialize if prefers-reduced-motion is true', () => {
        context.window.matchMedia.mockReturnValue({ matches: true });

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockSketch.create).not.toHaveBeenCalled();
    });

    test('does not initialize if innerWidth is below minWidth (1024 by default)', () => {
        context.window.innerWidth = 800;

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockSketch.create).not.toHaveBeenCalled();
    });

    test('initializes despite small width if ?ambient=on is forced', () => {
        context.window.innerWidth = 800;
        context.window.location.search = '?ambient=on';

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockSketch.create).toHaveBeenCalled();
    });

    test('handles ?ambient=debug correctly', () => {
        context.window.location.search = '?ambient=debug';

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockSketch.create).toHaveBeenCalled();
    });

    test('handles ?ambient=trace correctly', () => {
        context.window.location.search = '?ambient=trace';

        vm.createContext(context);
        vm.runInContext(code, context);

        expect(mockSketch.create).toHaveBeenCalled();
        expect(context.window.__ambient).toBeDefined();
        expect(context.window.__ambient.config.zIndex).toBe(999);
    });

    test('AmbientTransitionController.playIntro changes transition state', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const sketchInstance = mockSketch.create.mock.results[0].value;
        sketchInstance.setup = jest.fn();

        context.window.AmbientTransitionController.playIntro();

        expect(sketchInstance.canvas.style.transition).toBe('opacity 0.4s ease');
        expect(sketchInstance.canvas.style.opacity).toBe('1');
    });

    test('AmbientTransitionController.playExit changes transition state', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const sketchInstance = mockSketch.create.mock.results[0].value;
        sketchInstance.setup = jest.fn();

        context.window.AmbientTransitionController.playExit();

        expect(sketchInstance.canvas.style.transition).toBe('opacity 0.4s ease');
        expect(sketchInstance.canvas.style.opacity).toBe('1');
    });

    test('perfNow falls back to Date.now when window.performance is missing', () => {
        delete context.window.performance;
        const mockNow = jest.spyOn(Date, 'now').mockReturnValue(5000);

        vm.createContext(context);
        vm.runInContext(code, context);

        context.window.AmbientTransitionController.playIntro();

        expect(mockNow).toHaveBeenCalled();
        mockNow.mockRestore();
    });

    test('s.setup initializes particles correctly', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const sketchInstance = mockSketch.create.mock.results[0].value;
        sketchInstance.setup();

        // Let's call update to see it runs without errors
        sketchInstance.update();

        // draw should also run without errors
        sketchInstance.save = jest.fn();
        sketchInstance.restore = jest.fn();
        sketchInstance.beginPath = jest.fn();
        sketchInstance.arc = jest.fn();
        sketchInstance.fill = jest.fn();
        sketchInstance.fillRect = jest.fn();

        sketchInstance.draw();

        // Also test resize which calls setup
        sketchInstance.resize();

        expect(sketchInstance.save).toHaveBeenCalled();
        expect(sketchInstance.restore).toHaveBeenCalled();
    });

    test('getFlag and clearFlag handle sessionStorage exceptions and log warnings', () => {
        // To hit getFlag('ambientTransition:intro') we must be on a project page
        context.document.body.getAttribute.mockReturnValue('project');

        context.window.sessionStorage.getItem.mockImplementation(() => {
            throw new Error('Storage disabled');
        });
        context.window.sessionStorage.removeItem.mockImplementation(() => {
            throw new Error('Storage disabled');
        });

        context.window.console.warn = jest.fn();

        vm.createContext(context);
        vm.runInContext(code, context);

        // VM context errors are not instances of global.Error, so use expect.anything()
        expect(context.window.console.warn).toHaveBeenCalledWith(
            '[ambient] sessionStorage get error:',
            expect.anything()
        );

        // We can trigger clearFlag by faking a success in getFlag then forcing playIntro
        context.window.sessionStorage.getItem.mockReturnValue('1');

        // reset mock calls before re-eval
        context.window.console.warn.mockClear();

        // re-eval to trigger maybePlayIntro with the updated mock
        vm.runInContext(code, context);

        expect(context.window.console.warn).toHaveBeenCalledWith(
            '[ambient] sessionStorage remove error:',
            expect.anything()
        );
    });
});
