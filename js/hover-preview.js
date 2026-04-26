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

    const portfolioLinks = document.querySelectorAll('#nav .portfolio-link a');
    if (portfolioLinks.length === 0) {
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

    // Update position smoothly using requestAnimationFrame
    const updatePosition = () => {
        if (isHovering) {
            // Offset slightly to the right and bottom of the cursor
            setX(mouseX + 20);
            setY(mouseY + 20);
            requestAnimationFrame(updatePosition);
        }
    };

    // Track mouse movement
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    portfolioLinks.forEach((link) => {
        link.addEventListener('mouseenter', (e) => {
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

                requestAnimationFrame(updatePosition);

                gsap.to(previewContainer, {
                    scale: 1,
                    opacity: 1,
                    clipPath: 'ellipse(100% 100% at 50% 50%)',
                    duration: 0.4,
                    ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
                });
            }
        });

        link.addEventListener('mouseleave', () => {
            isHovering = false;
            gsap.to(previewContainer, {
                scale: 0.8,
                opacity: 0,
                clipPath: 'ellipse(0% 0% at 50% 50%)',
                duration: 0.3,
                ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
            });
        });
    });
});
