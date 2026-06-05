/**
 * Magnetic Navigation effect
 */
function checkTouchDevice() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false;
    }
    const hasTouchStart = 'ontouchstart' in window;
    const hasMaxTouchPoints = navigator.maxTouchPoints > 0;
    const isHoverNone = window.matchMedia && window.matchMedia('(hover: none)').matches;
    return hasTouchStart || hasMaxTouchPoints || isHoverNone;
}

export function initMagneticNav() {
    if (typeof window === 'undefined' || !window.gsap) {
        return;
    }

    // Check for touch devices - usually magnetic hover feels bad on touch
    if (checkTouchDevice()) {
        return;
    }

    // Target social icons
    // .social-icons-container a: main page headline icons
    const magneticElements = document.querySelectorAll('.social-icons-container a');

    for (let i = 0; i < magneticElements.length; i++) {
        setupMagneticElement(magneticElements[i]);
    }
}

function setupMagneticElement(el) {
    const setElX = window.gsap.quickTo(el, 'x', {
        duration: 0.3,
        ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
    });
    const setElY = window.gsap.quickTo(el, 'y', {
        duration: 0.3,
        ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
    });

    const child = el.querySelector('i, span, img');
    let setChildX, setChildY;
    if (child) {
        setChildX = window.gsap.quickTo(child, 'x', {
            duration: 0.3,
            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
        });
        setChildY = window.gsap.quickTo(child, 'y', {
            duration: 0.3,
            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
        });
    }

    let centerX = 0;
    let centerY = 0;

    el.addEventListener('mouseenter', () => {
        const rect = el.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
    });

    el.addEventListener('mousemove', (e) => {
        const distX = e.clientX - centerX;
        const distY = e.clientY - centerY;
        const strength = 0.4;

        setElX(distX * strength);
        setElY(distY * strength);

        if (child && setChildX && setChildY) {
            setChildX(distX * (strength * 1.5));
            setChildY(distY * (strength * 1.5));
        }
    });

    el.addEventListener('mouseleave', () => {
        window.gsap.to(el, {
            x: 0,
            y: 0,
            duration: 0.7,
            ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
        });

        if (child) {
            window.gsap.to(child, {
                x: 0,
                y: 0,
                duration: 0.7,
                ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
            });
        }
    });
}
