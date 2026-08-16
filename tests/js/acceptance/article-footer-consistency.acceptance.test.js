/**
 * @jest-environment jsdom
 *
 * Acceptance test: article project-footer spacing matches the main page footer.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../');

describe('Article project-footer spacing consistency with main page footer', () => {
    test('project-footer bottom gap matches the main page fixed footer bottom offset', () => {
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        // Main page GitHub icon is fixed 10px above the viewport bottom.
        expect(mainStyleCss).toMatch(/footer\s*\{[^}]*bottom:\s*10px/);

        // Article Instagram icon should sit the same 0 above the viewport bottom as the main GitHub icon.
        expect(styleCss).toMatch(/\.project-footer\s*\{[^}]*padding-bottom:\s*10px/);
        expect(styleCss).not.toMatch(
            /\.project-footer\s*\{[^}]*padding-bottom:\s*calc\(0\s*\+\s*env\(safe-area-inset-bottom\)\)/
        );
    });

    test('project-footer top gap matches the 0 spacing between adjacent article images', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        // Adjacent images are 7px apart because their vertical margins collapse.
        // Reset the last content element's bottom margin; the footer adds no extra top gap (padding-top: 0).
        expect(styleCss).toMatch(
            /(?:article\s+img|\.image-container|div\[align=['"]center['"]\])[\s\S]*?margin:\s*(?:var\(--gallery-block-gap[^)]*\)|7px)\s+auto/
        );
        expect(styleCss).toMatch(
            /\.article-container\s+article\s+\.post-content\s+[\s\S]*?:last-child[\s\S]*?margin-bottom:\s*0\s*(!important\s*)?;/
        );
        expect(styleCss).toMatch(/\.project-footer\s*\{[^}]*padding-top:\s*0/);
    });
});
