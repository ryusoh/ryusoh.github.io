/**
 * js/hover-preview.js
 * Automatically fetches and displays a vertical thumbnail carousel
 * on the right side of #cont when hovering or focusing portfolio links.
 */

(function () {
    'use strict';

    /**
     * Cache storing parsed project metadata (title, images, url, thumbhashes).
     * @type {Map<string, { url: string, title: string, images: string[], thumbhashes?: string[] }>}
     */
    const projectCache = new Map();

    /**
     * Cache for active in-flight fetch promises.
     * @type {Map<string, Promise<{ url: string, title: string, images: string[], thumbhashes?: string[] } | null>>}
     */
    const fetchPromises = new Map();

    /**
     * Checks if current viewport or device is mobile / touch.
     * @returns {boolean}
     */
    function isMobileOrTouch() {
        if (typeof window === 'undefined' || !window.matchMedia) {
            return false;
        }
        const isNarrow = window.matchMedia('(max-width: 449px)').matches;
        const isHoverNone = window.matchMedia('(hover: none)').matches;
        return isNarrow || isHoverNone;
    }

    /**
     * Extracts project ID (e.g. 'p1', 'p2', 'p3', 'p4') from a URL string.
     * @param {string | null | undefined} href
     * @returns {string | null}
     */
    function extractProjectId(href) {
        if (!href) {
            return null;
        }
        const match = href.match(/p\d+/i);
        return match ? match[0].toLowerCase() : null;
    }

    /**
     * Pre-decodes an image off the main thread for instant GPU rendering.
     * @param {string} src
     */
    function prefetchImage(src) {
        /* istanbul ignore else */
        if (typeof Image !== 'undefined') {
            const img = new Image();
            img.src = src;
            /* istanbul ignore else */
            if (typeof img.decode === 'function') {
                img.decode().catch(() => {});
            }
        }
    }

    /**
     * Converts a raw full-resolution image URL to its lightweight 768w responsive thumbnail variant.
     * @param {string | null | undefined} src
     * @returns {string | null}
     */
    function toThumbnailUrl(src) {
        if (!src || typeof src !== 'string') {
            return null;
        }
        if (/\/assets\/img\/p\d+\//i.test(src) && !/-768\.(webp|avif)$/i.test(src)) {
            return src.replace(/\.(jpe?g|png|webp|avif)$/i, '-768.webp');
        }
        return src;
    }

    /**
     * Parses HTML content of a project page to extract content images and title.
     * @param {string} html
     * @param {string} pageUrl
     * @returns {{ url: string, title: string, images: string[], thumbhashes?: string[] } | null}
     */
    function parseProjectHtml(html, pageUrl) {
        let title = '';
        /** @type {string[]} */
        const images = [];
        /** @type {string[]} */
        const thumbhashes = [];

        /* istanbul ignore else */
        if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
            const parser = new window.DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const headingEl = doc.querySelector('header.intro-header h1, article h1, #main h1, h1');
            const titleEl = doc.querySelector('title');
            title =
                (headingEl && headingEl.textContent ? headingEl.textContent.trim() : '') ||
                (titleEl && titleEl.textContent ? titleEl.textContent.trim() : '');

            const imgElements = doc.querySelectorAll('article img, .post-content img');
            for (let i = 0; i < imgElements.length; i++) {
                const img = imgElements[i];
                if (img.classList.contains('mobile-banner')) {
                    continue;
                }
                const rawSrc = img.getAttribute('src');
                if (rawSrc && !rawSrc.includes('banner') && !rawSrc.includes('icon')) {
                    const thumbSrc = toThumbnailUrl(rawSrc);
                    if (thumbSrc && !images.includes(thumbSrc)) {
                        images.push(thumbSrc);
                        const hash = img.getAttribute('data-thumbhash');
                        thumbhashes.push(hash || '');
                    }
                }
            }
        }

        return images.length > 0
            ? { url: pageUrl, title: title || 'Project', images, thumbhashes }
            : null;
    }

    /**
     * Auto-fetches and extracts project images from the given page URL.
     * @param {string} url
     * @returns {Promise<{ url: string, title: string, images: string[], thumbhashes?: string[] } | null>}
     */
    function fetchProjectImages(url) {
        const normalizedUrl = url.trim();
        if (projectCache.has(normalizedUrl)) {
            return Promise.resolve(
                /** @type {{ url: string, title: string, images: string[], thumbhashes?: string[] }} */ (
                    projectCache.get(normalizedUrl)
                )
            );
        }
        if (fetchPromises.has(normalizedUrl)) {
            return /** @type {Promise<{ url: string, title: string, images: string[], thumbhashes?: string[] } | null>} */ (
                fetchPromises.get(normalizedUrl)
            );
        }

        /* istanbul ignore if */
        if (typeof fetch === 'undefined') {
            return Promise.resolve(null);
        }

        const promise = fetch(normalizedUrl)
            .then((res) => {
                if (!res.ok) {
                    return null;
                }
                return res.text();
            })
            .then((html) => {
                if (!html) {
                    return null;
                }
                const parsed = parseProjectHtml(html, normalizedUrl);
                if (parsed) {
                    projectCache.set(normalizedUrl, parsed);
                    const projectId = extractProjectId(normalizedUrl);
                    if (projectId) {
                        projectCache.set(projectId, parsed);
                    }
                    // Warm up browser & GPU decode cache for first 4 images
                    const preloadCount = Math.min(parsed.images.length, 4);
                    for (let i = 0; i < preloadCount; i++) {
                        prefetchImage(parsed.images[i]);
                    }
                }
                return parsed;
            })
            .catch(() => null)
            .finally(() => {
                fetchPromises.delete(normalizedUrl);
            });

        fetchPromises.set(normalizedUrl, promise);
        return promise;
    }

    /**
     * @type {HTMLElement | null}
     */
    let carouselEl = null;

    /**
     * @type {HTMLElement | null}
     */
    let trackEl = null;

    /**
     * @type {string | null}
     */
    let activeProjectId = null;

    /**
     * @type {ReturnType<typeof setTimeout> | null}
     */
    let hideTimer = null;

    /**
     * @type {number}
     */
    let scrollPos = 0;

    /**
     * @type {number}
     */
    let singleSetHeight = 0;

    /**
     * @type {boolean}
     */
    let isPaused = false;

    /**
     * @type {number | null}
     */
    let animationFrameId = null;

    /**
     * Animation loop for continuous vertical drift.
     */
    function updateDrift() {
        if (!isPaused && trackEl && singleSetHeight > 0) {
            scrollPos += 0.5;
            if (scrollPos >= singleSetHeight) {
                scrollPos -= singleSetHeight;
            }
            trackEl.style.transform = `translate3d(0, ${-scrollPos}px, 0)`;
        }
        /* istanbul ignore else */
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            animationFrameId = window.requestAnimationFrame(updateDrift);
        }
    }

    /**
     * Starts the auto-drift animation.
     */
    function startDrift() {
        /* istanbul ignore else */
        if (
            animationFrameId === null &&
            typeof window !== 'undefined' &&
            typeof window.requestAnimationFrame === 'function'
        ) {
            animationFrameId = window.requestAnimationFrame(updateDrift);
        }
    }

    /**
     * Stops the auto-drift animation.
     */
    function stopDrift() {
        /* istanbul ignore else */
        if (
            animationFrameId !== null &&
            typeof window !== 'undefined' &&
            typeof window.cancelAnimationFrame === 'function'
        ) {
            window.cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    /**
     * Measures the single set height of items for seamless loop calculations.
     */
    function measureTrack() {
        /* istanbul ignore if */
        if (!trackEl) {
            singleSetHeight = 0;
            return;
        }
        const totalItems = trackEl.children.length;
        if (totalItems <= 1) {
            singleSetHeight = trackEl.scrollHeight;
            return;
        }
        const halfCount = Math.floor(totalItems / 2);
        let height = 0;
        const fallbackItemHeight = 110;
        for (let i = 0; i < halfCount; i++) {
            const child = /** @type {HTMLElement} */ (trackEl.children[i]);
            /* istanbul ignore else */
            if (child) {
                const itemH = child.offsetHeight > 0 ? child.offsetHeight + 10 : fallbackItemHeight;
                height += itemH;
            }
        }
        singleSetHeight = height > 0 ? height : halfCount * fallbackItemHeight;
    }

    /**
     * Renders thumbnails for a project into the carousel track.
     * @param {{ url: string, title: string, images: string[], thumbhashes?: string[] }} data
     */
    function renderProjectThumbnails(data) {
        /* istanbul ignore if */
        if (!trackEl) {
            return;
        }
        /* istanbul ignore if */
        if (!data || !data.images || data.images.length === 0) {
            return;
        }

        // Render duplicate sets to allow seamless infinite vertical drift
        const imagesList = [...data.images, ...data.images];
        const thumbhashesList = data.thumbhashes ? [...data.thumbhashes, ...data.thumbhashes] : [];
        trackEl.innerHTML = '';
        for (let i = 0; i < imagesList.length; i++) {
            const src = imagesList[i];
            const hash = thumbhashesList[i] || '';
            const isEager = i < 4;

            const a = document.createElement('a');
            a.href = data.url;
            a.className = 'hover-carousel-item';
            a.setAttribute('data-page-transition', '');
            a.setAttribute('data-destination', 'project');
            a.setAttribute('aria-label', data.title + ' thumbnail ' + (i + 1));

            const img = document.createElement('img');
            img.src = src;
            if (hash) {
                img.setAttribute('data-thumbhash', hash);
            }
            img.alt = data.title;
            img.setAttribute('loading', isEager ? 'eager' : 'lazy');
            img.setAttribute('decoding', 'async');

            a.appendChild(img);
            trackEl.appendChild(a);
        }
        scrollPos = 0;
        trackEl.style.transform = 'translate3d(0, 0, 0)';

        // Apply ThumbHash placeholders if ThumbHashInit is available
        /* istanbul ignore else */
        if (
            typeof window !== 'undefined' &&
            window.ThumbHashInit &&
            typeof window.ThumbHashInit.init === 'function'
        ) {
            window.ThumbHashInit.init(trackEl);
        }

        // Attach smooth fade-in listeners to rendered images
        const imgElements = trackEl.querySelectorAll('img');
        for (let i = 0; i < imgElements.length; i++) {
            const img = imgElements[i];
            if (img.complete && img.naturalWidth > 0) {
                img.classList.add('is-loaded');
            } else {
                img.addEventListener(
                    'load',
                    () => {
                        img.classList.add('is-loaded');
                    },
                    { once: true }
                );
            }
        }

        // Measure once images/DOM is inserted
        measureTrack();
    }

    /**
     * Shows the thumbnail preview carousel for a given project.
     * @param {string} projectId
     * @param {string} [href]
     */
    function showPreview(projectId, href) {
        if (isMobileOrTouch()) {
            return;
        }

        if (hideTimer !== null) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }

        /* istanbul ignore if */
        if (!carouselEl) {
            return;
        }

        const projectUrl = href || projectId;
        const cachedData = projectCache.get(projectId) || projectCache.get(projectUrl);

        if (cachedData) {
            if (activeProjectId !== projectId) {
                activeProjectId = projectId;
                renderProjectThumbnails(cachedData);
            }
            carouselEl.classList.add('is-active');
            carouselEl.setAttribute('aria-hidden', 'false');
            startDrift();
        } else {
            activeProjectId = projectId;
            carouselEl.classList.add('is-active');
            carouselEl.setAttribute('aria-hidden', 'false');
            fetchProjectImages(projectUrl).then((data) => {
                if (data && activeProjectId === projectId) {
                    renderProjectThumbnails(data);
                    startDrift();
                }
            });
        }
    }

    /**
     * Schedules hiding the preview carousel with a grace period.
     * @param {number} [delay]
     */
    function scheduleHide(delay = 200) {
        if (hideTimer !== null) {
            clearTimeout(hideTimer);
        }
        hideTimer = setTimeout(() => {
            hidePreview();
        }, delay);
    }

    /**
     * Cancels any pending hide timer.
     */
    function cancelHide() {
        if (hideTimer !== null) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
    }

    /**
     * Immediately hides the preview carousel.
     */
    function hidePreview() {
        if (hideTimer !== null) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        if (carouselEl) {
            carouselEl.classList.remove('is-active');
            carouselEl.setAttribute('aria-hidden', 'true');
        }
        activeProjectId = null;
        stopDrift();
    }

    /**
     * Initializes hover preview functionality on the page.
     */
    function initHoverPreview() {
        carouselEl = document.getElementById('hover-carousel');
        if (!carouselEl) {
            carouselEl = document.createElement('div');
            carouselEl.id = 'hover-carousel';
            carouselEl.className = 'hover-carousel';
            carouselEl.setAttribute('aria-hidden', 'true');
            const cont = document.getElementById('cont');
            if (cont && cont.parentNode) {
                cont.parentNode.insertBefore(carouselEl, cont.nextSibling);
            } else {
                document.body.appendChild(carouselEl);
            }
        }

        trackEl = carouselEl.querySelector('.hover-carousel-track');
        if (!trackEl) {
            trackEl = document.createElement('div');
            trackEl.className = 'hover-carousel-track';
            carouselEl.appendChild(trackEl);
        }

        // Carousel container hover interactions
        carouselEl.addEventListener('mouseenter', () => {
            cancelHide();
            isPaused = true;
        });

        carouselEl.addEventListener('mouseleave', () => {
            isPaused = false;
            scheduleHide(180);
        });

        // Wheel scrolling support inside carousel
        carouselEl.addEventListener(
            'wheel',
            (event) => {
                if (!trackEl || singleSetHeight <= 0) {
                    return;
                }
                event.preventDefault();
                scrollPos += event.deltaY * 0.8;
                while (scrollPos >= singleSetHeight) {
                    scrollPos -= singleSetHeight;
                }
                while (scrollPos < 0) {
                    scrollPos += singleSetHeight;
                }
                trackEl.style.transform = `translate3d(0, ${-scrollPos}px, 0)`;
            },
            { passive: false }
        );

        // Bind portfolio links inside navigation
        const portLinks = document.querySelectorAll(
            '#nav .portfolio-link a, .portfolio-link a, #nav a[data-destination="project"]'
        );

        for (let i = 0; i < portLinks.length; i++) {
            const link = portLinks[i];
            const href = link.getAttribute('href');
            const projectId = extractProjectId(href);
            if (!projectId || !href) {
                continue;
            }

            // Auto-prefetch in background so images are available before first hover
            fetchProjectImages(href);

            link.addEventListener('mouseenter', () => {
                showPreview(projectId, href);
            });

            link.addEventListener('mouseleave', () => {
                scheduleHide(200);
            });

            link.addEventListener('focus', () => {
                showPreview(projectId, href);
            });

            link.addEventListener('blur', () => {
                scheduleHide(200);
            });
        }
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initHoverPreview);
        } else {
            initHoverPreview();
        }
    }

    const testing = {
        projectCache,
        toThumbnailUrl,
        parseProjectHtml,
        fetchProjectImages,
        prefetchImage,
        isMobileOrTouch,
        extractProjectId,
        initHoverPreview,
        showPreview,
        hidePreview,
        scheduleHide,
        cancelHide,
        renderProjectThumbnails,
        updateDrift,
        startDrift,
        stopDrift,
        measureTrack,
        getCarouselEl: () => carouselEl,
        getTrackEl: () => trackEl,
        getActiveProjectId: () => activeProjectId,
        getScrollPos: () => scrollPos,
        setScrollPos: (/** @type {number} */ val) => {
            scrollPos = val;
        },
        getIsPaused: () => isPaused,
        setIsPaused: (/** @type {boolean} */ val) => {
            isPaused = val;
        },
    };

    /* istanbul ignore else */
    if (typeof window !== 'undefined') {
        window.__HoverPreviewForTesting = testing;
    }

    /* eslint-disable no-undef */
    /* istanbul ignore else */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = testing;
    }
    /* eslint-enable no-undef */
})();
