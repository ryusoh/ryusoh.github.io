/* Simple <img> fallback: looks for data-fallbacks='["url1","url2",...]' */
(function () {
    try {
        function parseFallbacks(el) {
            const listAttr = el.getAttribute('data-fallbacks');
            if (!listAttr || listAttr.length > 1024) {
                return null;
            }

            try {
                const list = JSON.parse(listAttr);
                if (!Array.isArray(list) || list.length === 0) {
                    return null;
                }

                const sanitizedList = [];
                for (let k = 0; k < list.length; k++) {
                    if (typeof list[k] === 'string') {
                        sanitizedList.push(list[k]);
                    }
                }
                return sanitizedList.length > 0 ? sanitizedList : null;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.warn('Caught exception:', error);
                return null;
            }
        }

        function setupFallback(el, list) {
            el.classList.remove('is-fallback-ready');
            let i = 0;

            function tryNext() {
                if (i < list.length) {
                    el.src = list[i++];
                }
            }

            el.addEventListener('load', function onLoad() {
                el.classList.add('is-fallback-ready');
            });

            el.addEventListener('error', tryNext);

            if (!el.src || el.src !== list[0]) {
                el.src = list[0];
            } else if (el.complete && el.naturalWidth > 0) {
                el.classList.add('is-fallback-ready');
            }
        }

        function attach(el) {
            const list = parseFallbacks(el);
            if (list) {
                setupFallback(el, list);
            }
        }

        const imgs = document.querySelectorAll('img[data-fallbacks]');
        for (let j = 0; j < imgs.length; j++) {
            attach(imgs[j]);
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Caught exception:', error);
    }
})();
