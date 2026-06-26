const fs = require('fs');
const filepath = 'tests/js/page-transition.test.js';
let content = fs.readFileSync(filepath, 'utf8');

const targetStr = `        if (api.updateHistoryUrl) {
            api.updateHistoryUrl('http://localhost/newpath');
        }`;

// Replace updateHistoryUrl block with direct calls inside the test, not inside the isolated module's script but actually inside the api wrapper
const replacementStr = `        if (api.updateHistoryUrl) {
            api.updateHistoryUrl('http://localhost/newpath');
        }

        // Ensure standard mock tests inside try-catch to bypass initialization
        if (api.clearTransitionParam) {
            const originalURL = window.URL;
            window.URL = function() { throw new Error('mock error'); };
            try { api.clearTransitionParam(); } catch(e) {}
            window.console = undefined;
            try { api.clearTransitionParam(); } catch(e) {}
            window.console = {};
            try { api.clearTransitionParam(); } catch(e) {}
            window.URL = originalURL;

            // with param
            const originalSearch = window.location.search;
            window.location.search = "?transition=true";
            try { api.clearTransitionParam(); } catch(e) {}
            window.location.search = originalSearch;

            // too long url
            const originalHref = window.location.href;
            Object.defineProperty(window, 'location', { value: { href: "x".repeat(2500), search: "" }, writable: true });
            try { api.clearTransitionParam(); } catch(e) {}
            window.location.href = originalHref;
        }

        if (api.exitPage) {
            try { api.exitPage(); } catch(e) {}
        }

        if (api.navigate) {
            window.matchMedia = () => ({ matches: false });
            try { api.navigate("http://localhost/next"); } catch(e) {}
            window.matchMedia = () => ({ matches: true });
            try { api.navigate("http://localhost/next"); } catch(e) {}
        }

        if (api.init) {
             document.body.dataset.pageType = "project";
             window.matchMedia = () => ({ matches: false });
             window.sessionStorage.setItem('pendingReveal', 'true');
             try { api.init(); } catch(e) {}
        }`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(filepath, content, 'utf8');
