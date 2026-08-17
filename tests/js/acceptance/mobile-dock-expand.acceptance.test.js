/**
 * @jest-environment jsdom
 *
 * TDD Acceptance Test: Mobile Dock Click-to-Expand & Double-Click-to-Home
 * 1. On mobile, #nav on article pages is collapsed by default.
 * 2. Single click on the title toggles expansion of #nav.
 * 3. Double click on the title navigates back to the main page.
 * 4. Clicking outside #cont collapses the navigation.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../');

describe('TDD: Mobile Dock Expand & Double-Click Navigation', () => {
    test('css/header.css collapses #nav on mobile by default and expands on #cont.is-expanded', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        expect(headerCss).toMatch(/#cont\s+#nav\s*\{[^}]*display:\s*none/);
        expect(headerCss).toMatch(/#cont\.is-expanded\s+#nav\s*\{[^}]*display:\s*table/);
    });

    test('on mobile: single click when collapsed expands; single click when expanded returns home; outside click collapses', () => {
        document.documentElement.innerHTML = `
            <div id="cont">
                <header id="site-header">
                    <h1 class="brand-title">
                        <a href="/" class="nav-back" data-page-transition><span>Zhuang Liu</span></a>
                    </h1>
                    <table id="nav"><tbody><tr><td><a href="/p1/">Link</a></td></tr></tbody></table>
                </header>
            </div>
        `;

        // Mock matchMedia for mobile (< 450px)
        const mockAddListener = jest.fn();
        const mockAddEventListener = jest.fn();
        window.matchMedia = jest.fn().mockImplementation((query) => ({
            matches: query.includes('max-width: 449px'),
            media: query,
            onchange: null,
            addListener: mockAddListener,
            removeListener: jest.fn(),
            addEventListener: mockAddEventListener,
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));

        const initMobileDock = require('../../../js/mobile-dock.js').initMobileDock;
        initMobileDock();

        const cont = document.getElementById('cont');
        const titleLink = document.querySelector('.brand-title a');
        expect(cont).toBeTruthy();
        expect(titleLink).toBeTruthy();

        // 1. Initial state: collapsed
        expect(cont.classList.contains('is-expanded')).toBe(false);

        // 2. Click when collapsed: expands dock and prevents navigation
        let navEventFired = false;
        window.addEventListener('mobile-dock:navigate', () => {
            navEventFired = true;
        });

        const firstClick = new MouseEvent('click', { bubbles: true, cancelable: true });
        titleLink.dispatchEvent(firstClick);

        expect(cont.classList.contains('is-expanded')).toBe(true);
        expect(firstClick.defaultPrevented).toBe(true);
        expect(navEventFired).toBe(false);

        // 3. Click when expanded: navigates to main page (href="/")
        let navigatedUrl = null;
        window.addEventListener('mobile-dock:navigate', (e) => {
            navigatedUrl = e.detail.url;
        });

        const secondClick = new MouseEvent('click', { bubbles: true, cancelable: true });
        titleLink.dispatchEvent(secondClick);

        expect(navigatedUrl).toBe('/');

        // 4. Outside click collapses when expanded
        cont.classList.add('is-expanded');
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(cont.classList.contains('is-expanded')).toBe(false);
    });

    test('on desktop (>= 450px): single click returns to main page immediately', () => {
        document.documentElement.innerHTML = `
            <div id="cont">
                <header id="site-header">
                    <h1 class="brand-title">
                        <a href="/" class="nav-back" data-page-transition><span>Zhuang Liu</span></a>
                    </h1>
                    <table id="nav"><tbody><tr><td><a href="/p1/">Link</a></td></tr></tbody></table>
                </header>
            </div>
        `;

        // Mock matchMedia for desktop (>= 450px)
        window.matchMedia = jest.fn().mockImplementation((query) => ({
            matches: query.includes('min-width: 450px'),
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));

        const initMobileDock = require('../../../js/mobile-dock.js').initMobileDock;
        initMobileDock();

        const titleLink = document.querySelector('.brand-title a');
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

        titleLink.dispatchEvent(clickEvent);

        // On desktop, the click is NOT intercepted as a dropdown toggle
        expect(clickEvent.defaultPrevented).toBe(false);
    });

    test('TDD: on mobile, top bar background is transparent when not expanded and 50% opacity backdrop blur applies when is-expanded', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        // #cont on mobile is transparent when not expanded
        expect(headerCss).toMatch(/#cont\s*\{[^}]*background:\s*transparent/);

        // #top-bar-bg is hidden on mobile (< 450px)
        expect(headerCss).toMatch(/#top-bar-bg\s*\{[^}]*display:\s*none/);

        // #cont.is-expanded covers safe-area with 50% opacity backdrop-filter
        expect(headerCss).toMatch(/#cont\.is-expanded\s*\{[^}]*backdrop-filter/);
        expect(headerCss).toMatch(
            /#cont\.is-expanded\s*\{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.5\)/
        );
    });

    test('TDD: #cont does not shift title vertically when toggling is-expanded state', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');

        // On mobile, #cont and #cont.is-expanded must have padding: 0 so inner header padding is the single source of truth
        expect(headerCss).toMatch(/#cont\s*\{[^}]*padding(-top)?:\s*0/);
        expect(headerCss).toMatch(/#cont\.is-expanded\s*\{[^}]*padding(-top)?:\s*0/);
    });

    test('TDD: mobile header dock uses constant 16px top offset to prevent scroll shift on mobile Safari', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');

        // On mobile (< 450px), header inner padding and social dock top must use fixed 16px to prevent scroll shifting
        expect(headerCss).toMatch(
            /#cont\s+(\.cont-inner|#site-header)\s*\{[^}]*padding:\s*16px 20px/
        );
        expect(headerCss).toMatch(/\.social-icons-desktop\s*\{[^}]*top:\s*16px/);

        expect(mainStyleCss).toMatch(/#main\s*\{[^}]*padding:\s*16px 20px/);
        expect(mainStyleCss).toMatch(/\.social-icons-desktop\s*\{[^}]*top:\s*16px/);
    });

    test('TDD: css/main_style.css collapses #nav on mobile by default and expands on #cont.is-expanded', () => {
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');

        expect(mainStyleCss).toMatch(/#cont\s+#nav\s*\{[^}]*display:\s*none/);
        expect(mainStyleCss).toMatch(/#cont\.is-expanded\s+#nav\s*\{[^}]*display:\s*table/);
    });

    test('TDD: index.html loads js/mobile-dock.js and supports click to expand on mobile homepage', () => {
        const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

        expect(indexHtml).toMatch(/<script\s+defer\s+src="js\/mobile-dock\.js"><\/script>/);
    });

    test('TDD: on mobile main page, #cont.is-expanded background transparency is 50% (rgba(0, 0, 0, 0.5))', () => {
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');

        // #cont.is-expanded on main page must have 50% opacity background (rgba(0, 0, 0, 0.5))
        expect(mainStyleCss).toMatch(
            /#cont\.is-expanded\s*\{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.5\)/
        );
    });

    test('TDD: css/header.css and css/main_style.css define 10% opacity for #cont.is-scrolled-down:not(.is-expanded) title and social dock', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        const mainStyleCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');

        expect(headerCss).toMatch(
            /#cont\.is-scrolled-down:not\(\.is-expanded\)\s+([^{]*)\{[^}]*opacity:\s*0\.1/
        );
        expect(mainStyleCss).toMatch(
            /#cont\.is-scrolled-down:not\(\.is-expanded\)\s+([^{]*)\{[^}]*opacity:\s*0\.1/
        );

        // Social icons container also dims to 0.1
        expect(headerCss).toMatch(
            /(\.is-scrolled-down[^{]*\.social-icons-desktop|body\.is-scrolled-down[^{]*\.social-icons-desktop)[^{]*\{[^}]*opacity:\s*0\.1/
        );
        expect(mainStyleCss).toMatch(
            /(\.is-scrolled-down[^{]*\.social-icons-desktop|body\.is-scrolled-down[^{]*\.social-icons-desktop)[^{]*\{[^}]*opacity:\s*0\.1/
        );

        // Right margin aligns at 20px matching article images
        expect(headerCss).toMatch(
            /\.social-icons-desktop\s*\{[^}]*right:\s*max\(20px,\s*env\(safe-area-inset-right,\s*20px\)\)/
        );
        expect(mainStyleCss).toMatch(
            /\.social-icons-desktop\s*\{[^}]*right:\s*max\(20px,\s*env\(safe-area-inset-right,\s*20px\)\)/
        );
    });

    test('TDD: mobile-dock.js dims title and social container on scroll down and restores opacity on scroll up, top, or bottom reach', () => {
        window.requestAnimationFrame = jest.fn();
        document.documentElement.innerHTML = `
            <div id="cont">
                <header id="site-header">
                    <h1 class="brand-title"><a href="/"><span>Zhuang Liu</span></a></h1>
                </header>
            </div>
            <div class="social-icons-container social-icons-desktop">
                <a href="https://instagram.com/lyeutsaon"><i class="fa fa-instagram"></i></a>
            </div>
        `;

        const mockAddListener = jest.fn();
        const mockAddEventListener = jest.fn();
        window.matchMedia = jest.fn().mockImplementation((query) => ({
            matches: query.includes('max-width: 449px'),
            media: query,
            onchange: null,
            addListener: mockAddListener,
            removeListener: jest.fn(),
            addEventListener: mockAddEventListener,
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));

        // Mock window.scrollY and document height
        Object.defineProperty(window, 'innerHeight', {
            value: 800,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(document.documentElement, 'scrollHeight', {
            value: 3000,
            writable: true,
            configurable: true,
        });
        window.scrollY = 0;

        const initMobileDock = require('../../../js/mobile-dock.js').initMobileDock;
        initMobileDock();

        const cont = document.getElementById('cont');
        const socialDock = document.querySelector('.social-icons-desktop');
        expect(socialDock).toBeTruthy();

        // 1. Initial state at top (scrollY = 0) -> not dimmed
        expect(cont.classList.contains('is-scrolled-down')).toBe(false);
        expect(document.body.classList.contains('is-scrolled-down')).toBe(false);

        // 2. Scroll down past threshold (scrollY = 200) -> dimmed
        window.scrollY = 200;
        window.dispatchEvent(new Event('scroll'));
        if (window.requestAnimationFrame && window.requestAnimationFrame.mock) {
            window.requestAnimationFrame.mock.calls.forEach((call) => call[0]());
            window.requestAnimationFrame.mockClear();
        }
        expect(cont.classList.contains('is-scrolled-down')).toBe(true);
        expect(document.body.classList.contains('is-scrolled-down')).toBe(true);

        // 3. Scroll up (scrollY = 150 < 200) -> restored
        window.scrollY = 150;
        window.dispatchEvent(new Event('scroll'));
        if (window.requestAnimationFrame && window.requestAnimationFrame.mock) {
            window.requestAnimationFrame.mock.calls.forEach((call) => call[0]());
            window.requestAnimationFrame.mockClear();
        }
        expect(cont.classList.contains('is-scrolled-down')).toBe(false);
        expect(document.body.classList.contains('is-scrolled-down')).toBe(false);

        // 4. Scroll down again -> dimmed
        window.scrollY = 500;
        window.dispatchEvent(new Event('scroll'));
        if (window.requestAnimationFrame && window.requestAnimationFrame.mock) {
            window.requestAnimationFrame.mock.calls.forEach((call) => call[0]());
            window.requestAnimationFrame.mockClear();
        }
        expect(cont.classList.contains('is-scrolled-down')).toBe(true);
        expect(document.body.classList.contains('is-scrolled-down')).toBe(true);

        // 5. Reach the bottom (scrollY = 2200, window.innerHeight = 800 -> 3000 = scrollHeight) -> restored
        window.scrollY = 2200;
        window.dispatchEvent(new Event('scroll'));
        if (window.requestAnimationFrame && window.requestAnimationFrame.mock) {
            window.requestAnimationFrame.mock.calls.forEach((call) => call[0]());
            window.requestAnimationFrame.mockClear();
        }
        expect(cont.classList.contains('is-scrolled-down')).toBe(false);
        expect(document.body.classList.contains('is-scrolled-down')).toBe(false);
    });
});
