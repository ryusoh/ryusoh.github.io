/**
 * Asset preloader for cross-page performance optimization
 * Preloads images from other portfolio pages to improve navigation experience
 */
(function () {
    class AssetPreloader {
        constructor() {
            // Define the image directories that need preloading
            /** @type {Record<string, string>} */
            this.imageDirectories = {
                p1: '/assets/img/p1/',
                p2: '/assets/img/p2/',
                p3: '/assets/img/p3/',
                p4: '/assets/img/p4/',
                p5: '/assets/img/p5/',
            };

            // Define the actual image sets for each portfolio page (these are the specific images referenced in each portfolio)
            /** @type {Record<string, string[]>} */
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
                    '/assets/img/p2/DSCF0883-3.jpg',
                    '/assets/img/p2/DSCF5163-8.JPG',
                    '/assets/img/p2/DSCF8444-3.jpg',
                    '/assets/img/p2/DSCF8593-3.jpg',
                    '/assets/img/p2/DSCF8402-3.jpg',
                    '/assets/img/p2/DSCF3433.jpg',
                    '/assets/img/p2/A20E2E39-AF83-4FD0-A6F7-3D2243A753DC.JPG',
                    '/assets/img/p2/DSCF0406-2.JPG',
                    '/assets/img/p2/DSCF7203-9.jpg',
                    '/assets/img/p2/DSCF5150-4.JPG',
                    '/assets/img/p2/DSCF8772.jpg',
                    '/assets/img/p2/DSCF3495-2.jpg',
                    '/assets/img/p2/DSCF0418-2.JPG',
                    '/assets/img/p2/DSCF8739.jpg',
                    '/assets/img/p2/DSCF3487-3.jpg',
                    '/assets/img/p2/DSCF3445-2.jpg',
                    '/assets/img/p2/DSCF7452.JPG',
                    '/assets/img/p2/R0004664.JPG',
                    '/assets/img/p2/DSCF2862-3.jpg',
                ],
                p3: [
                    '/assets/img/p3/DSCF7765.jpg',
                    '/assets/img/p3/DSCF7728.jpg',
                    '/assets/img/p3/DSCF7753-3.jpg',
                    '/assets/img/p3/DSCF7186-2.jpg',
                    '/assets/img/p3/DSCF3435.JPG',
                    '/assets/img/p3/DSCF6946.jpg',
                    '/assets/img/p3/8B0245DC-4C12-4CD1-A6B0-96883BFAF25B.JPG',
                    '/assets/img/p3/DSCF5338.JPG',
                    '/assets/img/p3/DSCF0490.JPG',
                    '/assets/img/p3/R0001972-4.JPG',
                    '/assets/img/p3/DSCF4237-2.jpg',
                    '/assets/img/p3/IMG_4582.jpg',
                    '/assets/img/p3/B5B35521-9A08-4B1C-AAB3-429D75A3769E.JPG',
                    '/assets/img/p3/DSCF8563-5.jpg',
                    '/assets/img/p3/DSCF8671.JPG',
                    '/assets/img/p3/DSCF3632.JPG',
                    '/assets/img/p3/DSCF1137.jpg',
                    '/assets/img/p3/DSCF7672-2.JPG',
                    '/assets/img/p3/DSCF1113.jpg',
                    '/assets/img/p3/DSCF3579.JPG',
                    '/assets/img/p3/DSCF7318-3.jpg',
                    '/assets/img/p3/DSCF5759-5.jpg',
                    '/assets/img/p3/DSCF5719-3.jpg',
                ],
                p4: [
                    '/assets/img/p4/DSCF4250-3.jpg',
                    '/assets/img/p4/DSCF4090.jpg',
                    '/assets/img/p4/DSCF7212-2.jpg',
                    '/assets/img/p4/DSCF1897-2.jpg',
                    '/assets/img/p4/DSCF8552-6.jpg',
                    '/assets/img/p4/DSCF5453-2.jpg',
                    '/assets/img/p4/DSCF7352.jpg',
                    '/assets/img/p4/940E2644-C690-41F0-9898-0EFB79C69DC5.jpg',
                    '/assets/img/p4/18F4C334-BD6B-4C91-8CD8-8615AD7ADF67.jpg',
                    '/assets/img/p4/DSCF9185.jpg',
                    '/assets/img/p4/DSCF8631.jpg',
                    '/assets/img/p4/DSCF0310-3.jpg',
                    '/assets/img/p4/DSCF6872-5.jpg',
                    '/assets/img/p4/DSCF9642-2.jpg',
                    '/assets/img/p4/R0001059-4.jpg',
                    '/assets/img/p4/DSCF4110-2.jpg',
                    '/assets/img/p4/DSCF6250-6.jpg',
                    '/assets/img/p4/DSCF1207-5.jpg',
                    '/assets/img/p4/DSCF3446-2.jpg',
                    '/assets/img/p4/DSCF0896-2.jpg',
                ],
                p5: [
                    '/assets/img/p5/DSCF9004-3.jpg',
                    '/assets/img/p5/2025-05-11-0020.JPG',
                    '/assets/img/p5/DSCF8059.JPG',
                    '/assets/img/p5/DSCF1557-3.JPG',
                    '/assets/img/p5/DSCF5407-2.jpg',
                    '/assets/img/p5/DSCF8149-7.JPG',
                    '/assets/img/p5/DSCF8231.JPG',
                    '/assets/img/p5/DSCF0525.jpg',
                    '/assets/img/p5/849BDEFE-8868-48A8-B31D-ADB58F0161022.JPG',
                    '/assets/img/p5/DSCF6274.JPG',
                    '/assets/img/p5/IMG760.jpg',
                    '/assets/img/p5/DSCF9159.jpg',
                ],
            };
        }

        /**
         * Preload assets for specific pages
         * @param {string[]} pageKeys - Array of page keys to preload assets for (e.g., ['p2', 'p3'])
         */
        /**
         * Preload assets for specific pages
         * @param {string[]} pageKeys - Array of page keys to preload assets for (e.g., ['p2', 'p3', 'p4', 'p5'])
         */
        preloadAssets(pageKeys) {
            /**
             * Bolt Optimization:
             * - What: Interleave image preloading round-robin across target pages and batch DOM inserts.
             * - Why: Appending nodes one by one to `document.head` inside a loop triggers multiple DOM mutations.
             *   Interleaving ensures that the hero / first images of EVERY portfolio page are preloaded first,
             *   preventing network bandwidth starvation for later pages.
             */
            const fragment = document.createDocumentFragment();
            const pageImageSets = [];
            for (let i = 0; i < pageKeys.length; i++) {
                const key = pageKeys[i];
                if (this.assetSets[key] && this.assetSets[key].length > 0) {
                    pageImageSets.push(this.assetSets[key]);
                }
            }

            let maxLen = 0;
            for (let i = 0; i < pageImageSets.length; i++) {
                if (pageImageSets[i].length > maxLen) {
                    maxLen = pageImageSets[i].length;
                }
            }

            for (let round = 0; round < maxLen; round++) {
                for (let i = 0; i < pageImageSets.length; i++) {
                    const imgSet = pageImageSets[i];
                    if (round < imgSet.length) {
                        const imgSrc = imgSet[round];
                        const link = this.createPreloadLink(imgSrc);
                        fragment.appendChild(link);
                    }
                }
            }

            // Append all links to head in a single operation
            document.head.appendChild(fragment);
        }

        /**
         * Helper to create a responsive preload link element matching the <picture> source format.
         * @param {string} imgSrc - Image source URL
         * @returns {HTMLElement} - The created link element
         */
        createPreloadLink(imgSrc) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            if (typeof imgSrc === 'string' && /\/assets\/img\/p\d+\//i.test(imgSrc)) {
                const base = imgSrc.replace(/\.(jpe?g|png|webp|avif)$/i, '');
                link.type = 'image/avif';
                link.setAttribute(
                    'imagesrcset',
                    `${base}-768.avif 768w, ${base}-1200.avif 1200w, ${base}.avif 2048w`
                );
                link.setAttribute(
                    'imagesizes',
                    '(max-width: 480px) 100vw, (max-width: 768px) 90vw, 900px'
                );
                link.href = `${base}-768.avif`;
            } else {
                link.href = imgSrc;
            }
            return link;
        }

        /**
         * Preload a single image (Maintains original public API)
         * @param {string} imgSrc - Image source URL
         */
        preloadImage(imgSrc) {
            const link = this.createPreloadLink(imgSrc);
            document.head.appendChild(link);
        }

        /**
         * Get current page key based on URL
         * @returns {string} - Current page key (p1, p2, p3, p4, p5, or 'main' for index)
         */
        getCurrentPageKey() {
            const path = window.location.pathname;
            const match = path.match(/\/(p\d+)(?:\/|$)/i);
            if (match) {
                return match[1].toLowerCase();
            }
            return 'main';
        }

        /**
         * Preload assets for other pages based on current page
         */
        preloadForCurrentPage() {
            const currentPage = this.getCurrentPageKey();
            const allPages = Object.keys(this.assetSets);

            if (currentPage === 'main' || !this.assetSets[currentPage]) {
                this.preloadAssets(allPages);
            } else {
                this.preloadAssets(allPages.filter((p) => p !== currentPage));
            }
        }

        /**
         * Initialize the preloader
         */
        init() {
            if ('serviceWorker' in navigator) {
                // Wait for content to load, then preload other page assets
                window.addEventListener('load', () => {
                    /**
                     * Bolt Optimization:
                     * - What: Defer `preloadForCurrentPage` using `requestIdleCallback` (with a setTimeout fallback).
                     * - Why: Preloading non-critical assets (images for other pages) immediately on `load` can block the main thread and delay Time to Interactive (TTI), especially on low-end devices.
                     * - Impact: Measurably improves TTI and reduces main-thread contention by scheduling the background preloading work during idle browser time.
                     */
                    const preloadWork = () => this.preloadForCurrentPage();
                    if (typeof window.requestIdleCallback === 'function') {
                        window.requestIdleCallback(preloadWork);
                    } else {
                        window.setTimeout(preloadWork, 1000);
                    }
                });
            }
        }
    }

    // Initialize the preloader when the page loads
    document.addEventListener('DOMContentLoaded', () => {
        const preloader = new AssetPreloader();
        preloader.init();
    });

    const testing = { AssetPreloader };
    if (typeof window !== 'undefined') {
        window.__AssetPreloaderForTesting = testing;
    }

    /* eslint-disable no-undef */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = testing;
    }
    /* eslint-enable no-undef */
})();
