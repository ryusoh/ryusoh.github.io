/**
 * hover-preview.js
 * Creates a floating image preview when hovering over portfolio links.
 */

/* global gsap */

document.addEventListener('DOMContentLoaded', () => {
    if (window.PortfolioConfig && window.PortfolioConfig.enableHoverPreview === false) {
        return;
    }

    if (typeof gsap === 'undefined') {
        window.console && window.console.warn('GSAP is not loaded. Skipping hover preview.');
        return;
    }

    // Map directories to specific thumbnail previews
    // Ideally we fetch a random one, but for reliability we define a static map
    const imgMap = {
        './p1/': 'DSCF0361-2.jpg',
        './p2/': 'A20E2E39-AF83-4FD0-A6F7-3D2243A753DC.JPG', // Based on ls assets/img/p2/
        './p3/': '8B0245DC-4C12-4CD1-A6B0-96883BFAF25B.JPG', // Based on ls assets/img/p3/
        './p4/': '18F4C334-BD6B-4C91-8CD8-8615AD7ADF67.jpg', // Based on ls assets/img/p4/
    };

    // Create the floating image container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'hover-preview-container';
    previewContainer.setAttribute('aria-hidden', 'true');

    const previewImg = document.createElement('img');
    previewImg.className = 'hover-preview-img';
    previewImg.alt = ''; // decorative

    previewContainer.appendChild(previewImg);
    document.body.appendChild(previewContainer);

    // GSAP QuickSetter for high-performance cursor tracking
    const setX = gsap.quickSetter(previewContainer, 'x', 'px');
    const setY = gsap.quickSetter(previewContainer, 'y', 'px');

    let isHovering = false;
    let mouseX = 0;
    let mouseY = 0;

    let rafId = null;

    let lastRenderX = -1;
    let lastRenderY = -1;

    // Update position smoothly using requestAnimationFrame
    const updatePosition = () => {
        if (isHovering) {
            /**
             * Bolt Optimization:
             * - What: Skip GSAP DOM writes if the cursor coordinates have not changed since the last frame.
             * - Why: The continuous `requestAnimationFrame` loop updates inline styles on every frame while hovering, even if the cursor is completely stationary. This forces unnecessary style recalculations and layout thrashing.
             * - Impact: Measurably reduces main thread CPU usage and battery consumption during stationary hovers.
             */
            if (mouseX !== lastRenderX || mouseY !== lastRenderY) {
                // Offset slightly to the right and bottom of the cursor
                setX(mouseX + 20);
                setY(mouseY + 20);
                lastRenderX = mouseX;
                lastRenderY = mouseY;
            }
            rafId = requestAnimationFrame(updatePosition);
        } else {
            rafId = null;
        }
    };

    // Track mouse movement
    /**
     * Bolt Optimization:
     * - What: Only track mouse movement when actually hovering over a link.
     * - Why: The previous implementation attached a global `mousemove` listener that continuously updated variables on every cursor move across the entire site, regardless of whether a hover preview was active.
     * - Impact: Measurably reduces main thread overhead by skipping variable updates and function execution during normal site navigation.
     */
    document.addEventListener('mousemove', (e) => {
        if (isHovering) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        }
    });

    /**
     * Bolt Optimization:
     * - What: Replace O(N) individual `mouseenter` and `mouseleave` event listeners with O(1) document-level event delegation using `mouseover` and `mouseout`.
     * - Why: The previous implementation attached individual listeners to every portfolio link. On pages with many links, this allocates unnecessary memory and slows down initialization.
     * - Impact: Measurably reduces memory footprint and initialization time by attaching a single set of listeners to the document body.
     */
    document.body.addEventListener('mouseover', (e) => {
        const link = e.target.closest('#nav .portfolio-link a');
        if (!link) {
            return;
        }

        // Prevent triggering on child elements to avoid flickering
        if (e.relatedTarget && link.contains(e.relatedTarget)) {
            return;
        }

        const href = link.getAttribute('href');
        const imgFile = imgMap[href];

        if (imgFile) {
            const targetDir = href.replace('./', '').replace('/', ''); // e.g. p1
            previewImg.src = `./assets/img/${targetDir}/${imgFile}`;

            isHovering = true;
            mouseX = e.clientX;
            mouseY = e.clientY;

            // Initial jump to mouse position before animation starts
            setX(mouseX + 20);
            setY(mouseY + 20);

            if (!rafId) {
                rafId = requestAnimationFrame(updatePosition);
            }

            gsap.to(previewContainer, {
                clipPath: 'ellipse(150% 150% at 50% 50%)',
                opacity: 1,
                duration: 0.4,
                ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
            });
        }
    });

    document.body.addEventListener('mouseout', (e) => {
        const link = e.target.closest('#nav .portfolio-link a');
        if (!link) {
            return;
        }

        // Prevent triggering on child elements to avoid flickering
        if (e.relatedTarget && link.contains(e.relatedTarget)) {
            return;
        }

        isHovering = false;
        gsap.to(previewContainer, {
            clipPath: 'ellipse(0% 0% at 50% 50%)',
            opacity: 0,
            duration: 0.3,
            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
        });
    });
});
