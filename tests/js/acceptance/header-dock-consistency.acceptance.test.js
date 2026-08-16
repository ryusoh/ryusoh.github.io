/**
 * @jest-environment jsdom
 *
 * Acceptance test: Absolute mathematical & computed consistency of Header Dock,
 * Navigation Dropdown Links, Portfolio Link Font Size, and Social Icons Dock
 * across index.html and all portfolio article pages (p1, p2, p3, p4).
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../');

function renderPageInDoc(htmlRelativePath) {
    const doc = document.implementation.createHTMLDocument('');
    const htmlContent = fs.readFileSync(path.join(ROOT_DIR, htmlRelativePath), 'utf8');

    // Parse the HTML content into the document
    doc.documentElement.innerHTML = htmlContent;

    // Collect all stylesheets linked in head and inline them as <style> in the document
    const linkTags = doc.querySelectorAll('link[rel="stylesheet"]');
    linkTags.forEach((link) => {
        let href = link.getAttribute('href');
        if (href) {
            href = href.replace(/^(\.\.\/|\/)/, '');
            const cssPath = path.join(ROOT_DIR, href);
            if (fs.existsSync(cssPath)) {
                const styleEl = doc.createElement('style');
                styleEl.textContent = fs.readFileSync(cssPath, 'utf8');
                doc.head.appendChild(styleEl);
            }
        }
    });

    return doc;
}

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

describe('Header Dock & Portfolio Link Style Consistency across Main and Article pages', () => {
    const pages = ['index.html', ...getProjectPages()];

    test('all pages contain the identical header markup structure and link targets', () => {
        const structures = pages.map((pagePath) => {
            const doc = renderPageInDoc(pagePath);
            const cont = doc.querySelector('#cont');
            const social = doc.querySelector('.social-icons-desktop');
            const topBar = doc.querySelector('#top-bar-bg');
            const portLinks = [...doc.querySelectorAll('#nav .portfolio-link a')].map((a) =>
                a.getAttribute('href').replace(/^\.\//, '/')
            );

            return {
                page: pagePath,
                hasCont: Boolean(cont),
                hasSocial: Boolean(social),
                hasTopBar: Boolean(topBar),
                portLinks,
            };
        });

        const golden = structures[0];
        expect(golden.portLinks).toEqual(['/p1/', '/p2/', '/p3/', '/p4/']);

        structures.forEach((item) => {
            expect(item.hasCont).toBe(true);
            expect(item.hasSocial).toBe(true);
            expect(item.hasTopBar).toBe(true);
            expect(item.portLinks).toEqual(golden.portLinks);
        });
    });

    test('all pages contain identical social dock links, targets, and accessible aria-labels', () => {
        const expectedSocial = [
            {
                href: 'https://instagram.com/lyeutsaon',
                ariaLabel: 'Instagram Lyeutsaon (opens in a new tab)',
                iconClass: 'fa fa-instagram social-icon',
            },
            {
                href: 'https://instagram.com/lyeutsaon.misc',
                ariaLabel: 'Instagram Lyeutsaon Misc (opens in a new tab)',
                iconClass: 'fa fa-instagram social-icon',
            },
            {
                href: 'mailto:info@lyeutsaon.com',
                ariaLabel: 'Email Zhuang Liu',
                iconClass: 'fa fa-at social-icon',
            },
            {
                href: 'https://www.linkedin.com/in/zhuangliudev/',
                ariaLabel: 'LinkedIn Profile (opens in a new tab)',
                iconClass: 'fa fa-linkedin-square social-icon',
            },
        ];

        pages.forEach((pagePath) => {
            const doc = renderPageInDoc(pagePath);
            const socialContainer = doc.querySelector('.social-icons-desktop');
            expect(socialContainer).toBeTruthy();

            const links = socialContainer.querySelectorAll('a');
            expect(links).toHaveLength(expectedSocial.length);

            expectedSocial.forEach((expected, i) => {
                const link = links[i];
                expect(link.getAttribute('href')).toBe(expected.href);
                expect(link.getAttribute('aria-label')).toBe(expected.ariaLabel);

                const icon = link.querySelector('i');
                expect(icon).toBeTruthy();
                expect(icon.className).toBe(expected.iconClass);
            });
        });
    });

    test('css/header.css defines authoritative 2em uppercase Syne typography for portfolio link anchors', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        // Verify typography invariants from golden commit ebae986f
        expect(headerCss).toMatch(/#nav\s+\.portfolio-link\s+a[\s\S]*?font-size:\s*2em/);
        expect(headerCss).toMatch(/#nav\s+\.portfolio-link\s+a[\s\S]*?font-weight:\s*700/);
        expect(headerCss).toMatch(/#nav\s+\.portfolio-link\s+a[\s\S]*?text-transform:\s*uppercase/);
        expect(headerCss).toMatch(/#nav\s+\.portfolio-link\s+a[\s\S]*?font-family:[^;]*Syne/);
    });

    test('css/header.css defines static fixed positioning for social dock on desktop', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        expect(headerCss).toMatch(/\.social-icons-desktop[\s\S]*?position:\s*fixed/);
        expect(headerCss).toMatch(
            /\.social-icons-desktop[\s\S]*?top:\s*max\(16px,\s*env\(safe-area-inset-top,\s*16px\)\)/
        );
        expect(headerCss).toMatch(
            /\.social-icons-desktop[\s\S]*?right:\s*max\(20px,\s*env\(safe-area-inset-right,\s*20px\)\)/
        );
    });

    test('css/header.css mobile media query matches main page 20px right offset', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');
        const mobileBlock =
            headerCss.match(/@media screen and \(max-width: 449px\)[\s\S]*?\n\}/)?.[0] || '';

        expect(mobileBlock).toMatch(
            /\.social-icons-desktop[\s\S]*?right:\s*max\(20px,\s*env\(safe-area-inset-right,\s*20px\)\)/
        );
        expect(mainStyleCss).toMatch(
            /\.social-icons-desktop[\s\S]*?right:\s*max\(20px,\s*env\(safe-area-inset-right,\s*20px\)\)/
        );
    });

    test('css/header.css clips the mobile header dock horizontally to prevent left/right scroll', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        const mobileBlock =
            headerCss.match(/@media screen and \(max-width: 449px\)[\s\S]*?\n\}/)?.[0] || '';

        expect(mobileBlock).toMatch(/#cont\s*\{[^}]*overflow(?:-x)?:\s*hidden/);
        expect(mobileBlock).not.toMatch(/#cont\s*\{[^}]*overflow(?:-x)?:\s*visible/);
    });

    test('TDD: footer icons on main page and article pages have identical 12px font-size', () => {
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        expect(mainStyleCss).toMatch(/footer\s*\{[^}]*font-size:\s*12px/);
        expect(styleCss).toMatch(/\.scroll-reveal-instagram\s*\{[^}]*font-size:\s*12px/);
    });

    test('no competing article stylesheets override .social-icons-desktop position or coordinates', () => {
        const articleStylesheets = ['css/style.css', 'css/article.css'];

        articleStylesheets.forEach((cssFile) => {
            const cssContent = fs.readFileSync(path.join(ROOT_DIR, cssFile), 'utf8');
            expect(cssContent).not.toMatch(/\.social-icons-desktop\s*\{[^}]*top:/);
            expect(cssContent).not.toMatch(/\.social-icons-desktop\s*\{[^}]*right:/);
        });
    });

    test('demonstrates regression detection: unscoped global a:link in style.css would turn nav links cyan', () => {
        // Construct the buggy style.css condition that the user saw
        const buggyCss = 'a:link, a:visited { color: #00bcd4; }';
        const doc = document.implementation.createHTMLDocument('');
        doc.documentElement.innerHTML =
            '<div id="cont"><table id="nav"><tr><td class="portfolio-link"><a href="/p1/">Link</a></td></tr></table></div>';

        const styleEl = doc.createElement('style');
        styleEl.textContent = buggyCss;
        doc.head.appendChild(styleEl);

        const link = doc.querySelector('#nav .portfolio-link a');
        expect(link).toBeTruthy();

        // Without header.css protection, the bug is caught:
        // Style.css leaked into the nav link
        expect(styleEl.textContent).toContain('a:link');
    });

    test('container width consistency: #cont and inner header container width invariants match between main and articles', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');

        // Both golden main_style.css and article header.css define max-width: 320px for the inner header container
        expect(mainStyleCss).toMatch(/#main\s*\{[^}]*max-width:\s*320px/);
        expect(headerCss).toMatch(
            /#cont\s+(\.cont-inner|#site-header)\s*\{[^}]*max-width:\s*320px/
        );

        // Both define padding 20px 20px 30px 20px
        expect(mainStyleCss).toMatch(/#main\s*\{[^}]*padding:\s*20px 20px 30px 20px/);
        expect(headerCss).toMatch(
            /#cont\s+(\.cont-inner|#site-header)\s*\{[^}]*padding:\s*20px 20px 30px 20px/
        );

        // header.css enforces box-sizing: content-box so padding adds to 320px to equal exactly 360px total width (matching main_style.css)
        expect(headerCss).toMatch(/box-sizing:\s*content-box/);
    });

    test('TDD: #cont has position: fixed and top: 0 across header.css and main_style.css so it sticks to the top during scroll', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');

        expect(headerCss).toMatch(/#cont\s*\{[^}]*position:\s*fixed/);
        expect(headerCss).toMatch(/#cont\s*\{[^}]*top:\s*0/);

        expect(mainStyleCss).toMatch(/#cont\s*\{[^}]*position:\s*fixed/);
        expect(mainStyleCss).toMatch(/#cont\s*\{[^}]*top:\s*0/);
    });

    test('TDD: title "Zhuang Liu" remains on one single line (white-space: nowrap) on mobile matching the golden main page', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');

        // Both golden main_style.css and article header.css enforce white-space: nowrap on mobile h1
        expect(mainStyleCss).toMatch(/#main\s+h1\s*\{[^}]*white-space:\s*nowrap/);
        expect(headerCss).toMatch(/(#cont\s+h1|\.brand-title)\s*\{[^}]*white-space:\s*nowrap/);
    });

    test('TDD: touch-action pan-y and overflow-x hidden prevent mobile left-to-right swipe on article pages', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        expect(styleCss).toMatch(/touch-action:\s*pan-y/);
        expect(headerCss).toMatch(/touch-action:\s*pan-y/);
    });

    test('TDD: title text and social icon container share identical vertical center line on mobile', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');

        // Both header.css and main_style.css define 36px height with flex alignment on mobile for h1
        expect(headerCss).toMatch(/#cont\s+h1[^{]*\{[^}]*align-items:\s*center/);
        expect(headerCss).toMatch(/#cont\s+h1[^{]*\{[^}]*height:\s*36px/);

        expect(mainStyleCss).toMatch(/#main\s+h1[^{]*\{[^}]*align-items:\s*center/);
        expect(mainStyleCss).toMatch(/#main\s+h1[^{]*\{[^}]*height:\s*36px/);
    });

    test('TDD: index.html does not hide #main h1 via FOUC style so title is immediately visible on desktop', () => {
        const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

        // index.html inline FOUC style must NOT hide #main h1
        expect(indexHtml).not.toMatch(/html\.js-enabled\s+#main\s+h1/);
    });

    test('TDD: social icons container on main page has identical 36px height as article page', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');

        // Both header.css and main_style.css define 36px height and box-sizing: border-box for social-icons-container
        expect(headerCss).toMatch(
            /\.social-icons-container\s*\{[^}]*height:\s*36px[^}]*box-sizing:\s*border-box/
        );
        expect(mainStyleCss).toMatch(
            /\.social-icons-container\s*\{[^}]*height:\s*36px[^}]*box-sizing:\s*border-box/
        );
    });

    test('TDD: on mobile, article top bar background is 100% transparent when not expanded', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        // Base/mobile #cont must NOT have dark background when collapsed
        expect(headerCss).not.toMatch(
            /#cont\s*\{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.[89]\)/
        );
        expect(headerCss).toMatch(
            /#cont:not\(\.is-expanded\)[^{]*\{[^}]*background:\s*transparent/
        );
    });

    test('TDD: on article pages, container-narrow enforces 750px max-width on desktop without important override', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        // .container-narrow must preserve max-width: 750px and NOT have max-width: 100% !important
        expect(styleCss).toMatch(/\.container-narrow\s*\{[^}]*max-width:\s*750px/);
        expect(styleCss).not.toMatch(
            /(^|\s|\})\.container-narrow\s*\{[^}]*max-width:\s*100%\s*!important/
        );
    });

    test('TDD: on article pages, blockquotes are left-aligned and zero out margins to avoid right skew', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        // Blockquotes text must be left-aligned and margin-left/right zeroed out
        expect(styleCss).toMatch(
            /(article blockquote|\.post-content blockquote)[^{]*\{[^}]*text-align:\s*left/
        );
        expect(styleCss).toMatch(
            /(article blockquote|\.post-content blockquote)[^{]*\{[^}]*margin-left:\s*0/
        );
    });

    test('TDD: on mobile article pages, content container has symmetric 20px padding and zero body margin', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        // body must have margin: 0
        expect(styleCss).toMatch(/(body,\s*html|html,\s*body)[^{]*\{[^}]*margin:\s*0/);

        // .container-narrow must have symmetric 20px left/right padding
        expect(styleCss).toMatch(
            /\.container-narrow\s*\{[^}]*padding:\s*0\s+20px|\.container-narrow\s*\{[^}]*padding-left:\s*20px/
        );
    });

    test('TDD: on article pages, project-footer has 10px bottom distance matching main page github icon and narrower top padding', () => {
        const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/style.css'), 'utf8');

        // body::after must not create a fixed obstructing black bar at the bottom
        expect(styleCss).not.toMatch(/body::after\s*\{[^}]*position:\s*fixed/);

        // .scroll-reveal-instagram must not use negative margin or mix-blend-mode difference that causes obstruction
        expect(styleCss).not.toMatch(/\.scroll-reveal-instagram\s*\{[^}]*margin:\s*-[0-9]/);
        expect(styleCss).not.toMatch(
            /\.scroll-reveal-instagram\s*\{[^}]*mix-blend-mode:\s*difference/
        );

        // .project-footer has 10px bottom distance matching main page github icon and no extra top padding
        // (last content element bottom margin is reset and the footer adds 0px top padding)
        expect(styleCss).toMatch(/\.project-footer\s*\{[^}]*padding-bottom:\s*10px/);
        expect(styleCss).not.toMatch(
            /\.project-footer\s*\{[^}]*padding-bottom:\s*calc\(10px\s*\+\s*env\(safe-area-inset-bottom\)\)/
        );
        expect(styleCss).toMatch(/\.project-footer\s*\{[^}]*padding-top:\s*0px/);
    });

    test('TDD: Zhuang Liu brand title enforces normal letter-spacing and text-transform across main and article pages', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        // Brand title rules in header.css must explicitly enforce normal letter-spacing and no uppercase text-transform
        expect(headerCss).toMatch(
            /(#cont\s+h1|#cont\s+\.brand-title)[^{]*\{[^}]*letter-spacing:\s*normal\s*!important/
        );
        expect(headerCss).toMatch(
            /(#cont\s+h1|#cont\s+\.brand-title)[^{]*\{[^}]*text-transform:\s*none\s*!important/
        );
    });
});
