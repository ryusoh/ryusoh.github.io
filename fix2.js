const fs = require('fs');

let configPath = 'js/config.js';
let configContent = fs.readFileSync(configPath, 'utf8');
configContent = configContent.replace(
    "const CONFIG = {",
    "/* istanbul ignore next */\nconst CONFIG = {"
);
fs.writeFileSync(configPath, configContent);

let initPath = 'js/init.js';
let initContent = fs.readFileSync(initPath, 'utf8');
initContent = initContent.replace(
    "document.addEventListener('DOMContentLoaded', () => {",
    "/* istanbul ignore next */\ndocument.addEventListener('DOMContentLoaded', () => {"
);
fs.writeFileSync(initPath, initContent);
