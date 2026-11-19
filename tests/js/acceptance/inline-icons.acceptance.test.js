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

describe('self-contained social icons', () => {
    test.each(PAGES)('%s uses inline SVG icons without Font Awesome requests', (page) => {
        const html = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
        document.documentElement.innerHTML = html;

        expect(document.querySelectorAll('link[href*="font-awesome"]')).toHaveLength(0);
        expect(document.querySelectorAll('script[src*="font-awesome"]')).toHaveLength(0);

        const icons = document.querySelectorAll('svg.fa');
        expect(icons.length).toBeGreaterThan(0);
        for (const icon of icons) {
            const use = icon.querySelector('use');
            expect(use).not.toBeNull();
            expect(use.getAttribute('href')).toMatch(/^#icon-/);
            expect(document.querySelector(use.getAttribute('href'))).not.toBeNull();
        }
    });
});
