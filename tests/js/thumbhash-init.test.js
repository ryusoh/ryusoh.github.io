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
                <img id="img-no-hash" src="/test3.jpg" />
            </div>
        `;
        container = document.getElementById('test-container');
    });

    test('init() applies background image to all matching images', () => {
        ThumbHashInit.init(container);

        const img1 = document.getElementById('img1');
        const img2 = document.getElementById('img2');
        const imgNoHash = document.getElementById('img-no-hash');

        expect(img1.style.backgroundImage).toMatch(/^url\("data:image\/png;base64,/);
        expect(img1.style.backgroundSize).toBe('cover');
        expect(img1.dataset.thumbhashApplied).toBe('true');

        expect(img2.style.backgroundImage).toMatch(/^url\("data:image\/png;base64,/);
        expect(img2.dataset.thumbhashApplied).toBe('true');

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

    test('initializes on DOMContentLoaded if loaded in loading state', () => {
        const fs = require('fs');
        const path = require('path');
        const code = fs.readFileSync(path.resolve(__dirname, '../../js/thumbhash-init.js'), 'utf8');

        // Set document.readyState to 'loading'
        Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
        window.ThumbHash = ThumbHash;

        const scriptFn = new Function(
            'require',
            'module',
            'exports',
            'document',
            'window',
            'ThumbHash',
            code
        );
        const mod = { exports: {} };
        scriptFn(require, mod, mod.exports, document, window, ThumbHash);

        // Fire DOMContentLoaded
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const img1 = document.getElementById('img1');
        expect(img1.style.backgroundImage).toMatch(/^url\("data:image\/png;base64,/);
    });
});
