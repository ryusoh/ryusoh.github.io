const fs = require('fs');
let code = fs.readFileSync('tests/js/ambient/loaderNode.test.js', 'utf8');

if (!code.includes('covers window missing during module load')) {
code = code.replace(
    "describe('loader.js Node Environment module checks', () => {",
    "describe('loader.js Node Environment module checks', () => {\n    it('covers window missing during module load', () => {\n        const sourceCode = require('fs').readFileSync('js/ambient/loader.js', 'utf8');\n        const fn = new Function('module', sourceCode + '\\nreturn module;');\n        const result = fn({ exports: {} });\n        if (result && result.init) {\n            result.init();\n        } else if (result && result.exports && result.exports.init) {\n            result.exports.init();\n        }\n    });"
);
}

fs.writeFileSync('tests/js/ambient/loaderNode.test.js', code);
