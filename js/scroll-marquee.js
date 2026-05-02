/**
 * scroll-marquee.js
 * Implements a scroll-linked marquee effect.
 */
document.addEventListener('DOMContentLoaded', () => {
    const article = document.querySelector('article');
    if (!article) {
        return;
    }

    // Create marquee container
    const container = document.createElement('div');
    container.className = 'scroll-marquee-container';
    container.setAttribute('aria-hidden', 'true');

    // Create marquee text
    const text = document.createElement('div');
    text.className = 'scroll-marquee-text';
    // Repeat the text multiple times to ensure it fills the screen and scrolls continuously
    text.textContent = 'STREET PHOTOGRAPHY • ZHUANG LIU • DOCUMENTARY • URBAN • '.repeat(10);

    container.appendChild(text);
    // Insert before the project-footer or at the end of the article
    const footer = article.querySelector('.project-footer');
    if (footer) {
        article.insertBefore(container, footer);
    } else {
        article.appendChild(container);
    }

    let isTicking = false;

    const updateMarquee = () => {
        // Move the text based on scroll position
        // A simple multiplier creates the parallax/scroll-linked effect
        const scrollDelta = window.scrollY;
        // Negative sign makes it move left as you scroll down
        const translateValue = -(scrollDelta * 0.5);

        text.style.transform = `translateX(${translateValue}px)`;
        isTicking = false;
    };

    window.addEventListener(
        'scroll',
        () => {
            if (!isTicking) {
                requestAnimationFrame(updateMarquee);
                isTicking = true;
            }
        },
        { passive: true }
    );

    // Initial call to set position
    updateMarquee();
});
