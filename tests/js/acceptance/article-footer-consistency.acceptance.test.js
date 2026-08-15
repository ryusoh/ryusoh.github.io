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

        // Article Instagram icon should sit the same 10px above the safe-area-aware bottom.
        expect(styleCss).toMatch(/\.project-footer\s*\{[^}]*padding-bottom:\s*10px/);
        expect(styleCss).toMatch(
            /\.project-footer\s*\{[^}]*padding-bottom:\s*calc\(10px\s*\+\s*env\(safe-area-inset-bottom\)\)/
        );
    });

    test('project-footer top gap matches the 16px spacing between adjacent article images', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        // Adjacent images are 16px apart because their 16px vertical margins collapse.
        // Reset the last content element's bottom margin and let the footer supply the 16px gap.
        expect(styleCss).toMatch(/article\s+img[\s\S]*?margin:\s*16px\s+auto\s*(!important\s*)?;/);
        expect(styleCss).toMatch(
            /\.article-container\s+article\s+\.post-content\s+(?:img|blockquote):last-child[\s\S]*?margin-bottom:\s*0\s*(!important\s*)?;/
        );
        expect(styleCss).toMatch(/\.project-footer\s*\{[^}]*padding-top:\s*16px/);
    });
});
