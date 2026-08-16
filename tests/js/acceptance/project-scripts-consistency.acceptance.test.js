/**
 * @jest-environment jsdom
 *
 * Acceptance test: All portfolio project pages (p1, p2, p3, p4, ...) share
 * identical script tags, stylesheets, and dock infrastructure in the exact
 * same load order to prevent template drift.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../');

const getProjectPages = () =>
    fs
        .readdirSync(ROOT_DIR, { withFileTypes: true })
        .filter(
            (d) =>
                d.isDirectory() &&
                /^p\d+$/i.test(d.name) &&
                fs.existsSync(path.join(ROOT_DIR, d.name, 'index.html'))
        )
        .map((d) => `${d.name}/index.html`)
        .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));

describe('Project pages script and infrastructure consistency', () => {
    const projectPages = getProjectPages();

    test('all project pages have identical stylesheet links in head', () => {
        const pageStylesheets = projectPages.map((pagePath) => {
            const html = fs.readFileSync(path.join(ROOT_DIR, pagePath), 'utf8');
            document.documentElement.innerHTML = html;
            return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) =>
                l.getAttribute('href')
            );
        });

        const firstStylesheets = pageStylesheets[0];
        pageStylesheets.forEach((sheets) => {
            expect(sheets).toEqual(firstStylesheets);
        });
    });

    test('all project pages have identical script tags in head and body', () => {
        const pageScripts = projectPages.map((pagePath) => {
            const html = fs.readFileSync(path.join(ROOT_DIR, pagePath), 'utf8');
            document.documentElement.innerHTML = html;
            return Array.from(document.querySelectorAll('script[src]')).map((s) => ({
                src: s.getAttribute('src'),
                defer: s.hasAttribute('defer'),
                type: s.getAttribute('type') || null,
            }));
        });

        const firstScripts = pageScripts[0];
        pageScripts.forEach((scripts) => {
            expect(scripts).toEqual(firstScripts);
        });
    });

    test('all project pages have identical social dock icons and links', () => {
        const pageSocials = projectPages.map((pagePath) => {
            const html = fs.readFileSync(path.join(ROOT_DIR, pagePath), 'utf8');
            document.documentElement.innerHTML = html;
            return Array.from(document.querySelectorAll('.social-icons-desktop a')).map((a) => ({
                href: a.getAttribute('href'),
                ariaLabel: a.getAttribute('aria-label'),
            }));
        });

        const firstSocials = pageSocials[0];
        pageSocials.forEach((socials) => {
            expect(socials).toEqual(firstSocials);
        });
    });
});
