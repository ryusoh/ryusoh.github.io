const fs = require('fs');
let code = fs.readFileSync('tests/js/ambient/loaderNode.test.js', 'utf8');
code = code.replace(
    'describe(\'loader.js Node Environment module checks\', () => {',
    'describe(\'loader.js Node Environment module checks\', () => {\n    it(\'covers handleSyncError when window is undefined\', () => {\n        const sourceCode = require(\'fs\').readFileSync(\'js/ambient/loader.js\', \'utf8\');\n        const fn = new Function(\'module\', \'window\', \'console\', sourceCode + \'\\nreturn { init: module.exports.init };\');\n        const result = fn({ exports: {} }, undefined, console);\n        expect(() => {\n            result.init();\n        }).not.toThrow();\n    });'
);
fs.writeFileSync('tests/js/ambient/loaderNode.test.js', code);
