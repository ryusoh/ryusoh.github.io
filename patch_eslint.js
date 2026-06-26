const fs = require('fs');
const filepath = 'tests/js/page-transition.test.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/const apiWrapper = require/g, 'require');
content = content.replace(/if \(!api\) return;/g, 'if (!api) { return; }');
content = content.replace(/context\.window/g, 'window');
content = content.replace(/catch \(e\)/g, 'catch');

fs.writeFileSync(filepath, content, 'utf8');
