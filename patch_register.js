const fs = require('fs');
let code = fs.readFileSync('js/service-worker-register.js', 'utf8');

code = code.replace(`/* istanbul ignore file */\n`, ``);
code = `/* istanbul ignore file */\n` + code;

fs.writeFileSync('js/service-worker-register.js', code);
