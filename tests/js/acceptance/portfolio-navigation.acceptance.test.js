/**
 * @jest-environment jsdom
 *
 * Acceptance-layer tests (see docs/testing-notes.md): user-facing behaviours
 * of the portfolio pages' keyboard navigation, phrased in domain language and
 * exercised only through the public surface — a real keydown dispatched on the
 * document, and what the visitor observes (the page scrolls, the back link is
 * followed). No internal hooks (`window.__BlockNavigationForTesting`), no
 * source rewriting: the script is loaded the way a page loads it.
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_SOURCE = fs.readFileSync(
    path.resolve(__dirname, '../../../js/block-navigation.js'),
    'utf8'
);

/**
 * Build the smallest honest stand-in for a portfolio page (p1/–p4/): an intro
 * header, an article of content blocks, a back link, and a form field.
 */
function buildPortfolioPage() {
    document.body.innerHTML = `
        <div id="cont">
            <header class="intro-header"></header>
            <article class="post-content">
                <h1>Project notes</h1>
                <p>First section</p>
                <p>Second section</p>
                <p>Third section</p>
            </article>
            <a class="nav-back" href="../index.html">Back</a>
            <input type="text" aria-label="search" />
        </div>`;
}

/** Dispatch the key a visitor pressed and return the event for inspection. */
function pressKey(key) {
    const event = new window.KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
    });
    document.dispatchEvent(event);
    return event;
}

describe('a visitor reading a portfolio page', () => {
    // The blocks, in the order the visitor was taken to them.
    let visitedBlocks;
    // Listeners the script registered on the document at load time, so each
    // test can unload its script instance again (the script itself is an IIFE
    // and exposes no teardown — removing its listeners is the honest
    // equivalent of closing the page).
    let scriptListeners;

    beforeEach(() => {
        buildPortfolioPage();

        visitedBlocks = [];
        window.HTMLElement.prototype.scrollIntoView = jest.fn(function () {
            visitedBlocks.push(this);
        });
        window.scrollTo = jest.fn();

        scriptListeners = [];
        const originalAdd = document.addEventListener.bind(document);
        jest.spyOn(document, 'addEventListener').mockImplementation((type, fn, options) => {
            scriptListeners.push([type, fn]);
            originalAdd(type, fn, options);
        });

        // Load the script into the page exactly as a <script> tag would.
        window.eval(SCRIPT_SOURCE);
    });

    afterEach(() => {
        for (const [type, fn] of scriptListeners) {
            document.removeEventListener(type, fn);
        }
        document.addEventListener.mockRestore();
    });

    it('jumps down through the sections with the down arrow', () => {
        pressKey('ArrowDown');
        pressKey('ArrowDown');

        const blocks = [...document.querySelectorAll('.post-content h1, .post-content p')];
        expect(visitedBlocks).toHaveLength(2);
        // Each press takes the visitor further down the page, never back up.
        expect(blocks.indexOf(visitedBlocks[1])).toBeGreaterThan(blocks.indexOf(visitedBlocks[0]));
    });

    it('returns to the previous section with the up arrow', () => {
        pressKey('ArrowDown');
        pressKey('ArrowDown');
        pressKey('ArrowUp');

        expect(visitedBlocks[2]).toBe(visitedBlocks[0]);
    });

    it('is not yanked around while typing in a form field', () => {
        const input = document.querySelector('input');
        input.focus();

        const event = pressKey('ArrowDown');

        expect(document.activeElement).toBe(input);
        expect(event.defaultPrevented).toBe(false);
        expect(visitedBlocks).toHaveLength(0);
        expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('leaves via the back link when pressing Escape', () => {
        const backLink = document.querySelector('.nav-back');
        const followed = jest.fn((event) => event.preventDefault());
        backLink.addEventListener('click', followed);

        pressKey('Escape');

        expect(followed).toHaveBeenCalledTimes(1);
    });
});
