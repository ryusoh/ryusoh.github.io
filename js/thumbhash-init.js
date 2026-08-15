/**
 * @fileoverview Initializes ThumbHash placeholders on gallery images.
 * Decodes inline base64 ThumbHash strings into smooth blur-up background previews.
 */
/* global module, ThumbHash */
(function () {
    'use strict';

    /**
     * Applies ThumbHash placeholder to an image element.
     * @param {HTMLImageElement} img
     * @param {Object} [thumbHashDecoder]
     */
    function applyThumbHash(img, thumbHashDecoder) {
        const decoder =
            thumbHashDecoder ||
            (typeof ThumbHash !== 'undefined' ? ThumbHash : null) ||
            (typeof window !== 'undefined' && window.ThumbHash ? window.ThumbHash : null) ||
            (typeof globalThis !== 'undefined' && globalThis.ThumbHash
                ? globalThis.ThumbHash
                : null);

        if (!img || !decoder || typeof img.getAttribute !== 'function') {
            return;
        }
        const hash = img.getAttribute('data-thumbhash');
        if (!hash || img.dataset.thumbhashApplied) {
            return;
        }

        try {
            const bytes = decoder.base64ToUint8Array(hash);
            const dataUrl = decoder.thumbHashToDataURL(bytes);
            img.style.backgroundImage = `url("${dataUrl}")`;
            img.style.backgroundSize = 'cover';
            img.style.backgroundPosition = 'center';
            img.dataset.thumbhashApplied = 'true';

            const onLoaded = function () {
                img.classList.add('thumbhash-loaded');
            };

            if (img.complete && img.naturalWidth > 0) {
                onLoaded();
            } else {
                img.addEventListener('load', onLoaded, { once: true });
            }
        } catch {
            // Silently fallback if decoding fails
        }
    }

    /**
     * Initializes all images matching [data-thumbhash] in the given container or document.
     * @param {HTMLElement|Document} [container=document]
     * @param {Object} [thumbHashDecoder]
     */
    function init(container, thumbHashDecoder) {
        const rootElement = container || (typeof document !== 'undefined' ? document : null);
        if (!rootElement || typeof rootElement.querySelectorAll !== 'function') {
            return;
        }

        const images = rootElement.querySelectorAll('img[data-thumbhash]');
        for (let i = 0; i < images.length; i++) {
            applyThumbHash(/** @type {HTMLImageElement} */ (images[i]), thumbHashDecoder);
        }
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                init();
            });
        } else {
            init();
        }
    }

    const api = {
        init,
        applyThumbHash,
    };

    if (typeof window !== 'undefined') {
        window.ThumbHashInit = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
