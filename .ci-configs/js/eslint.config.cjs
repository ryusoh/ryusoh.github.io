// Minimal ESLint flat config for this repo's CI
// Prefer ignoring the fund submodule and vendor/minified files.
module.exports = [
    {
        ignores: [
            'fund',
            'fund/**',
            './fund/**',
            '**/fund/**',
            'assets/**',
            'node_modules/**',
            '**/*.min.js',
            'dist/**',
            'venv/**',
        ],
    },
];
