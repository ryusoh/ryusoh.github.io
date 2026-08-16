/**
 * Scroll-driven reveal for project page content.
 *
 * Each image and text block inside .post-content starts invisible
 * and fades/slides into view as it enters the viewport.
 * Uses IntersectionObserver — no scroll event listeners,
 * no libraries, no layout thrashing.
 *
 * Images wait until they've loaded before revealing, so the
 * transition is visible even with loading="lazy".
 *
 * Respects prefers-reduced-motion: if the user has reduced
 * motion enabled, all content is shown immediately.
 */
(function () {
    'use strict';

    function shouldSkip() {
        if (!document.body || document.body.getAttribute('data-page-type') !== 'project') {
            return true;
        }
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return true;
        }
        return false;
    }

    if (shouldSkip()) {
        return;
    }

    // Elements to reveal: only images inside .post-content.
    // Applying CSS transforms to p tags disrupted standard flow text box margins.
    const container = document.querySelector('.post-content');
    if (!container) {
        return;
    }

    const revealElements = container.querySelectorAll('img');
    if (revealElements.length === 0) {
        return;
    }

    // Step 1: Mark all elements as hidden (instant, no transition).
    for (let i = 0; i < revealElements.length; i++) {
        revealElements[i].classList.add('scroll-reveal');
    }

    /**
     * @param {Element} el
     */
    function revealElement(el) {
        // Use requestAnimationFrame to ensure the browser paints the hidden
        // state before adding the visible class. If we don't, cached images
        // that trigger instantly will batch the styles and skip the animation.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                el.classList.add('scroll-reveal--visible');
            });
        });
    }

    /**
     * @param {HTMLImageElement} img
     */
    function revealImage(img) {
        if (img.complete || img.naturalWidth > 0 || img.dataset.loaded === 'true') {
            revealElement(img);
            return;
        }
        img.classList.add('is-revealing');
        if (typeof img.decode === 'function') {
            img.decode()
                .then(function () {
                    if (img.classList.contains('is-revealing')) {
                        img.classList.remove('is-revealing');
                        revealElement(img);
                    }
                })
                .catch(function () {
                    // Fallback to load/error event delegation
                });
        }
    }

    /**
     * @param {Event} event
     */
    function handleImageLoadEvent(event) {
        const el = /** @type {Element} */ (event.target);
        if (el && el.tagName === 'IMG') {
            const img = /** @type {HTMLImageElement} */ (el);
            img.dataset.loaded = 'true';
            if (img.classList.contains('is-revealing')) {
                img.classList.remove('is-revealing');
                revealElement(img);
            }
        }
    }

    // Register capturing event delegation listeners synchronously at startup
    // so no preloaded or early-cached image load events are ever missed.
    document.addEventListener('load', handleImageLoadEvent, true);
    document.addEventListener('error', handleImageLoadEvent, true);

    /**
     * Double requestAnimationFrame allows the browser to paint the starting
     * hidden state before observing intersection.
     */
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            // Step 3: Observe — elements already in viewport will
            // fire immediately, but the hidden state has been painted
            // so the transition is visible.
            const observer = new IntersectionObserver(
                function (entries) {
                    for (let i = 0; i < entries.length; i++) {
                        if (entries[i].isIntersecting) {
                            const el = entries[i].target;
                            if (el.tagName === 'IMG') {
                                revealImage(/** @type {HTMLImageElement} */ (el));
                            }
                            observer.unobserve(el);
                        }
                    }
                },
                {
                    threshold: 0.08,
                    rootMargin: '0px 0px 80px 0px',
                }
            );

            for (let i = 0; i < revealElements.length; i++) {
                observer.observe(revealElements[i]);
            }
        });
    });
})();
