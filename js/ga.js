// Google Analytics (Universal Analytics) bootstrap
// Mirrors the previous inline snippet in index.html
(function (i, s, o, g, r, a, m) {
    i['GoogleAnalyticsObject'] = r;
    (i[r] = i[r] || function () {
        (i[r].q = i[r].q || []).push(arguments);
    });
    (i[r].l = 1 * new Date());
    (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m);
})(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

// Existing property and initial pageview
try {
    if (typeof window.ga === 'function') {
        window.ga('create', 'UA-9097302-10', 'auto');
        window.ga('send', 'pageview');
    }
} catch {}
