'use strict';

(function () {
    const KEY_FORWARD = new Set(['ArrowRight', 'ArrowDown']);
    const KEY_BACKWARD = new Set(['ArrowLeft', 'ArrowUp']);
    const NODE_FILTER_SHOW_ELEMENT =
        (typeof window !== 'undefined' && window.NodeFilter && window.NodeFilter.SHOW_ELEMENT) || 1;
    let blocks = [];
    let blockPositions = []; // Used for fallback
    let topSentinel = null;
    let currentIndex = -1;
    let pendingIndex = null;
    let pendingTimeout = null;
    let observer = null;
    let useObserver = false;
    const visibleBlocks = new Set(); // To track blocks active at the probe line

    /**
     * Ensure we run init when DOM is ready.
     */
    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function isEditableActive() {
        const active = document.activeElement;
        if (!active) {
            return false;
        }

        const tagName = active.tagName;
        return (
            active.isContentEditable ||
            tagName === 'INPUT' ||
            tagName === 'TEXTAREA' ||
            tagName === 'SELECT'
        );
    }

    function shouldUseElement(element) {
        if (!element) {
            return false;
        }

        if (element.matches('script, style, noscript')) {
            return false;
        }

        if (element.closest('[data-block-nav="ignore"]')) {
            return false;
        }

        if (element.matches('[data-block-nav="block"]')) {
            return true;
        }

        if (element.closest('[data-block-nav="block"]')) {
            return false;
        }

        if (element.matches('.intro-header')) {
            return true;
        }

        if (element.matches('.post-heading') && element.closest('.intro-header')) {
            return false;
        }

        if (
            element.matches(
                [
                    '.post-heading',
                    '.post-content h1',
                    '.post-content h2',
                    '.post-content h3',
                    '.post-content h4',
                    '.post-content h5',
                    '.post-content h6',
                    '.post-content p',
                    '.post-content img',
                    '.post-content figure',
                    '.post-content blockquote',
                    '.post-content li',
                    '.post-content pre',
                    '.post-content table',
                    '.post-content video',
                    '.post-content .visual-block',
                ].join(', ')
            )
        ) {
            return true;
        }

        return false;
    }

    function isParagraphElement(element) {
        return (
            element && typeof element.matches === 'function' && element.matches('.post-content p')
        );
    }

    function collectBlocks() {
        const walker = document.createTreeWalker(document.body, NODE_FILTER_SHOW_ELEMENT);
        const ordered = [];
        const seen = new Set();

        while (walker.nextNode()) {
            const element = walker.currentNode;
            if (!shouldUseElement(element)) {
                continue;
            }
            if (seen.has(element)) {
                continue;
            }

            const lastElement = ordered.length ? ordered[ordered.length - 1] : null;
            const shouldGroupParagraph =
                isParagraphElement(element) &&
                lastElement &&
                isParagraphElement(lastElement) &&
                lastElement.parentElement === element.parentElement;
            if (shouldGroupParagraph) {
                seen.add(element);
                continue;
            }

            ordered.push(element);
            seen.add(element);
        }

        return ordered;
    }

    // Fallback: the original updatePositions implementation for older browsers
    function updatePositions() {
        if (!blocks.length) {
            blockPositions = [];
            syncCurrentIndex();
            return;
        }

        const scrollY = window.scrollY;
        blockPositions = blocks.map((element) => {
            if (topSentinel && element === topSentinel) {
                return 0;
            }
            return element.getBoundingClientRect().top + scrollY;
        });
        syncCurrentIndex();
    }

    function setupIntersectionObserver() {
        if (typeof window.IntersectionObserver === 'undefined') {
            useObserver = false;
            return;
        }

        useObserver = true;

        if (observer) {
            observer.disconnect();
        }
        visibleBlocks.clear();

        // We want to detect which block spans across the 25% probe line.
        // The original logic checks: probe >= blockPositions[i]
        // Which means we find the last block whose top edge is ABOVE the probe line.
        // We can create a 0-height intersection root margin exactly at 25% of the viewport.
        // If an element intersects this line, it is the active block.
        // Since we want the rootMargin to be exactly at 25% from top:
        // top margin = -25%, bottom margin = -75% (viewport height - 25%).
        const options = {
            root: null,
            rootMargin: '-25% 0px -75% 0px',
            threshold: 0,
        };

        observer = new window.IntersectionObserver((entries) => {
            let changed = false;
            entries.forEach((entry) => {
                const target = entry.target;
                if (entry.isIntersecting) {
                    visibleBlocks.add(target);
                    changed = true;
                } else {
                    visibleBlocks.delete(target);
                    changed = true;
                }
            });

            if (changed) {
                syncCurrentIndex();
            }
        }, options);

        blocks.forEach((block) => observer.observe(block));
    }

    function refreshBlocks() {
        const contentBlocks = collectBlocks();
        topSentinel = document.body || document.documentElement || null;
        blocks = topSentinel ? [topSentinel].concat(contentBlocks) : contentBlocks;

        setupIntersectionObserver();

        if (!useObserver) {
            updatePositions();
        } else {
            syncCurrentIndex();
        }
    }

    function syncCurrentIndex() {
        if (pendingIndex !== null) {
            return;
        }
        currentIndex = getCurrentIndex();
    }

    function getCurrentIndex() {
        if (!blocks.length) {
            return -1;
        }

        if (topSentinel && window.scrollY <= 1) {
            return 0;
        }

        const docHeight = Math.max(
            document.body ? document.body.scrollHeight : 0,
            document.documentElement ? document.documentElement.scrollHeight : 0
        );
        const atBottom = docHeight > 0 && window.scrollY + window.innerHeight >= docHeight - 1;
        if (atBottom) {
            return blocks.length - 1;
        }

        if (useObserver) {
            if (visibleBlocks.size === 0) {
                // If nothing is intersecting the probe line (e.g. gaps between elements),
                // we keep the current index.
                return currentIndex !== -1 ? currentIndex : 0;
            }

            // If multiple blocks intersect the 0px line at 25% (unlikely but possible with 0 height blocks),
            // or if we have overlapping elements, pick the highest index (last one in DOM) to match the original loop logic
            // (the loop does `if (probe >= blockPositions[i]) currentIndex = i;` which naturally takes the highest index).
            let bestIndex = 0;
            visibleBlocks.forEach((element) => {
                const index = blocks.indexOf(element);
                if (index > bestIndex) {
                    bestIndex = index;
                }
            });
            return bestIndex;
        }

        // Fallback logic
        if (!blockPositions.length) {
            return -1;
        }
        const probe = window.scrollY + window.innerHeight * 0.25;
        let bestIndex = 0;
        for (let i = 0; i < blockPositions.length; i += 1) {
            if (probe >= blockPositions[i]) {
                bestIndex = i;
            } else {
                break;
            }
        }
        return bestIndex;
    }

    function clampScrollTop(value) {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (!Number.isFinite(maxScroll) || maxScroll < 0) {
            return Math.max(0, value);
        }
        return Math.max(0, Math.min(value, maxScroll));
    }

    function startPending(index, behavior) {
        const delay = behavior === 'auto' ? 150 : 600;
        pendingIndex = index;
        clearTimeout(pendingTimeout);
        pendingTimeout = setTimeout(() => {
            pendingIndex = null;
            syncCurrentIndex();
        }, delay);
    }

    function scrollToIndex(index) {
        if (index < 0 || index >= blocks.length) {
            return;
        }

        const target = blocks[index];
        const isTopSentinel = topSentinel && target === topSentinel;
        const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
        const isFirstContentBlock = index <= (topSentinel ? 1 : 0);

        if (isTopSentinel) {
            window.scrollTo({
                top: 0,
                behavior,
            });
            startPending(index, behavior);
            return;
        }

        const rect = target.getBoundingClientRect();
        const elementHeight = rect.height || target.offsetHeight || 0;

        try {
            target.scrollIntoView({
                behavior,
                block: isFirstContentBlock ? 'start' : 'center',
                inline: 'nearest',
            });
        } catch (error) {
            void error;
            const offset = isFirstContentBlock
                ? 0
                : Math.max(0, (window.innerHeight - Math.max(elementHeight, 1)) / 2);
            // Use rect.top directly since we have it, plus window.scrollY
            const top = clampScrollTop(rect.top + window.scrollY - offset);
            window.scrollTo({
                top,
                behavior,
            });
        }

        startPending(index, behavior);
    }

    function handleKeydown(event) {
        if (isEditableActive()) {
            return;
        }

        if (!KEY_FORWARD.has(event.key) && !KEY_BACKWARD.has(event.key)) {
            return;
        }

        if (!blocks.length) {
            return;
        }

        const delta = KEY_FORWARD.has(event.key) ? 1 : -1;
        let startIndex = currentIndex === -1 ? getCurrentIndex() : currentIndex;
        if (startIndex === -1) {
            startIndex = 0;
        }
        const nextIndex = Math.min(Math.max(startIndex + delta, 0), blocks.length - 1);

        event.preventDefault();

        if (nextIndex === startIndex) {
            return;
        }

        currentIndex = nextIndex;
        scrollToIndex(nextIndex);
    }

    /**
     * Optimized debounce that aligns execution with the browser's render cycle using requestAnimationFrame.
     *
     * ⚡ Bolt Optimization:
     * - What: Wrap the final delayed execution in `requestAnimationFrame`.
     * - Why: The original `debounce` used only `setTimeout`, causing synchronous DOM geometry reads (e.g. `getBoundingClientRect` inside `updatePositions`) to execute out-of-sync with the paint cycle, leading to layout thrashing and scroll jitter on heavy image pages.
     * - Impact: Measurably reduces main-thread blocking time during scroll/resize events by guaranteeing layout recalculations happen immediately before the frame is drawn. Prevents forced synchronous layouts.
     */
    function debounce(fn, delay) {
        let timeout;
        let rafId;
        return function debounced(...args) {
            clearTimeout(timeout);
            if (rafId && typeof window !== 'undefined' && window.cancelAnimationFrame) {
                window.cancelAnimationFrame(rafId);
            }
            timeout = setTimeout(() => {
                if (typeof window !== 'undefined' && window.requestAnimationFrame) {
                    rafId = window.requestAnimationFrame(() => fn.apply(this, args));
                } else {
                    fn.apply(this, args);
                }
            }, delay);
        };
    }

    function bindImageLoadHandlers() {
        const debouncedSync = debounce(syncCurrentIndex, 150);
        const debouncedUpdate = debounce(updatePositions, 150);
        Array.from(document.images).forEach((image) => {
            if (image.complete) {
                return;
            }
            image.addEventListener('load', () => {
                if (!useObserver) {
                    debouncedUpdate();
                } else {
                    debouncedSync();
                }
            });
        });
    }

    function init() {
        refreshBlocks();
        bindImageLoadHandlers();

        if (!useObserver) {
            window.addEventListener('resize', debounce(updatePositions, 150));
            window.addEventListener('load', updatePositions);
        } else {
            window.addEventListener('resize', debounce(syncCurrentIndex, 150));
            window.addEventListener('load', syncCurrentIndex);
        }

        document.addEventListener('keydown', handleKeydown, { passive: false });
        window.addEventListener('scroll', debounce(syncCurrentIndex, 150));
    }

    ready(init);

    // eslint-disable-next-line no-undef
    if (typeof module !== 'undefined' && module.exports) {
        // eslint-disable-next-line no-undef
        module.exports = {
            clampScrollTop,
            isEditableActive,
        };
    }
})();
