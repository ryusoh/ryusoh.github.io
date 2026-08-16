/**
 * @jest-environment jsdom
 *
 * Acceptance test: Article image & blockquote spacing uniformity and root variable configuration.
 * Verifies that:
 * 1. :root in css/style.css defines a single `--gallery-block-gap` config token (defaults to 7px).
 * 2. Image, picture, and .image-container vertical margins use `var(--gallery-block-gap, 7px) auto !important`.
 * 3. Blockquote vertical margins use `var(--gallery-block-gap, 7px) 0 !important` on desktop and mobile.
 * 4. Paragraph spacing within post content uses `var(--gallery-block-gap, 7px) 0`.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../');

describe('Article Image & Block Spacing Acceptance Suite', () => {
    const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');
    const articleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/article.css'), 'utf8');

    test(':root defines a single --gallery-block-gap configuration variable in style.css', () => {
        expect(styleCss).toMatch(/--gallery-block-gap:\s*10px;/);
    });

    test('gallery outer image blocks (.image-container and div[align=center]) use --gallery-block-gap margin in style.css', () => {
        expect(styleCss).toMatch(
            /\.post-content\s*>\s*div\[align=['"]center['"]\][\s\S]*?margin:\s*var\(--gallery-block-gap[^)]*\)\s+auto/
        );
        expect(styleCss).toMatch(
            /\.image-container[\s\S]*?margin:\s*var\(--gallery-block-gap[^)]*\)\s+auto/
        );
    });

    test('inner picture elements inside image blocks have 0 margin to prevent double-spacing', () => {
        expect(styleCss).toMatch(
            /\.post-content\s*>\s*div\[align=['"]center['"]\]\s+picture[\s\S]*?margin:\s*0/
        );
    });

    test('image-container vertical margins use --gallery-block-gap in article.css', () => {
        expect(articleCss).toMatch(
            /\.image-container[\s\S]*?margin:\s*var\(--gallery-block-gap[^)]*\)\s+auto/
        );
    });

    test('blockquote margins use --gallery-block-gap on desktop and mobile in style.css', () => {
        expect(styleCss).toMatch(
            /article\s+blockquote[\s\S]*?margin:\s*var\(--gallery-block-gap[^)]*\)\s+0\s*!important/
        );
        expect(styleCss).toMatch(
            /@media\s+only\s+screen\s+and\s+\(max-width:\s*768px\)[\s\S]*?blockquote[\s\S]*?margin:\s*var\(--gallery-block-gap[^)]*\)\s+0\s*!important/
        );
    });

    test('blockquote margins use --gallery-block-gap in article.css', () => {
        expect(articleCss).toMatch(
            /article\s+\.container\s+\.row\s+blockquote[\s\S]*?margin:\s*var\(--gallery-block-gap[^)]*\)\s+0/
        );
        expect(articleCss).toMatch(
            /@media\s+only\s+screen\s+and\s+\(max-width:\s*768px\)[\s\S]*?blockquote[\s\S]*?margin:\s*var\(--gallery-block-gap[^)]*\)\s+0/
        );
    });

    test('post-content paragraph margin uses --gallery-block-gap in style.css', () => {
        expect(styleCss).toMatch(
            /\.post-content\s+p\s*\{[^}]*margin:\s*var\(--gallery-block-gap[^)]*\)\s+0/
        );
    });
});
