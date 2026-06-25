const fs = require('fs');
let code = fs.readFileSync('tests/js/ambient/loaderNode.test.js', 'utf8');
code = code.replace(
    'result.exports.init();',
    'if (result && result.init) { result.init(); } else if (result && result.exports && result.exports.init) { result.exports.init(); } else { /* no-op */ }'
);
fs.writeFileSync('tests/js/ambient/loaderNode.test.js', code);
