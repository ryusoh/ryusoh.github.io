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

    // Only run on project pages
    if (!document.body || document.body.getAttribute('data-page-type') !== 'project') {
        return;
    }

    // Respect reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

    // Step 2: Force the browser to paint the hidden state
    // before we start observing. Without this, the browser
    // may batch "add .scroll-reveal" and "add .scroll-reveal--visible"
    // into the same frame, and the transition never plays.
    void document.body.offsetHeight;

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

    function revealImage(img) {
        if (img.complete) {
            revealElement(img);
            return;
        }
        img.addEventListener(
            'load',
            function () {
                revealElement(img);
            },
            { once: true }
        );
        img.addEventListener(
            'error',
            function () {
                revealElement(img);
            },
            { once: true }
        );
    }

    // Step 3: Observe — elements already in viewport will
    // fire immediately, but the hidden state has been painted
    // so the transition is visible.
    const observer = new IntersectionObserver(
        function (entries) {
            for (let i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    const el = entries[i].target;
                    if (el.tagName === 'IMG') {
                        revealImage(el);
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
})();
