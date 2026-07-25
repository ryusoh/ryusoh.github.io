/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    forbidden: [
        {
            name: 'no-circular',
            comment:
                'Circular deps make modules untestable in isolation and block behaviour-preserving extraction refactors',
            severity: 'error',
            from: {},
            to: { circular: true },
        },
        // NOTE: deliberately no cross-page or not-to-vendor rules. This repo
        // has no js/pages/<page>/ structure (pages are p1/–p4/ HTML entries
        // sharing js/ components), and js/vendor is legitimately imported
        // directly (js/cursor-init.js → js/vendor/cursor.js) — AGENTS.md only
        // forbids *editing* vendor code, not importing it.
    ],
    options: {
        // Alias resolution hook lives in .dependency-cruiser.webpack.cjs (see
        // that file for why it's a webpack stub and not options.tsConfig).
        // This repo currently has no aliases; the stub is a no-op safeguard.
        webpackConfig: { fileName: '.dependency-cruiser.webpack.cjs' },
        doNotFollow: { path: 'node_modules' },
        // Mirror eslint.config.cjs ignores: third-party vendor and minified
        // files are not ours to gate.
        exclude: { path: '^(js/vendor)|\\.min\\.js$' },
    },
};
