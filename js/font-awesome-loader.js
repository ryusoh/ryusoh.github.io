/**
 * Font Awesome Loader
 * Handles graceful loading of Font Awesome icons with fallback options
 */
class FontAwesomeLoader {
    constructor() {
        this.fontAwesomeLoaded = false;
        this.checkInterval = null;
        this.maxRetries = 10; // Maximum number of checks
        this.retryCount = 0;
    }

    /**
     * Initialize the Font Awesome loader
     */
    init() {
        // First, check if Font Awesome is already loaded
        if (this.isFontAwesomeLoaded()) {
            this.fontAwesomeLoaded = true;
            this.showIcons();
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
        // Create a temporary element to test if FA is loaded
        const testElement = document.createElement('i');
        testElement.className = 'fa fa-heart';
        document.body.appendChild(testElement);

        const computedStyle = window.getComputedStyle(testElement, ':before');
        const hasContent =
            computedStyle &&
            computedStyle.content &&
            computedStyle.content !== 'none' &&
            computedStyle.content !== '""';

        document.body.removeChild(testElement);
        return hasContent;
    }

    /**
     * Set up handling for potential icon placeholders
     */
    setupPlaceholderHandling() {
        // Initially hide all Font Awesome icons to prevent showing empty boxes
        const faIcons = document.querySelectorAll('i[class*="fa"]');
        faIcons.forEach((icon) => {
            icon.style.visibility = 'hidden';
            icon.dataset.fahidden = 'true';
        });
    }

    /**
     * Show the icons once Font Awesome is loaded
     */
    showIcons() {
        const faIcons = document.querySelectorAll('i[data-fahidden="true"]');
        faIcons.forEach((icon) => {
            icon.style.visibility = '';
            icon.dataset.fahidden = '';
        });
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
     * Stop the checking interval
     */
    stopChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Handle Font Awesome load failure
     */
    handleLoadFailure() {
        // Hide icons that failed to load properly
        const faIcons = document.querySelectorAll('i[class*="fa"]');
        faIcons.forEach((icon) => {
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
        });
    }

    /**
     * Wait for Font Awesome CSS to load (if loaded dynamically)
     */
    waitForFontLoad() {
        // Check for the CSS to be loaded
        const checkCSSLoaded = () => {
            const links = document.querySelectorAll('link[rel="stylesheet"]');
            let fontAwesomeFound = false;

            for (const link of links) {
                if (
                    link.href &&
                    (link.href.includes('font-awesome') || link.href.includes('fontawesome'))
                ) {
                    fontAwesomeFound = true;
                    break;
                }
            }

            if (fontAwesomeFound) {
                // If we found the FA link, check its loading status
                const faLink = Array.from(links).find(
                    (link) =>
                        link.href &&
                        (link.href.includes('font-awesome') || link.href.includes('fontawesome'))
                );

                if (faLink) {
                    faLink.onload = () => {
                        if (!this.fontAwesomeLoaded) {
                            this.fontAwesomeLoaded = true;
                            this.showIcons();
                            this.stopChecking();
                        }
                    };
                }
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
