/**
 * marquee.js
 * Implements a scroll-linked infinite marquee.
 */

/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    // Only run on project pages
    if (!document.body || document.body.getAttribute('data-page-type') !== 'project') {
        return;
    }

    if (typeof gsap === 'undefined') {
        window.console && window.console.warn('GSAP is not loaded. Skipping marquee.');
        return;
    }

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const postContent = document.querySelector('.post-content');
    if (!postContent) {
        return;
    }

    // Create the marquee container
    const marqueeContainer = document.createElement('div');
    marqueeContainer.className = 'marquee-container';
    marqueeContainer.setAttribute('aria-hidden', 'true'); // Decorative
    marqueeContainer.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 0;
        width: 100vw;
        overflow: hidden;
        white-space: nowrap;
        pointer-events: none;
        z-index: 10;
        opacity: 0.15;
        mix-blend-mode: overlay;
        font-family: 'Playfair Display', serif;
        font-size: 8rem;
        font-weight: 900;
        line-height: 1;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: -0.02em;
        will-change: transform;
    `;

    // Retrieve the h1 text for the marquee
    const h1 = document.querySelector('h1');
    const titleText = h1 ? h1.textContent.trim() : 'ZHUANG LIU PHOTOGRAPHY';

    // Create the inner track
    const track = document.createElement('div');
    track.className = 'marquee-track';
    track.style.cssText = `
        display: inline-block;
        white-space: nowrap;
    `;

    // Add enough items to ensure seamless looping
    // 4 repetitions is usually enough to cover ultra-wide screens
    for (let i = 0; i < 4; i++) {
        const item = document.createElement('span');
        item.textContent = titleText + ' — ';
        item.style.paddingRight = '20px';
        track.appendChild(item);
    }

    marqueeContainer.appendChild(track);
    document.body.appendChild(marqueeContainer);

    // Initial positioning to ensure width is calculated correctly
    let trackWidth = track.scrollWidth / 2; // the width of half the items to loop perfectly

    // Recalculate on resize
    window.addEventListener(
        'resize',
        () => {
            trackWidth = track.scrollWidth / 2;
        },
        { passive: true }
    );

    // GSAP quick setter for performance
    const setX = gsap.quickSetter(track, 'x', 'px');

    let currentScroll = window.scrollY;
    let targetX = 0;
    let currentX = 0;

    // The base speed of the marquee without scrolling
    const baseSpeed = -1;

    const updateMarquee = () => {
        const newScroll = window.scrollY;
        const scrollDelta = newScroll - currentScroll;
        currentScroll = newScroll;

        // Add base speed + scroll delta factor
        // When scrolling down (positive delta), moves left faster
        // When scrolling up (negative delta), moves right
        targetX += baseSpeed - scrollDelta * 0.5;

        // Smooth interpolation
        currentX += (targetX - currentX) * 0.1;

        // Loop seamlessly without using modulus on viewport
        // Wrap when we've moved an entire duplicated block's width
        if (currentX <= -trackWidth) {
            currentX += trackWidth;
            targetX += trackWidth;
        } else if (currentX >= 0) {
            currentX -= trackWidth;
            targetX -= trackWidth;
        }

        setX(currentX);
        requestAnimationFrame(updateMarquee);
    };

    requestAnimationFrame(updateMarquee);
});
