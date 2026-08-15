/**
 * @fileoverview Initializes ThumbHash placeholders on gallery images.
 * Decodes inline base64 ThumbHash strings into smooth blur-up background previews.
 */
/* global module, ThumbHash */
(function () {
    'use strict';

    /**
     * Applies ThumbHash placeholder to an image or container element.
     * @param {HTMLElement} el
     * @param {Object} [thumbHashDecoder]
     */
    function applyThumbHash(el, thumbHashDecoder) {
        const decoder =
            thumbHashDecoder ||
            (typeof ThumbHash !== 'undefined' ? ThumbHash : null) ||
            (typeof window !== 'undefined' && window.ThumbHash ? window.ThumbHash : null) ||
            (typeof globalThis !== 'undefined' && globalThis.ThumbHash
                ? globalThis.ThumbHash
                : null);

        if (!el || !decoder || typeof el.getAttribute !== 'function') {
            return;
        }
        const hash = el.getAttribute('data-thumbhash');
        if (!hash || el.dataset.thumbhashApplied) {
            return;
        }

        try {
            const bytes = decoder.base64ToUint8Array(hash);
            const dataUrl = decoder.thumbHashToDataURL(bytes);

            if (el.tagName === 'IMG') {
                el.style.backgroundImage = `url("${dataUrl}")`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
            } else {
                el.style.setProperty('--thumbhash', `url("${dataUrl}")`);
            }
            el.dataset.thumbhashApplied = 'true';

            const onLoaded = function () {
                el.classList.add('thumbhash-loaded');
            };

            if (el.tagName === 'IMG') {
                const img = /** @type {HTMLImageElement} */ (el);
                if (img.complete && img.naturalWidth > 0) {
                    onLoaded();
                } else {
                    img.addEventListener('load', onLoaded, { once: true });
                }
            } else {
                onLoaded();
            }
        } catch {
            // Silently fallback if decoding fails
        }
    }

    /**
     * Initializes all elements matching [data-thumbhash] in the given container or document.
     * @param {HTMLElement|Document} [container=document]
     * @param {Object} [thumbHashDecoder]
     */
    function init(container, thumbHashDecoder) {
        const rootElement = container || (typeof document !== 'undefined' ? document : null);
        if (!rootElement || typeof rootElement.querySelectorAll !== 'function') {
            return;
        }

        const elements = rootElement.querySelectorAll('[data-thumbhash]');
        for (let i = 0; i < elements.length; i++) {
            applyThumbHash(/** @type {HTMLElement} */ (elements[i]), thumbHashDecoder);
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
