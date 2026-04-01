/* Simple <img> fallback: looks for data-fallbacks='["url1","url2",...]' */
(function () {
    try {
        function attach(el) {
            const listAttr = el.getAttribute('data-fallbacks');
            if (!listAttr || listAttr.length > 1024) {
                return;
            }
            let list;
            try {
                list = JSON.parse(listAttr);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.warn('Caught exception:', error);
                list = [];
            }
            if (!Array.isArray(list) || list.length === 0) {
                return;
            }

            // Return a sanitized, fresh array containing only validated string properties
            const sanitizedList = [];
            for (let k = 0; k < list.length; k++) {
                if (typeof list[k] === 'string') {
                    sanitizedList.push(list[k]);
                }
            }
            list = sanitizedList;
            if (list.length === 0) {
                return;
            }

            el.classList.remove('is-fallback-ready');
            let i = 0;
            function tryNext() {
                if (i >= list.length) {
                    return;
                }
                el.src = list[i++];
            }
            el.addEventListener('load', function onLoad() {
                el.classList.add('is-fallback-ready');
            });
            el.addEventListener('error', function () {
                tryNext();
            });
            // If current src fails, onerror will advance; ensure first URL is current
            if (!el.src || el.src !== list[0]) {
                el.src = list[0];
            } else if (el.complete && el.naturalWidth > 0) {
                el.classList.add('is-fallback-ready');
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
