/**
 * scroll-progress.js
 * Implements a narrative scroll indicator around the navigation buttons.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.getAttribute('data-page-type') !== 'project') {
        return;
    }

    // Respect reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const navButtons = document.querySelectorAll('.nav-next, .nav-back');
    if (navButtons.length === 0) {
        return;
    }

    navButtons.forEach((btn) => {
        // Create SVG wrapper
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNamespace, 'svg');
        svg.setAttribute('class', 'scroll-progress-ring');
        svg.setAttribute('width', '40');
        svg.setAttribute('height', '40');
        svg.setAttribute('viewBox', '0 0 40 40');
        svg.style.position = 'absolute';
        svg.style.top = '50%';
        svg.style.left = '50%';
        svg.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '-1';

        // Create the circle
        const circle = document.createElementNS(svgNamespace, 'circle');
        const radius = 18;
        const circumference = 2 * Math.PI * radius;

        circle.setAttribute('cx', '20');
        circle.setAttribute('cy', '20');
        circle.setAttribute('r', radius.toString());
        circle.setAttribute('fill', 'transparent');
        circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('stroke-dasharray', circumference.toString());
        circle.setAttribute('stroke-dashoffset', circumference.toString());

        // Use a slight transition for smoothness, but mostly rely on RAF
        circle.style.transition = 'stroke-dashoffset 0.1s linear';

        svg.appendChild(circle);

        // Ensure button is positioned relatively if it's not already
        if (window.getComputedStyle(btn).position === 'static') {
            btn.style.position = 'relative';
        }

        btn.appendChild(svg);

        // Update progress on scroll
        const updateProgress = () => {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollHeight <= 0) {
                return;
            }

            const scrollProgress = Math.max(0, Math.min(1, window.scrollY / scrollHeight));
            const offset = circumference - scrollProgress * circumference;
            circle.setAttribute('stroke-dashoffset', offset.toString());

            if (scrollProgress > 0) {
                circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.8)');
            } else {
                circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
            }
        };

        let ticking = false;
        window.addEventListener(
            'scroll',
            () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        updateProgress();
                        ticking = false;
                    });
                    ticking = true;
                }
            },
            { passive: true }
        );

        // Initial call
        updateProgress();
    });
});
