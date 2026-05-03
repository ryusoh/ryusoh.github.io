/* global gsap */
/**
 * Scroll-linked infinite marquee
 * Balances 'The Steve Jobs Test' (restraint, honest UI, avoids hijacking scroll)
 * with 'The Lando Norris Test' (engineered intent, typography contrast, scroll as narrative).
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') {
        return;
    }

    // Create the marquee container
    const container = document.createElement('div');
    container.className = 'scroll-marquee-container';
    container.setAttribute('aria-hidden', 'true');

    const content = document.createElement('div');
    content.className = 'scroll-marquee-content';

    // Two-font contrast system
    const text =
        '<span class="marquee-sans">URBAN DOCUMENTARY</span> <span class="marquee-serif">Zhuang Liu</span> <span class="marquee-separator">✦</span> ';

    // We need exactly two identical halves for the infinite loop to work seamlessly.
    // Each half must be wide enough to fill the screen to prevent blank spaces.
    const segmentContent = text.repeat(4);
    const segment1 = document.createElement('span');
    segment1.innerHTML = segmentContent;
    const segment2 = document.createElement('span');
    segment2.innerHTML = segmentContent;

    content.appendChild(segment1);
    content.appendChild(segment2);
    container.appendChild(content);

    // Inject before footer
    const footer = document.querySelector('footer') || document.querySelector('.project-footer');
    if (footer && footer.parentNode) {
        footer.parentNode.insertBefore(container, footer);
    } else {
        document.body.appendChild(container);
    }

    // Wait for fonts to load or at least a frame to get accurate widths
    requestAnimationFrame(() => {
        let xPos = 0;
        let lastScrollY = window.scrollY;

        const setX = gsap.quickSetter(content, 'x', 'px');

        function render() {
            const scrollY = window.scrollY;
            const scrollDelta = scrollY - lastScrollY;
            lastScrollY = scrollY;

            // Base ambient speed + scroll-linked narrative motion
            xPos -= 1 + Math.abs(scrollDelta) * 0.15;

            // Groundedness Rule: Modulo looping strictly using actual rendered width of a single segment
            const loopWidth = content.scrollWidth / 2;

            // Prevent violent jump by strictly looping within the bounds of a single segment
            if (Math.abs(xPos) >= loopWidth) {
                xPos = xPos % loopWidth;
            }

            setX(xPos);
            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);
    });
});
