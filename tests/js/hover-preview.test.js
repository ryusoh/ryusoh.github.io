/**
 * @jest-environment jsdom
 */

describe('js/hover-preview.js', () => {
    let mockMatchMedia;
    let mockFetch;

    const sampleP1Html = `
        <!doctype html>
        <html>
            <head><title>I TEAR UP THE BAY</title></head>
            <body>
                <header class="intro-header"><h1>I Tear Up the Bay When I Come Through</h1></header>
                <article>
                    <div class="post-content">
                        <img src="/assets/img/p1/DSCF4775.jpg" alt="Photo 1" />
                        <img src="/assets/img/p1/DSCF8974-2.jpg" alt="Photo 2" />
                        <img src="/assets/banners/banner.png" class="mobile-banner" alt="Banner" />
                    </div>
                </article>
            </body>
        </html>
    `;

    const sampleP2Html = `
        <!doctype html>
        <html>
            <head><title>I DO NOT CARE</title></head>
            <body>
                <header class="intro-header"><h1>I Do Not Care If We Go Down in History as Barbarians</h1></header>
                <article>
                    <div class="post-content">
                        <img src="/assets/img/p2/DSCF4295-2.JPG" alt="Photo P2" />
                    </div>
                </article>
            </body>
        </html>
    `;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();

        mockFetch = jest.fn().mockImplementation((url) => {
            const urlStr = String(url);
            if (urlStr.includes('p1')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve(sampleP1Html),
                });
            }
            if (urlStr.includes('p2')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve(sampleP2Html),
                });
            }
            if (urlStr.includes('error')) {
                return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve({
                ok: false,
                status: 404,
                text: () => Promise.resolve('Not found'),
            });
        });
        global.fetch = mockFetch;

        document.body.innerHTML = `
            <div id="cont">
                <main id="main">
                    <nav aria-label="Portfolio projects">
                        <table id="nav">
                            <tbody>
                                <tr>
                                    <td class="portfolio-link">
                                        <a href="./p1/" data-page-transition data-destination="project">I Tear Up the Bay</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="portfolio-link">
                                        <a href="./p2/" data-page-transition data-destination="project">I Do Not Care</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="portfolio-link">
                                        <a href="./p3/" data-page-transition data-destination="project">Aerobatic Activities</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="portfolio-link">
                                        <a href="./p4/" data-page-transition data-destination="project">Das Gespenst</a>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </nav>
                </main>
            </div>
            <div id="hover-carousel" class="hover-carousel" aria-hidden="true">
                <div class="hover-carousel-track"></div>
            </div>
        `;

        mockMatchMedia = jest.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));
        window.matchMedia = mockMatchMedia;
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        document.body.innerHTML = '';
        delete window.__HoverPreviewForTesting;
        delete global.fetch;
        jest.restoreAllMocks();
    });

    test('fetchProjectImages auto-fetches and parses images from page HTML', async () => {
        const { fetchProjectImages } = require('../../js/hover-preview.js');
        const data = await fetchProjectImages('./p1/');
        expect(data).toBeDefined();
        expect(data.images).toEqual([
            '/assets/img/p1/DSCF4775.jpg',
            '/assets/img/p1/DSCF8974-2.jpg',
        ]);
        expect(data.images).not.toContain('/assets/banners/banner.png');
        expect(data.title).toContain('I Tear Up the Bay');
    });

    test('fetchProjectImages caches responses to avoid duplicate network calls', async () => {
        const { fetchProjectImages } = require('../../js/hover-preview.js');
        mockFetch.mockClear();
        await fetchProjectImages('./p1/');
        await fetchProjectImages('./p1/');
        expect(mockFetch).toHaveBeenCalledTimes(0); // already cached

        await fetchProjectImages('./p2/');
        await fetchProjectImages('./p2/');
        expect(mockFetch).toHaveBeenCalledTimes(0); // already cached from prefetch
    });

    test('fetchProjectImages handles fetch failure gracefully', async () => {
        const { fetchProjectImages } = require('../../js/hover-preview.js');
        const notFound = await fetchProjectImages('./404/');
        expect(notFound).toBeNull();

        const networkErr = await fetchProjectImages('./error/');
        expect(networkErr).toBeNull();
    });

    test('extractProjectId correctly identifies project IDs', () => {
        const { extractProjectId } = require('../../js/hover-preview.js');
        expect(extractProjectId('./p1/')).toBe('p1');
        expect(extractProjectId('/p2/index.html')).toBe('p2');
        expect(extractProjectId('https://example.com/p3/')).toBe('p3');
        expect(extractProjectId('P4')).toBe('p4');
        expect(extractProjectId('')).toBeNull();
        expect(extractProjectId(null)).toBeNull();
        expect(extractProjectId(undefined)).toBeNull();
        expect(extractProjectId('/other/page')).toBeNull();
    });

    test('isMobileOrTouch correctly checks media queries', () => {
        const { isMobileOrTouch } = require('../../js/hover-preview.js');
        expect(isMobileOrTouch()).toBe(false);

        mockMatchMedia.mockImplementation((query) => {
            if (query === '(max-width: 449px)') {
                return { matches: true };
            }
            return { matches: false };
        });
        expect(isMobileOrTouch()).toBe(true);

        mockMatchMedia.mockImplementation((query) => {
            if (query === '(hover: none)') {
                return { matches: true };
            }
            return { matches: false };
        });
        expect(isMobileOrTouch()).toBe(true);
    });

    test('isMobileOrTouch returns false if matchMedia is unavailable', () => {
        const originalMatchMedia = window.matchMedia;
        delete window.matchMedia;
        const { isMobileOrTouch } = require('../../js/hover-preview.js');
        expect(isMobileOrTouch()).toBe(false);
        window.matchMedia = originalMatchMedia;
    });

    test('creates hover-carousel elements if missing in DOM', () => {
        document.body.innerHTML = '<div id="cont"></div>';
        const {
            initHoverPreview,
            getCarouselEl,
            getTrackEl,
        } = require('../../js/hover-preview.js');
        initHoverPreview();

        const carouselEl = getCarouselEl();
        const trackEl = getTrackEl();
        expect(carouselEl).not.toBeNull();
        expect(trackEl).not.toBeNull();
        expect(carouselEl.id).toBe('hover-carousel');
    });

    test('creates hover-carousel attached to body if #cont is absent', () => {
        document.body.innerHTML = '';
        const { initHoverPreview, getCarouselEl } = require('../../js/hover-preview.js');
        initHoverPreview();
        expect(getCarouselEl()).not.toBeNull();
        expect(document.body.contains(getCarouselEl())).toBe(true);
    });

    test('shows preview on link mouseenter and focus with auto-fetched images', async () => {
        const {
            getCarouselEl,
            getActiveProjectId,
            getTrackEl,
            fetchProjectImages,
        } = require('../../js/hover-preview.js');

        const p1Link = document.querySelector('a[href="./p1/"]');
        const carouselEl = getCarouselEl();
        const trackEl = getTrackEl();

        await fetchProjectImages('./p1/');
        p1Link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

        expect(carouselEl.classList.contains('is-active')).toBe(true);
        expect(carouselEl.getAttribute('aria-hidden')).toBe('false');
        expect(getActiveProjectId()).toBe('p1');
        expect(trackEl.children.length).toBeGreaterThan(0);

        const firstImg = trackEl.querySelector('img');
        expect(firstImg.getAttribute('src')).toBe('/assets/img/p1/DSCF4775.jpg');
        expect(firstImg.getAttribute('loading')).toBe('eager');
    });

    test('switching between project links updates thumbnails without closing', async () => {
        const {
            getActiveProjectId,
            getTrackEl,
            fetchProjectImages,
        } = require('../../js/hover-preview.js');

        const p1Link = document.querySelector('a[href="./p1/"]');
        const p2Link = document.querySelector('a[href="./p2/"]');
        const trackEl = getTrackEl();

        await fetchProjectImages('./p1/');
        await fetchProjectImages('./p2/');

        p1Link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(getActiveProjectId()).toBe('p1');
        const p1Html = trackEl.innerHTML;

        p2Link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(getActiveProjectId()).toBe('p2');
        expect(trackEl.innerHTML).not.toBe(p1Html);

        // Hovering same project again does not re-render
        p2Link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(getActiveProjectId()).toBe('p2');
    });

    test('schedules hide on link mouseleave and hides after timer', () => {
        const {
            getCarouselEl,
            getActiveProjectId,
            initHoverPreview,
        } = require('../../js/hover-preview.js');
        initHoverPreview();

        const p1Link = document.querySelector('a[href="./p1/"]');
        const carouselEl = getCarouselEl();

        p1Link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(carouselEl.classList.contains('is-active')).toBe(true);

        p1Link.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        expect(carouselEl.classList.contains('is-active')).toBe(true);

        jest.advanceTimersByTime(250);
        expect(carouselEl.classList.contains('is-active')).toBe(false);
        expect(carouselEl.getAttribute('aria-hidden')).toBe('true');
        expect(getActiveProjectId()).toBeNull();
    });

    test('focus and blur on link toggle preview', () => {
        const { getCarouselEl, initHoverPreview } = require('../../js/hover-preview.js');
        initHoverPreview();

        const p1Link = document.querySelector('a[href="./p1/"]');
        const carouselEl = getCarouselEl();

        p1Link.dispatchEvent(new Event('focus'));
        expect(carouselEl.classList.contains('is-active')).toBe(true);

        p1Link.dispatchEvent(new Event('blur'));
        jest.advanceTimersByTime(250);
        expect(carouselEl.classList.contains('is-active')).toBe(false);
    });

    test('hovering over the carousel container cancels hide and pauses drift', () => {
        const {
            getCarouselEl,
            getIsPaused,
            initHoverPreview,
        } = require('../../js/hover-preview.js');
        initHoverPreview();

        const p1Link = document.querySelector('a[href="./p1/"]');
        const carouselEl = getCarouselEl();

        p1Link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        p1Link.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

        // Before timer expires, enter carousel container
        carouselEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(getIsPaused()).toBe(true);

        jest.advanceTimersByTime(300);
        expect(carouselEl.classList.contains('is-active')).toBe(true);

        // Leaving carousel container resumes pause and schedules hide
        carouselEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        expect(getIsPaused()).toBe(false);

        jest.advanceTimersByTime(250);
        expect(carouselEl.classList.contains('is-active')).toBe(false);
    });

    test('wheel event scrolls track and wraps around', async () => {
        const {
            setScrollPos,
            getScrollPos,
            getTrackEl,
            measureTrack,
            initHoverPreview,
        } = require('../../js/hover-preview.js');
        initHoverPreview();

        const p1Link = document.querySelector('a[href="./p1/"]');
        p1Link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();

        const carouselEl = document.getElementById('hover-carousel');
        const trackEl = getTrackEl();

        Object.defineProperty(trackEl, 'scrollHeight', { value: 1000, configurable: true });
        for (let i = 0; i < trackEl.children.length; i++) {
            Object.defineProperty(trackEl.children[i], 'offsetHeight', {
                value: 100,
                configurable: true,
            });
        }
        measureTrack();

        const wheelEvent = new Event('wheel', { bubbles: true, cancelable: true });
        Object.defineProperty(wheelEvent, 'deltaY', { value: 50 });

        carouselEl.dispatchEvent(wheelEvent);
        expect(getScrollPos()).toBeGreaterThan(0);

        // Scroll positive past singleSetHeight
        const wheelLargeEvent = new Event('wheel', { bubbles: true, cancelable: true });
        Object.defineProperty(wheelLargeEvent, 'deltaY', { value: 3000 });
        carouselEl.dispatchEvent(wheelLargeEvent);
        expect(getScrollPos()).toBeGreaterThan(0);

        // Scroll negative (upwards) wraps around
        setScrollPos(10);
        const wheelUpEvent = new Event('wheel', { bubbles: true, cancelable: true });
        Object.defineProperty(wheelUpEvent, 'deltaY', { value: -100 });
        carouselEl.dispatchEvent(wheelUpEvent);
        expect(getScrollPos()).toBeGreaterThan(0);
    });

    test('wheel event does nothing if singleSetHeight is 0', () => {
        const { getScrollPos } = require('../../js/hover-preview.js');
        const carouselEl = document.getElementById('hover-carousel');
        const wheelEvent = new Event('wheel', { bubbles: true, cancelable: true });
        Object.defineProperty(wheelEvent, 'deltaY', { value: 50 });
        carouselEl.dispatchEvent(wheelEvent);
        expect(getScrollPos()).toBe(0);
    });

    test('drift loop advances scroll position when unpaused', async () => {
        const {
            updateDrift,
            getScrollPos,
            setScrollPos,
            measureTrack,
            getTrackEl,
            setIsPaused,
            initHoverPreview,
        } = require('../../js/hover-preview.js');
        initHoverPreview();

        const p1Link = document.querySelector('a[href="./p1/"]');
        p1Link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();

        const trackEl = getTrackEl();
        Object.defineProperty(trackEl, 'scrollHeight', { value: 200, configurable: true });
        for (let i = 0; i < trackEl.children.length; i++) {
            Object.defineProperty(trackEl.children[i], 'offsetHeight', {
                value: 50,
                configurable: true,
            });
        }
        measureTrack();

        setScrollPos(10);
        setIsPaused(false);
        updateDrift();
        expect(getScrollPos()).toBe(10.5);

        // Wrap around test
        setScrollPos(2000);
        updateDrift();
        expect(getScrollPos()).toBeLessThan(2000);
    });

    test('stopDrift cancels animation frame', () => {
        const { startDrift, stopDrift } = require('../../js/hover-preview.js');
        const spyCancel = jest.spyOn(window, 'cancelAnimationFrame');
        startDrift();
        stopDrift();
        expect(spyCancel).toHaveBeenCalled();
    });

    test('showPreview returns early on mobile / touch devices', () => {
        mockMatchMedia.mockReturnValue({ matches: true });
        const { showPreview, getCarouselEl } = require('../../js/hover-preview.js');
        showPreview('p1', './p1/');
        expect(getCarouselEl().classList.contains('is-active')).toBe(false);
    });

    test('DOMContentLoaded event listener initializes preview if readyState is loading', () => {
        let domReadyCb = null;
        jest.spyOn(document, 'addEventListener').mockImplementation((event, fn) => {
            if (event === 'DOMContentLoaded') {
                domReadyCb = fn;
            }
        });
        Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });

        require('../../js/hover-preview.js');
        expect(domReadyCb).toBeInstanceOf(Function);
        domReadyCb();

        Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
    });

    test('measureTrack handles null trackEl and 0/1 children', () => {
        const { measureTrack, getTrackEl } = require('../../js/hover-preview.js');
        const trackEl = getTrackEl();

        // 0 children
        trackEl.innerHTML = '';
        measureTrack();

        // 1 child
        trackEl.innerHTML = '<div></div>';
        measureTrack();
    });

    test('renderProjectThumbnails handles empty data gracefully', () => {
        const { renderProjectThumbnails } = require('../../js/hover-preview.js');
        expect(() => {
            renderProjectThumbnails({ url: './p1/', title: 'Test', images: [] });
        }).not.toThrow();
    });

    test('scheduleHide and cancelHide clear active timers properly', () => {
        const {
            scheduleHide,
            cancelHide,
            showPreview,
            getCarouselEl,
            initHoverPreview,
        } = require('../../js/hover-preview.js');
        initHoverPreview();

        scheduleHide(100);
        scheduleHide(200); // clears previous timer
        cancelHide();

        // Calling showPreview when timer is active clears timer
        scheduleHide(300);
        showPreview('p1', './p1/');
        expect(getCarouselEl().classList.contains('is-active')).toBe(true);
    });

    test('skips links with no matching project id during init', () => {
        document.body.innerHTML = `
            <div id="cont">
                <nav>
                    <div class="portfolio-link">
                        <a href="/about/">About</a>
                    </div>
                </nav>
            </div>
            <div id="hover-carousel"><div class="hover-carousel-track"></div></div>
        `;
        const { initHoverPreview } = require('../../js/hover-preview.js');
        expect(() => {
            initHoverPreview();
        }).not.toThrow();
    });
});
