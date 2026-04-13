// Custom cursor and UI enhancements

(function () {
    const init = () => {
        if (typeof document === 'undefined') {
            return;
        }

        document.addEventListener('DOMContentLoaded', () => {
            // Check if GSAP is available
            if (typeof window.gsap === 'undefined') {
                return;
            }

            // Standard require for Node/Jest, fallback for browser if needed (though browser uses bundle)
            let initCursor;
            try {
                // eslint-disable-next-line no-undef
                initCursor = require('./vendor/cursor.js').initCursor;
            } catch {
                // Browser fallback
                initCursor = window.initCursor;
            }

            if (!initCursor) {
                return;
            }

            const cursor = initCursor({
                container: 'body',
                speed: 0.7,
                className: 'custom-cursor',
                style: {
                    width: '30px',
                    height: '30px',
                    backgroundColor: 'rgba(206, 35, 35, 0.55)',
                },
                hover: {
                    elements: 'a, button, .interactive, .nav-inner li',
                    followEase: 0.4,
                    fadeEase: 0.1,
                    hoverScale: 3,
                },
            });

            // Store instances for cleanup if needed
            window.cursorInstances = { cursor };
        });
    };

    init();

    const testing = { init };
    if (typeof window !== 'undefined') {
        window.__CursorInitForTesting = testing;
    }

    /* eslint-disable no-undef */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = testing;
    }
    /* eslint-enable no-undef */
})();
