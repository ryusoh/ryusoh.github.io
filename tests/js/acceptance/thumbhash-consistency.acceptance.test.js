/**
 * @jest-environment jsdom
 *
 * Acceptance test: ThumbHash blur placeholders are baked inline across all
 * gallery project pages (p1-p4) for instant 0ms Frame-0 rendering without
 * black box flashes, and homepage background container does not lock to ThumbHash.
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
                d.name.toLowerCase() !== 'p99' &&
                fs.existsSync(path.join(ROOT_DIR, d.name, 'index.html'))
        )
        .map((d) => `${d.name}/index.html`)
        .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));

describe('ThumbHash consistency across project galleries and homepage', () => {
    const projectPages = getProjectPages();

    test('every gallery image has data-thumbhash and inline data URL background-image style', () => {
        projectPages.forEach((pagePath) => {
            const html = fs.readFileSync(path.join(ROOT_DIR, pagePath), 'utf8');
            document.body.innerHTML = html;

            const galleryImgs = Array.from(
                document.querySelectorAll(
                    'article picture img:not(.mobile-banner), .post-content picture img:not(.mobile-banner)'
                )
            );

            expect(galleryImgs.length).toBeGreaterThan(0);

            galleryImgs.forEach((img) => {
                const thumbhash = img.getAttribute('data-thumbhash');
                expect(thumbhash).toBeTruthy();
                expect(thumbhash.length).toBeGreaterThanOrEqual(20);

                const style = img.getAttribute('style') || '';
                expect(style).toContain("background-image: url('data:image/png;base64,");
                expect(style).toContain('background-size: cover');
            });
        });
    });

    test('homepage mimida container does not have data-thumbhash attribute', () => {
        const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
        document.body.innerHTML = html;

        const mimida = document.getElementById('mimida');
        expect(mimida).toBeTruthy();
        expect(mimida.getAttribute('data-thumbhash')).toBeNull();
    });

    test('homepage preloads desktop_background without media queries and does not preload mobile_background', () => {
        const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
        expect(html).toContain('href="/assets/img/desktop_background.webp"');
        expect(html).not.toMatch(/<link[^>]*href="[^"]*mobile_background[^"]*"[^>]*>/);
    });
});
