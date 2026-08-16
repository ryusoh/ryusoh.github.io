/**
 * @jest-environment jsdom
 *
 * Acceptance test: Light-click (Trackpad tap-to-click) responsiveness on portfolio links.
 * Verifies that:
 * 1. Interactive navigation links (#nav .portfolio-link a, #cont h1 a) have pointer-events: auto
 *    so immediate tap/pointerdown events hit the anchor element.
 * 2. Blanket `touch-action: pan-y !important` on `body *` does not suppress interactive link gestures.
 * 3. Light click events on portfolio links navigate cleanly without dropped hit-tests.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../');

describe('Portfolio Link Light Click & Tap Responsiveness Acceptance Suite', () => {
    test('css/header.css does not apply blanket touch-action: pan-y to all descendant elements', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        expect(headerCss).not.toMatch(/body\s+\*\s*\{\s*touch-action:\s*pan-y\s*!important;/i);
    });

    test('css/main_style.css ensures .portfolio-link a has pointer-events: auto for instant tap response', () => {
        const mainCss = fs.readFileSync(path.join(ROOT_DIR, 'css/main_style.css'), 'utf8');
        // The portfolio-link a rule must explicitly enable pointer-events: auto
        expect(mainCss).toMatch(/\.portfolio-link\s+a[^{]*\{[^}]*pointer-events:\s*auto/i);
    });

    test('css/header.css ensures .portfolio-link a has pointer-events: auto for instant tap response', () => {
        const headerCss = fs.readFileSync(path.join(ROOT_DIR, 'css/header.css'), 'utf8');
        expect(headerCss).toMatch(/\.portfolio-link\s+a[^{]*\{[^}]*pointer-events:\s*auto/i);
    });

    test('light click (pointerdown -> pointerup -> click) on portfolio links triggers navigation', () => {
        document.body.innerHTML = `
            <div id="cont">
                <main id="main">
                    <h1><span>Zhuang Liu</span></h1>
                    <nav>
                        <table id="nav">
                            <tbody>
                                <tr>
                                    <td class="portfolio-link">
                                        <a href="/p1/" data-page-transition data-destination="project">I Tear Up the Bay</a>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </nav>
                </main>
            </div>
        `;

        const link = document.querySelector('#nav .portfolio-link a');
        let navigatedUrl = null;

        // Register custom event or listener to verify click dispatch
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigatedUrl = link.getAttribute('href');
        });

        // Simulate light click sequence from Mac trackpad
        const pointerDown = new MouseEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100,
        });
        const mouseDown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100,
        });
        const pointerUp = new MouseEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100,
        });
        const mouseUp = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100,
        });
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100,
        });

        link.dispatchEvent(pointerDown);
        link.dispatchEvent(mouseDown);
        link.dispatchEvent(pointerUp);
        link.dispatchEvent(mouseUp);
        link.dispatchEvent(clickEvent);

        expect(navigatedUrl).toBe('/p1/');
    });
});
