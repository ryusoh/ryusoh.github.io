/**
 * js/mobile-dock.js
 * Controls mobile header dock interactions:
 * - On desktop (>= 450px): single click returns to main page immediately.
 * - On mobile (< 450px):
 *   1. Single click when collapsed: expands dropdown navigation.
 *   2. Single click when expanded: returns to main page.
 *   3. Outside click: collapses the dock.
 */

(function () {
    'use strict';

    function isMobile() {
        return (
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(max-width: 449px)').matches
        );
    }

    function initMobileDock() {
        const cont = document.getElementById('cont');
        const titleLink = document.querySelector(
            '#cont .brand-title a, #cont h1 a, #cont .brand-title, #cont h1'
        );

        if (!cont || !titleLink || titleLink.hasAttribute('data-mobile-dock-initialized')) {
            return;
        }

        titleLink.setAttribute('data-mobile-dock-initialized', 'true');

        titleLink.addEventListener('click', function (event) {
            // On desktop: standard navigation to href
            if (!isMobile()) {
                return;
            }

            // On mobile:
            if (!cont.classList.contains('is-expanded')) {
                // 1. Collapsed state: single click expands dock
                event.preventDefault();
                event.stopPropagation();
                cont.classList.add('is-expanded');
            } else {
                // 2. Expanded state:
                cont.classList.remove('is-expanded');

                const isHome =
                    document.body && document.body.getAttribute('data-page-type') === 'home';
                if (!isHome) {
                    const href = titleLink.getAttribute('href') || '/';
                    const customNavEvent = new CustomEvent('mobile-dock:navigate', {
                        detail: { url: href },
                        bubbles: true,
                    });
                    window.dispatchEvent(customNavEvent);

                    if (
                        typeof window.location !== 'undefined' &&
                        event.isTrusted &&
                        typeof window.location.assign === 'function'
                    ) {
                        window.location.assign(href);
                    }
                }
            }
        });

        // Close dropdown when tapping outside
        document.addEventListener('click', function (event) {
            if (cont.classList.contains('is-expanded') && !cont.contains(event.target)) {
                cont.classList.remove('is-expanded');
            }
        });

        // Handle scroll-down dimming and scroll-up/bottom recovery on mobile
        let lastScrollY = typeof window !== 'undefined' ? window.scrollY || 0 : 0;

        function handleScroll() {
            if (!isMobile()) {
                cont.classList.remove('is-scrolled-down');
                return;
            }

            const currentScrollY = window.scrollY || 0;
            const windowHeight = window.innerHeight || 0;
            const scrollEl = document.documentElement || document.body;
            const docHeight = scrollEl ? scrollEl.scrollHeight : 0;

            const isNearTop = currentScrollY <= 60;
            const isNearBottom = docHeight > 0 && currentScrollY + windowHeight >= docHeight - 60;
            const isScrollingDown = currentScrollY > lastScrollY && currentScrollY > 60;

            if (isNearTop || isNearBottom || currentScrollY < lastScrollY) {
                // Scrolling up, at top, or reached bottom -> restore 100% opacity
                cont.classList.remove('is-scrolled-down');
                if (document.body) {
                    document.body.classList.remove('is-scrolled-down');
                }
            } else if (isScrollingDown) {
                // Scrolling down past threshold -> dim title & social icons to 10%
                cont.classList.add('is-scrolled-down');
                if (document.body) {
                    document.body.classList.add('is-scrolled-down');
                }
            }

            lastScrollY = currentScrollY;
        }

        window.addEventListener('scroll', handleScroll, { passive: true });
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initMobileDock);
        } else {
            initMobileDock();
        }
    }

    const testing = { initMobileDock };
    if (typeof window !== 'undefined') {
        window.__MobileDockForTesting = testing;
    }

    /* eslint-disable no-undef */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = testing;
    }
    /* eslint-enable no-undef */
})();
