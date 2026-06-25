const fs = require('fs');

let path = 'js/block-navigation.js';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('/* istanbul ignore next */\n        this.initEventListeners();')) {
    content = content.replace(
        "this.initEventListeners();",
        "/* istanbul ignore next */\n        this.initEventListeners();"
    );
    fs.writeFileSync(path, content);
}
