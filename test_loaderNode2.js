const fs = require('fs');
let code = fs.readFileSync('tests/js/ambient/loaderNode.test.js', 'utf8');
code = code.replace(
    'return { init: module.exports.init };',
    'return module;'
);
code = code.replace(
    'result.init();',
    'result.exports.init();'
);
fs.writeFileSync('tests/js/ambient/loaderNode.test.js', code);
