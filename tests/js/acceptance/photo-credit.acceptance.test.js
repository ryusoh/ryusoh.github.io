/**
 * @jest-environment jsdom
 *
 * Acceptance test for photo credit banner positioning, color uniformity, and transparency.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../');

describe('Photo Credit Banner Acceptance Suite', () => {
    const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css', 'style.css'), 'utf8');

    test('photo-credit CSS guarantees zero margins on nested picture so lower bound aligns with photo', () => {
        // Must prevent .post-content picture margin: 16px from expanding .image-wrapper below the img
        expect(styleCss).toMatch(/\.post-content\s+\.image-wrapper\s+picture[\s\S]*?margin:\s*0/);
    });

    test('photo-credit text and link handle are both 70% opaque white, overriding default hypertext blue', () => {
        // .photo-credit text color must be 70% white
        expect(styleCss).toMatch(
            /\.photo-credit\s*\{[\s\S]*?color:\s*rgba\(255,\s*255,\s*255,\s*0\.7\)/
        );
        // .photo-credit a and a:link must be explicitly styled 70% white to override .post-content a:link
        expect(styleCss).toMatch(
            /\.photo-credit\s+a:\s*link[\s\S]*?color:\s*rgba\(255,\s*255,\s*255,\s*0\.7\)/
        );
    });

    test('photo-credit is a sharp rectangle (border-radius: 0) with Syne font and reduced transparency (opacity >= 0.7)', () => {
        expect(styleCss).toMatch(/\.photo-credit\s*\{[\s\S]*?font-family:\s*['"]Syne['"]/);
        expect(styleCss).toMatch(/\.photo-credit\s*\{[\s\S]*?border-radius:\s*0/);
        // background opacity >= 0.7
        expect(styleCss).toMatch(
            /background-color:\s*rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0\.[7-9]\d*|1(?:\.0+)?)\s*\)/
        );
    });

    test('image-wrapper has 0 margin and image-container has 16px margin for identical vertical spacing', () => {
        // .image-wrapper inline-block must have margin 0 so it doesn't double margins inside the container
        expect(styleCss).toMatch(/\.image-wrapper\s*\{[\s\S]*?margin:\s*0/);
        // .image-container block element must have margin: 16px to collapse with adjacent blocks
        expect(styleCss).toMatch(/\.image-container[\s\S]*?margin:\s*16px\s+auto/);
    });

    test('p5/index.html includes photo-credit element within image-wrapper and image-container', () => {
        const p5HtmlPath = path.join(ROOT_DIR, 'p5', 'index.html');
        if (fs.existsSync(p5HtmlPath)) {
            const html = fs.readFileSync(p5HtmlPath, 'utf8');
            expect(html).toContain('class="image-container"');
            expect(html).toContain('class="image-wrapper"');
            expect(html).toContain('class="photo-credit"');
            expect(html).toContain('href="https://www.instagram.com/photo.initiator/"');
        }
    });
});
