'use strict';

(function () {
    const KEY_FORWARD = new Set(['ArrowRight', 'ArrowDown']);
    const KEY_BACKWARD = new Set(['ArrowLeft', 'ArrowUp']);
    const NODE_FILTER_SHOW_ELEMENT =
        (typeof window !== 'undefined' && window.NodeFilter && window.NodeFilter.SHOW_ELEMENT) || 1;
    let blocks = [];
    let blockPositions = [];
    let topSentinel = null;
    let currentIndex = -1;
    let pendingIndex = null;
    let pendingTimeout = null;
    let blockObserver = null;
    const activeIntersectingBlocks = new Set();
    const useObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window;

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

    function updatePositions() {
        if (!blocks.length) {
            blockPositions = [];
            if (!useObserver) {
                syncCurrentIndex();
            }
            return;
        }

        // If IntersectionObserver is active, we don't need to synchronously calculate array layouts.
        if (useObserver) {
            blockPositions = [];
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

    function refreshBlocks() {
        const contentBlocks = collectBlocks();
        topSentinel = document.body || document.documentElement || null;
        blocks = topSentinel ? [topSentinel].concat(contentBlocks) : contentBlocks;

        if (useObserver) {
            if (blockObserver) {
                blockObserver.disconnect();
            }

            blockObserver = new window.IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            activeIntersectingBlocks.add(entry.target);
                        } else {
                            activeIntersectingBlocks.delete(entry.target);
                        }
                    });

                    if (pendingIndex !== null) {
                        return;
                    }

                    let maxIntersectingIndex = -1;
                    activeIntersectingBlocks.forEach((block) => {
                        const idx = blocks.indexOf(block);
                        if (idx > maxIntersectingIndex) {
                            maxIntersectingIndex = idx;
                        }
                    });

                    if (maxIntersectingIndex !== -1) {
                        currentIndex = maxIntersectingIndex;
                    }
                },
                {
                    rootMargin: '-25% 0px -75% 0px',
                    threshold: 0,
                }
            );

            blocks.forEach((block) => blockObserver.observe(block));
        }

        updatePositions();
    }

    function syncCurrentIndex() {
        if (useObserver || pendingIndex !== null) {
            return;
        }
        currentIndex = getCurrentIndex();
    }

    function getCurrentIndex() {
        // Only used as a manual fallback
        if (!blockPositions.length) {
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

        const probe = window.scrollY + window.innerHeight * 0.25;
        let foundIndex = 0;
        for (let i = 0; i < blockPositions.length; i += 1) {
            if (probe >= blockPositions[i]) {
                foundIndex = i;
            } else {
                break;
            }
        }
        return foundIndex;
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
            if (!useObserver) {
                syncCurrentIndex();
            }
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

            const targetTop = useObserver ? rect.top + window.scrollY : blockPositions[index];
            const top = clampScrollTop(targetTop - offset);
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
        let startIndex = currentIndex === -1 ? (useObserver ? 0 : getCurrentIndex()) : currentIndex;
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

    function debounce(fn, delay) {
        let timeout;
        return function debounced(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function bindImageLoadHandlers() {
        if (useObserver) {
            return;
        } // Observers handle layout shifts automatically!

        const debouncedUpdate = debounce(updatePositions, 150);
        Array.from(document.images).forEach((image) => {
            if (image.complete) {
                return;
            }
            image.addEventListener('load', () => {
                debouncedUpdate();
            });
        });
    }

    function init() {
        refreshBlocks();
        bindImageLoadHandlers();
        document.addEventListener('keydown', handleKeydown, { passive: false });
        if (!useObserver) {
            window.addEventListener('resize', debounce(updatePositions, 150));
            window.addEventListener('load', updatePositions);
            window.addEventListener('scroll', debounce(syncCurrentIndex, 150));
        }
    }

    ready(init);
})();
