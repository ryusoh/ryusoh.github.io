const fs = require('fs');
const filepath = 'tests/js/page-transition.test.js';
let content = fs.readFileSync(filepath, 'utf8');

// The reviewer noticed the test used `context.window` inside a test block where `context` isn't defined.
// The code was pasted in `api.clearTransitionParam` block. I should replace `context.window` with `window` and `context.document` with `document`.
const targetStr = `        if (api.clearTransitionParam) {
            const originalURL = context.window.URL;
            context.window.URL = function() { throw new Error('mock error'); };
            api.clearTransitionParam();
            context.window.console = undefined;
            api.clearTransitionParam();
            context.window.console = {};
            api.clearTransitionParam();
            context.window.URL = originalURL;

            // with param
            context.window.location.search = "?transition=true";
            api.clearTransitionParam();
            context.window.location.search = "";

            // too long url
            context.window.location.href = "x".repeat(2500);
            api.clearTransitionParam();
            context.window.location.href = "http://localhost/test";
        }

        if (api.exitPage) {
            api.exitPage();
        }

        if (api.navigate) {
            context.window.matchMedia = () => ({ matches: false });
            api.navigate("http://localhost/next");
            context.window.matchMedia = () => ({ matches: true });
            api.navigate("http://localhost/next");
        }

        if (api.init) {
             context.document.body.dataset.pageType = "project";
             context.window.matchMedia = () => ({ matches: false });
             context.window.sessionStorage.setItem('pendingReveal', 'true');
             api.init();
        }`;

const replacementStr = `        if (api.clearTransitionParam) {
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
            Object.defineProperty(window, 'location', { value: { href: "x".repeat(2500) }, writable: true });
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
