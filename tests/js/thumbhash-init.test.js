/**
 * @jest-environment jsdom
 */

const ThumbHash = require('../../js/vendor/thumbhash.js');
const ThumbHashInit = require('../../js/thumbhash-init.js');

describe('ThumbHash Vendor Decoder', () => {
    test('converts sample ThumbHash base64 into valid PNG data URL', () => {
        const sampleBase64 = 'CAgKBYAdUIrKSGR0q4Z2hg7JBgAA';
        const bytes = ThumbHash.base64ToUint8Array(sampleBase64);
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBeGreaterThan(0);

        const dataUrl = ThumbHash.thumbHashToDataURL(bytes);
        expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    test('computes approximate aspect ratio', () => {
        const sampleBase64 = 'CAgKBYAdUIrKSGR0q4Z2hg7JBgAA';
        const bytes = ThumbHash.base64ToUint8Array(sampleBase64);
        const ratio = ThumbHash.thumbHashToApproximateAspectRatio(bytes);
        expect(ratio).toBeGreaterThan(0);
    });
});

describe('ThumbHashInit', () => {
    let container;

    beforeEach(() => {
        window.ThumbHash = ThumbHash;
        document.body.innerHTML = `
            <div id="test-container">
                <img id="img1" data-thumbhash="CAgKBYAdUIrKSGR0q4Z2hg7JBgAA" src="/test1.jpg" />
                <img id="img2" data-thumbhash="DAgOBYAJpXhpmGhkmoeGdwAAAAAA" src="/test2.jpg" />
                <div id="bg-div" data-thumbhash="CggKBYANd4fMSJaKl6aKlwAAAAAA"></div>
                <img id="img-no-hash" src="/test3.jpg" />
            </div>
        `;
        container = document.getElementById('test-container');
    });

    test('init() applies background image to all matching images and containers', () => {
        ThumbHashInit.init(container);

        const img1 = document.getElementById('img1');
        const img2 = document.getElementById('img2');
        const bgDiv = document.getElementById('bg-div');
        const imgNoHash = document.getElementById('img-no-hash');

        expect(img1.style.backgroundImage).toMatch(/^url\("data:image\/png;base64,/);
        expect(img1.style.backgroundSize).toBe('cover');
        expect(img1.dataset.thumbhashApplied).toBe('true');

        expect(img2.style.backgroundImage).toMatch(/^url\("data:image\/png;base64,/);
        expect(img2.dataset.thumbhashApplied).toBe('true');

        expect(bgDiv.style.getPropertyValue('--thumbhash')).toMatch(
            /^url\("data:image\/png;base64,/
        );
        expect(bgDiv.style.backgroundImage).toBe('');
        expect(bgDiv.dataset.thumbhashApplied).toBe('true');
        expect(bgDiv.classList.contains('thumbhash-loaded')).toBe(true);

        expect(imgNoHash.style.backgroundImage).toBe('');
    });

    test('applyThumbHash() adds loaded class on image load event', () => {
        const img1 = document.getElementById('img1');
        ThumbHashInit.applyThumbHash(img1);

        expect(img1.classList.contains('thumbhash-loaded')).toBe(false);

        img1.dispatchEvent(new Event('load'));
        expect(img1.classList.contains('thumbhash-loaded')).toBe(true);
    });

    test('applyThumbHash() handles already completed images', () => {
        const img1 = document.getElementById('img1');
        Object.defineProperty(img1, 'complete', { value: true, configurable: true });
        Object.defineProperty(img1, 'naturalWidth', { value: 800, configurable: true });

        ThumbHashInit.applyThumbHash(img1);
        expect(img1.classList.contains('thumbhash-loaded')).toBe(true);
    });

    test('is idempotent when called multiple times', () => {
        const img1 = document.getElementById('img1');
        ThumbHashInit.applyThumbHash(img1);
        const bg = img1.style.backgroundImage;

        ThumbHashInit.applyThumbHash(img1);
        expect(img1.style.backgroundImage).toBe(bg);
    });

    test('gracefully handles missing or invalid inputs', () => {
        expect(() => ThumbHashInit.init(null)).not.toThrow();
        expect(() => ThumbHashInit.applyThumbHash(null)).not.toThrow();
        expect(() => ThumbHashInit.applyThumbHash({})).not.toThrow();
    });

    test('logs a warning and degrades gracefully on decoding failure', () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const img = document.createElement('img');
        img.setAttribute('data-thumbhash', 'invalid-hash!!!');

        // Mock getAttribute to prevent "dataset.thumbhashApplied" checks from skipping
        ThumbHashInit.applyThumbHash(img);

        expect(spy).toHaveBeenCalledWith(
            'ThumbHash decoding failed during init:',
            expect.any(Error)
        );
        expect(img.style.backgroundImage).toBe('');

        spy.mockRestore();
    });

    test('exits early if container lacks querySelectorAll', () => {
        expect(() => ThumbHashInit.init({})).not.toThrow();
        expect(() => ThumbHashInit.init({ querySelectorAll: 'not-a-function' })).not.toThrow();
    });

    test('initializes on DOMContentLoaded if loaded in loading state', () => {
        const originalReadyState = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(document),
            'readyState'
        );

        Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
        window.ThumbHash = ThumbHash;

        try {
            jest.isolateModules(() => {
                require('../../js/thumbhash-init.js');
            });

            // Fire DOMContentLoaded
            document.dispatchEvent(new Event('DOMContentLoaded'));

            const img1 = document.getElementById('img1');
            expect(img1.style.backgroundImage).toMatch(/^url\("data:image\/png;base64,/);
        } finally {
            if (originalReadyState) {
                delete document.readyState;
            }
        }
    });
});
