/**
 * Font Awesome Loader
 * Handles graceful loading of Font Awesome icons with fallback options
 */
(function () {
    class FontAwesomeLoader {
        constructor() {
            this.fontAwesomeLoaded = false;
            this.checkInterval = null;
            this.maxRetries = 10; // Maximum number of checks
            this.retryCount = 0;
            this.faIcons = []; // Cache for Font Awesome icon elements
            this.testElement = null;
        }

        /**
         * Initialize the Font Awesome loader
         */
        init() {
            // Cache the icon elements once during initialization
            // Bolt Optimization: Avoiding Array.from() for DOM collections and memory allocations
            this.faIcons = document.querySelectorAll('i[class*="fa"]');

            // First, check if Font Awesome is already loaded
            if (this.isFontAwesomeLoaded()) {
                this.fontAwesomeLoaded = true;
                this.showIcons();
                this.cleanupTestElement();
                return;
            }

            // If not loaded, start checking periodically and set up fallback
            this.setupPlaceholderHandling();
            this.startChecking();

            // Also listen for the CSS to be loaded if it's being loaded asynchronously
            this.waitForFontLoad();
        }

        /**
         * Check if Font Awesome is loaded by looking for the presence of FA classes
         */
        isFontAwesomeLoaded() {
            // Create a persistent hidden element to test if FA is loaded without layout thrashing
            if (!this.testElement) {
                this.testElement = document.createElement('i');
                this.testElement.className = 'fa fa-heart';
                this.testElement.setAttribute('aria-hidden', 'true');
                this.testElement.style.cssText =
                    'visibility: hidden; position: absolute; top: -9999px; left: -9999px;';
                document.body.appendChild(this.testElement);
            }

            const computedStyle = window.getComputedStyle(this.testElement, ':before');
            const hasContent = !!(
                computedStyle &&
                computedStyle.content &&
                computedStyle.content !== 'none' &&
                computedStyle.content !== '""'
            );

            return hasContent;
        }

        /**
         * Set up handling for potential icon placeholders
         */
        setupPlaceholderHandling() {
            // Initially hide all Font Awesome icons to prevent showing empty boxes
            for (const icon of this.faIcons) {
                icon.style.visibility = 'hidden';
                icon.dataset.fahidden = 'true';
            }
        }

        /**
         * Show the icons once Font Awesome is loaded
         */
        showIcons() {
            for (const icon of this.faIcons) {
                if (icon.dataset.fahidden === 'true') {
                    icon.style.visibility = '';
                    icon.dataset.fahidden = '';
                }
            }
        }

        /**
         * Start periodic checking for Font Awesome load status
         */
        startChecking() {
            this.checkInterval = setInterval(() => {
                if (this.isFontAwesomeLoaded()) {
                    this.fontAwesomeLoaded = true;
                    this.showIcons();
                    this.stopChecking();
                } else {
                    this.retryCount++;
                    if (this.retryCount >= this.maxRetries) {
                        this.handleLoadFailure();
                        this.stopChecking();
                    }
                }
            }, 100); // Check every 100ms
        }

        /**
         * Stop the checking interval and clean up
         */
        stopChecking() {
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
            this.cleanupTestElement();
        }

        /**
         * Remove the test element from the DOM
         */
        cleanupTestElement() {
            if (this.testElement && this.testElement.parentNode) {
                this.testElement.parentNode.removeChild(this.testElement);
                this.testElement = null;
            }
        }

        /**
         * Handle Font Awesome load failure
         */
        handleLoadFailure() {
            // Hide icons that failed to load properly
            for (const icon of this.faIcons) {
                if (icon.dataset.fahidden === 'true') {
                    // For back icons, we can provide a text alternative
                    if (icon.classList.contains('fa-chevron-left')) {
                        icon.textContent = '←'; // Unicode left arrow as fallback
                        icon.style.visibility = 'visible';
                        icon.style.fontSize = '1.5em';
                    } else {
                        // For other icons, remove them or hide them
                        icon.style.display = 'none';
                    }
                }
            }
        }

        /**
         * Wait for Font Awesome CSS to load (if loaded dynamically)
         */
        waitForFontLoad() {
            // Check for the CSS to be loaded
            const checkCSSLoaded = () => {
                /**
                 * Bolt Optimization:
                 * - What: Replace separate existence check loop and Array.from().find() with a single loop.
                 * - Why: The previous implementation iterated over the DOM NodeList to find a boolean flag, then converted the same NodeList into an Array (causing memory allocation/GC overhead), and iterated it AGAIN using `.find()` to grab the element.
                 * - Impact: Eliminates redundant O(N) main-thread execution time and an unnecessary Array object allocation during the critical page load phase.
                 */
                const links = document.querySelectorAll('link[rel="stylesheet"]');
                let faLink = null;

                for (const link of links) {
                    if (
                        link.href &&
                        (link.href.includes('font-awesome') || link.href.includes('fontawesome'))
                    ) {
                        faLink = link;
                        break;
                    }
                }

                if (faLink) {
                    faLink.onload = () => {
                        if (!this.fontAwesomeLoaded) {
                            this.fontAwesomeLoaded = true;
                            this.showIcons();
                            this.stopChecking();
                        }
                    };
                }
            };

            // Run the check after a brief delay to ensure CSS is processed
            setTimeout(checkCSSLoaded, 50);
        }
    }

    // Initialize the Font Awesome loader when the page loads
    document.addEventListener('DOMContentLoaded', () => {
        const faLoader = new FontAwesomeLoader();
        faLoader.init();
    });

    const testing = { FontAwesomeLoader };
    if (typeof window !== 'undefined') {
        window.__FontAwesomeLoaderForTesting = testing;
    }

    /* eslint-disable no-undef */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = testing;
    }
    /* eslint-enable no-undef */
})();
