/**
 * @jest-environment jsdom
 *
 * Acceptance test: the mobile banner and footer icon are positioned identically
 * on the main page and on every article page.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../');

describe('Mobile banner consistency between main page and article pages', () => {
    const pages = ['p1/index.html', 'p2/index.html', 'p3/index.html', 'p4/index.html'];

    test('every page loads the shared banner stylesheet', () => {
        ['index.html', ...pages].forEach((pagePath) => {
            const html = fs.readFileSync(path.join(ROOT_DIR, pagePath), 'utf8');
            expect(html).toMatch(/<link[^>]*href="[^"]*banner\.css"[^>]*>/);
        });
    });

    test('every article page places the mobile banner inside the project footer', () => {
        pages.forEach((pagePath) => {
            const html = fs.readFileSync(path.join(ROOT_DIR, pagePath), 'utf8');
            expect(html).toMatch(
                /<div class="project-footer">[\s\S]*?<img[^>]*class="[^"]*mobile-banner[^"]*"[^>]*>/
            );
            expect(html).toMatch(
                /<img[^>]*class="[^"]*mobile-banner[^"]*"[^>]*>[\s\S]*?<a[^>]*class="[^"]*scroll-reveal-instagram[^"]*"/
            );
        });
    });

    test('main page places the mobile banner inside the footer above the GitHub icon', () => {
        const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
        expect(html).toMatch(
            /<footer[^>]*>[\s\S]*?<img[^>]*class="[^"]*mobile-banner[^"]*"[^>]*>[\s\S]*?<a[^>]*href="[^"]*github[^"]*"[^>]*>/
        );
    });

    test('article banner uses the same image source as the main page banner', () => {
        pages.forEach((pagePath) => {
            const html = fs.readFileSync(path.join(ROOT_DIR, pagePath), 'utf8');
            const banner = html.match(/<img[^>]*class="[^"]*mobile-banner[^"]*"[^>]*>/);
            expect(banner).toBeTruthy();
            expect(banner[0]).toMatch(/src="[^"]*\/assets\/banners\/banner\.png"/);
        });
    });

    test('article pages do not load the standalone image fallback loader for the banner', () => {
        pages.forEach((pagePath) => {
            const html = fs.readFileSync(path.join(ROOT_DIR, pagePath), 'utf8');
            expect(html).not.toMatch(/<script[^>]*src="[^"]*imageFallback\.js"[^>]*>/);
        });
    });

    test('banner height is controlled by a single --mobile-banner-height custom property', () => {
        const bannerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/banner.css'), 'utf8');
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        expect(bannerCss).toMatch(/--mobile-banner-height:\s*30px/);
        expect(bannerCss.match(/height:\s*var\(--mobile-banner-height\)/g) || []).toHaveLength(2);

        expect(mainStyleCss).not.toMatch(/--mobile-banner-height:\s*/);
        expect(mainStyleCss).toMatch(/height:\s*var\(--mobile-banner-height\)/);

        expect(styleCss).not.toMatch(/--mobile-banner-height:\s*/);
        expect(styleCss).toMatch(/height:\s*var\(--mobile-banner-height\)/);
    });

    test('main page footer is fixed; article footer flows in the document for scroll-reveal', () => {
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        // Main page footer stays fixed (it uses imageFallback, not IntersectionObserver).
        expect(mainStyleCss).toMatch(/footer\s*\{[\s\S]*?position:\s*fixed[\s\S]*?bottom:\s*10px/);

        // Article footer must NOT be fixed — fixed positioning makes the
        // IntersectionObserver in scroll-reveal-icon.js fire immediately
        // (the observed element is always in the viewport), so the banner
        // and icon are always visible instead of revealed at scroll-end.
        expect(styleCss).not.toMatch(/\.project-footer\s*\{[^}]*position:\s*fixed/);
    });

    test('article banner is styled as a relative unit inside the fixed footer, not fixed', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');
        const ruleMatch = styleCss.match(/\.project-footer\s+\.mobile-banner\s*\{([^}]*)\}/);
        expect(ruleMatch).toBeTruthy();
        const rule = ruleMatch[1];
        expect(rule).toMatch(/position:\s*relative/);
        expect(rule).not.toMatch(/position:\s*fixed/);
        expect(rule).toMatch(/height:\s*var\(--mobile-banner-height\)/);
    });

    test('main page banner is styled as a relative unit inside the fixed footer, not fixed', () => {
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');
        const ruleMatch = mainStyleCss.match(/footer\s+\.mobile-banner\s*\{([^}]*)\}/);
        expect(ruleMatch).toBeTruthy();
        const rule = ruleMatch[1];
        expect(rule).toMatch(/position:\s*relative/);
        expect(rule).not.toMatch(/position:\s*fixed/);
        expect(rule).toMatch(/height:\s*var\(--mobile-banner-height\)/);
    });

    test('article image styling does not apply to the mobile banner', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        // The article image rules must exclude .mobile-banner so the banner keeps its intended size.
        expect(styleCss).toMatch(
            /article\s+img:not\(\.mobile-banner\)[\s\S]*?position:\s*relative/
        );
    });

    test('horizontal scrolling is banned on article pages', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        expect(styleCss).toMatch(/overflow-x:\s*clip/);
        expect(styleCss).toMatch(/overflow-x:\s*hidden/);
        expect(styleCss).toMatch(/touch-action:\s*pan-y/);
        expect(headerCss).toMatch(/overflow-x:\s*(hidden|clip)/);
        expect(headerCss).toMatch(/touch-action:\s*pan-y/);
    });
});
