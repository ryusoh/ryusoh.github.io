/**
 * @fileoverview Initializes ThumbHash placeholders on gallery images.
 * Decodes inline base64 ThumbHash strings into smooth blur-up background previews.
 */
/* global module, ThumbHash */
(function () {
    'use strict';

    /**
     * @typedef {Object} ThumbHashDecoder
     * @property {(hash: string) => Uint8Array} base64ToUint8Array
     * @property {(bytes: Uint8Array) => string} thumbHashToDataURL
     */

    /**
     * @param {string} msg
     * @param {unknown} e
     */
    function logWarning(msg, e) {
        if (typeof window !== 'undefined' && window.console) {
            window.console.warn(msg, e);
        }
    }

    /**
     * Resolves the ThumbHash decoder implementation from arguments or global scope.
     * @param {ThumbHashDecoder | unknown} [thumbHashDecoder]
     * @returns {ThumbHashDecoder | null}
     */
    function resolveDecoder(thumbHashDecoder) {
        return /** @type {ThumbHashDecoder | null} */ (
            thumbHashDecoder ||
                (typeof ThumbHash !== 'undefined' ? ThumbHash : null) ||
                (typeof window !== 'undefined' && window.ThumbHash ? window.ThumbHash : null) ||
                (typeof globalThis !== 'undefined' &&
                /** @type {Window & typeof globalThis} */ (globalThis).ThumbHash
                    ? /** @type {Window & typeof globalThis} */ (globalThis).ThumbHash
                    : null)
        );
    }

    /**
     * Applies the data URL as a background image or CSS variable.
     * @param {HTMLElement} el
     * @param {string} dataUrl
     */
    function applyThumbHashStyle(el, dataUrl) {
        if (el.tagName === 'IMG') {
            el.style.backgroundImage = `url("${dataUrl}")`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        } else {
            el.style.setProperty('--thumbhash', `url("${dataUrl}")`);
        }
    }

    /**
     * Attaches the load listener or triggers it immediately if already loaded.
     * @param {HTMLElement} el
     * @param {() => void} onLoaded
     */
    function handleLoadedState(el, onLoaded) {
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
    }

    /**
     * Applies ThumbHash placeholder to an image or container element.
     * @param {HTMLElement} el
     * @param {ThumbHashDecoder | unknown} [thumbHashDecoder]
     */
    function applyThumbHash(el, thumbHashDecoder) {
        const decoder = resolveDecoder(thumbHashDecoder);

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

            applyThumbHashStyle(el, dataUrl);
            el.dataset.thumbhashApplied = 'true';

            const onLoaded = function () {
                el.classList.add('thumbhash-loaded');
            };

            handleLoadedState(el, onLoaded);
        } catch (e) {
            logWarning('ThumbHash decoding failed during init:', e);
        }
    }

    /**
     * Initializes all elements matching [data-thumbhash] in the given container or document.
     * @param {HTMLElement|Document} [container=document]
     * @param {ThumbHashDecoder | unknown} [thumbHashDecoder]
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
