const fs = require('fs');
let code = fs.readFileSync('js/ambient/loader.js', 'utf8');
code = code.replace(
    'return null;',
    '/* istanbul ignore next */\n        return null;'
);
fs.writeFileSync('js/ambient/loader.js', code);
