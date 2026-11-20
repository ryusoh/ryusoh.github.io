/* global Buffer */
/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../');
const PAGES = [
    'index.html',
    ...fs
        .readdirSync(ROOT_DIR)
        .filter((name) => /^p\d+$/.test(name) && !['p98', 'p99'].includes(name))
        .sort()
        .map((name) => `${name}/index.html`),
];

const CSS_FILES = ['css/main_style.css', 'css/header.css'];
const ICON_UNICODE = {
    instagram: 'f16d',
    at: 'f1fa',
    'linkedin-square': 'f08c',
    github: 'f09b',
};

const readEmbeddedFont = (css) => {
    const match = css.match(
        /font-family:\s*'SiteIcons';[\s\S]*?url\((['"])data:font\/woff;base64,([^'"]+)\1\)\s*format\((['"])woff\3\)/
    );
    expect(match).not.toBeNull();
    return Buffer.from(match[2], 'base64');
};

describe('self-contained social icons', () => {
    test.each(CSS_FILES)('%s embeds a small WOFF subset and all social glyphs', (file) => {
        const css = fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
        const font = readEmbeddedFont(css);

        expect(font.subarray(0, 4).toString('ascii')).toBe('wOFF');
        expect(font.length).toBeLessThan(4096);
        Object.entries(ICON_UNICODE).forEach(([name, unicode]) => {
            expect(css).toMatch(
                new RegExp(`\\.fa-${name}::before\\s*\\{\\s*content:\\s*['"]\\\\${unicode}['"];`)
            );
        });
    });

    test('both stylesheets embed the identical subset', () => {
        const fonts = CSS_FILES.map((file) =>
            readEmbeddedFont(fs.readFileSync(path.join(ROOT_DIR, file), 'utf8'))
        );
        expect(fonts[0].equals(fonts[1])).toBe(true);
    });

    test.each(PAGES)('%s uses smoothed font glyphs without icon-font requests', (page) => {
        const html = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
        document.documentElement.innerHTML = html;

        expect(document.querySelectorAll('link[href*="font-awesome"]')).toHaveLength(0);
        expect(document.querySelectorAll('script[src*="font-awesome"]')).toHaveLength(0);
        expect(document.querySelector('.icon-sprite')).toBeNull();

        const icons = document.querySelectorAll('i.fa');
        expect(icons.length).toBeGreaterThan(0);
        for (const icon of icons) {
            expect(icon.getAttribute('aria-hidden')).toBe('true');
            expect(
                Array.from(icon.classList).some((name) =>
                    Object.prototype.hasOwnProperty.call(ICON_UNICODE, name.slice(3))
                )
            ).toBe(true);
        }
    });
});
