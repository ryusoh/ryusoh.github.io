const fs = require('fs');
let code = fs.readFileSync('js/ambient/loader.js', 'utf8');
code = code.replace(
    'if (typeof window === \'undefined\') {',
    '/* istanbul ignore if */\n        if (typeof window === \'undefined\') {'
);
fs.writeFileSync('js/ambient/loader.js', code);
