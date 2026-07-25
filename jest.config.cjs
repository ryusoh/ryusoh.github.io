module.exports = {
    testEnvironment: 'jsdom',
    collectCoverageFrom: ['js/**/*.js', 'sw.js', '!js/vendor/**/*.js', '!js/**/*.min.js'],
    // Whole-suite coverage floor (ratchet): set just below the measured globals
    // on 2026-07-26 (lines ~87.2 / statements ~87.3 / functions 90.3 /
    // branches ~80.9 — varies ±0.1 between runs). Testpilot raises this floor
    // as coverage improves; never lower it.
    coverageThreshold: {
        global: {
            lines: 87,
            statements: 87,
            functions: 90,
            branches: 80,
        },
    },
};
