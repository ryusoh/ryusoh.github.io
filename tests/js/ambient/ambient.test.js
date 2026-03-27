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
