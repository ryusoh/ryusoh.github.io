/**
 * @jest-environment jsdom
 *
 * TDD Acceptance Test: Mobile Horizontal Scroll Prevention across all pages.
 * Ensures html, body, #cont, and article containers enforce overflow-x: hidden,
 * preventing any unwanted left-to-right horizontal scrolling on mobile devices.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../');

describe('TDD: Mobile Horizontal Scroll Prevention (No Left-Right Scroll)', () => {
    test('css/header.css locks html, body, and #cont to overflow-x: hidden', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        expect(headerCss).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*hidden/);
        expect(headerCss).toMatch(/#cont\s*\{[^}]*overflow-x:\s*hidden/);
    });

    test('css/main_style.css locks html, body, and #cont to overflow-x: hidden', () => {
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');

        expect(mainStyleCss).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*hidden/);
        expect(mainStyleCss).toMatch(/#cont\s*\{[^}]*overflow-x:\s*hidden/);
    });

    test('css/style.css locks html and body to overflow-x: hidden', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        expect(styleCss).toMatch(/overflow-x:\s*hidden/);
    });

    test('css/article.css locks article content containers to overflow-x: hidden and max-width 100%', () => {
        const articleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/article.css'), 'utf8');

        expect(articleCss).toMatch(/overflow-x:\s*hidden/);
        expect(articleCss).toMatch(/max-width:\s*100%/);
    });

    test('TDD: all project pages define strict mobile viewport meta tags to prevent zoom-induced horizontal scroll', () => {
        const pages = fs
            .readdirSync(ROOT_DIR, { withFileTypes: true })
            .filter(
                (d) =>
                    d.isDirectory() &&
                    /^p\d+$/i.test(d.name) &&
                    d.name.toLowerCase() !== 'p99' &&
                    fs.existsSync(path.join(ROOT_DIR, d.name, 'index.html'))
            )
            .map((d) => d.name);
        for (const page of pages) {
            const html = fs.readFileSync(path.join(ROOT_DIR, page, 'index.html'), 'utf8');
            expect(html).toMatch(
                /<meta\s+name="viewport"\s+content="[^"]*maximum-scale=1[^"]*user-scalable=no/
            );
        }
    });

    test('TDD: css/style.css and css/header.css enforce touch-action: pan-y across html, body, and all children', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        expect(styleCss).toMatch(/(html,\s*body,\s*body\s*\*|\*)[^{]*\{[^}]*touch-action:\s*pan-y/);
        expect(headerCss).toMatch(
            /(html,\s*body,\s*body\s*\*|\*)[^{]*\{[^}]*touch-action:\s*pan-y/
        );
    });

    test('TDD: css/style.css constrains main, article, and .post-content to max-width 100% and overflow-x hidden', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        expect(styleCss).toMatch(
            /(main|article|\.post-content)[^{]*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*hidden/
        );
    });
});
