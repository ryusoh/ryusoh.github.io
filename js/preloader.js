/**
 * Asset preloader for cross-page performance optimization
 * Preloads images from other portfolio pages to improve navigation experience
 */
class AssetPreloader {
    constructor() {
        // Define the image directories that need preloading
        this.imageDirectories = {
            p1: '/assets/img/p1/',
            p2: '/assets/img/p2/',
            p3: '/assets/img/p3/',
        };

        // Define the actual image sets for each portfolio page (these are the specific images referenced in each portfolio)
        this.assetSets = {
            p1: [
                '/assets/img/p1/DSCF4775.jpg',
                '/assets/img/p1/DSCF8974-2.jpg',
                '/assets/img/p1/DSCF0361-2.jpg',
                '/assets/img/p1/DSCF8927-2.jpg',
                '/assets/img/p1/DSCF8961-2.jpg',
                '/assets/img/p1/DSCF7141.jpg',
                '/assets/img/p1/R0002885-2.jpg',
                '/assets/img/p1/DSCF2432-2.jpg',
                '/assets/img/p1/DSCF6943.jpg',
                '/assets/img/p1/DSCF2441-3.jpg',
                '/assets/img/p1/DSCF1157.jpg',
                '/assets/img/p1/DSCF5423-5.jpg',
                '/assets/img/p1/DSCF1093.jpg',
                '/assets/img/p1/286FC1B3-5576-440B-8718-2E872C98E713.JPG',
                '/assets/img/p1/DSCF5891-9.JPG',
                '/assets/img/p1/DSCF5903-2.JPG',
                '/assets/img/p1/DSCF4402-8.jpg',
                '/assets/img/p1/DSCF5916-4.JPG',
            ],
            p2: [
                '/assets/img/p2/DSCF4295-2.JPG',
                '/assets/img/p2/R0002358.JPG',
                '/assets/img/p2/DSCF5163-8.JPG',
                '/assets/img/p2/DSCF8593-3.jpg',
                '/assets/img/p2/DSCF8402-3.jpg',
                '/assets/img/p2/DSCF8444-3.jpg',
                '/assets/img/p2/DSCF3433.jpg',
                '/assets/img/p2/A20E2E39-AF83-4FD0-A6F7-3D2243A753DC.JPG',
                '/assets/img/p2/DSCF7203-9.jpg',
                '/assets/img/p2/DSCF8772.jpg',
                '/assets/img/p2/DSCF3495-2.jpg',
                '/assets/img/p2/DSCF8739.jpg',
                '/assets/img/p2/DSCF3487-3.jpg',
                '/assets/img/p2/DSCF3445-2.jpg',
                '/assets/img/p2/R0004664.JPG',
                '/assets/img/p2/DSCF2862-3.jpg',
            ],
            p3: [
                '/assets/img/p3/DSCF7765.jpg',
                '/assets/img/p3/DSCF7728.jpg',
                '/assets/img/p3/DSCF7753-3.jpg',
                '/assets/img/p3/DSCF7186-2.jpg',
                '/assets/img/p3/DSCF6946.jpg',
                '/assets/img/p3/8B0245DC-4C12-4CD1-A6B0-96883BFAF25B.JPG',
                '/assets/img/p3/DSCF5338.JPG',
                '/assets/img/p3/DSCF0490.JPG',
                '/assets/img/p3/DSCF4237-2.jpg',
                '/assets/img/p3/B5B35521-9A08-4B1C-AAB3-429D75A3769E.JPG',
                '/assets/img/p3/DSCF1137.jpg',
                '/assets/img/p3/DSCF3579.JPG',
                '/assets/img/p3/DSCF7318-3.jpg',
                '/assets/img/p3/DSCF5759-5.jpg',
                '/assets/img/p3/DSCF5719-3.jpg',
            ],
        };
    }

    /**
     * Preload assets for specific pages
     * @param {Array} pageKeys - Array of page keys to preload assets for (e.g., ['p2', 'p3'])
     */
    preloadAssets(pageKeys) {
        pageKeys.forEach((pageKey) => {
            if (this.assetSets[pageKey]) {
                this.assetSets[pageKey].forEach((imgSrc) => {
                    this.preloadImage(imgSrc);
                });
            }
        });
    }

    /**
     * Preload all images from a specified directory (for future expansion)
     * This method could be used to dynamically preload an entire directory
     * @param {string} directoryPath - Path to the directory to preload images from
     */
    preloadDirectoryImages(/* directoryPath */) {
        // In a real implementation, this would require a backend API or a JSON manifest
        // For now, this is a placeholder for future enhancement
    }

    /**
     * Get all image URLs for a specific page
     * @param {string} pageKey - The page key (p1, p2, p3)
     * @returns {Array} - Array of image URLs
     */
    getImagesForPage(pageKey) {
        return this.assetSets[pageKey] || [];
    }

    /**
     * Preload assets dynamically by specifying which pages to target
     * This allows for more flexible preloading strategies
     * @param {Object} preloadingConfig - Configuration for which pages to preload
     */
    preloadAssetsDynamic(preloadingConfig) {
        const { preloadFromPages = [], excludePages = [] } = preloadingConfig;

        Object.keys(this.assetSets).forEach((pageKey) => {
            if (preloadFromPages.includes(pageKey) && !excludePages.includes(pageKey)) {
                this.preloadAssets([pageKey]);
            }
        });
    }

    /**
     * Preload a single image
     * @param {string} imgSrc - Image source URL
     */
    preloadImage(imgSrc) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = imgSrc;
        document.head.appendChild(link);
    }

    /**
     * Get current page key based on URL
     * @returns {string} - Current page key (p1, p2, p3, or 'main' for index)
     */
    getCurrentPageKey() {
        const path = window.location.pathname;
        if (path.includes('/p1/')) {
            return 'p1';
        }
        if (path.includes('/p2/')) {
            return 'p2';
        }
        if (path.includes('/p3/')) {
            return 'p3';
        }
        if (path === '/' || path.includes('/index.html')) {
            return 'main';
        }
        return 'main';
    }

    /**
     * Preload assets for other pages based on current page
     */
    preloadForCurrentPage() {
        const currentPage = this.getCurrentPageKey();

        switch (currentPage) {
            case 'p1':
                // Preload assets for p2 and p3
                this.preloadAssets(['p2', 'p3']);
                break;
            case 'p2':
                // Preload assets for p1 and p3
                this.preloadAssets(['p1', 'p3']);
                break;
            case 'p3':
                // Preload assets for p1 and p2
                this.preloadAssets(['p1', 'p2']);
                break;
            case 'main':
            default:
                // On main page, preload assets for all portfolio pages
                this.preloadAssets(['p1', 'p2', 'p3']);
                break;
        }
    }

    /**
     * Initialize the preloader
     */
    init() {
        if ('serviceWorker' in navigator) {
            // Wait for content to load, then preload other page assets
            window.addEventListener('load', () => {
                this.preloadForCurrentPage();
            });
        }
    }
}

// Initialize the preloader when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const preloader = new AssetPreloader();
    preloader.init();
});
