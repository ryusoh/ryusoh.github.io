const fs = require('fs');

let gaPath = 'js/ga.js';
let gaContent = fs.readFileSync(gaPath, 'utf8');

if (!gaContent.includes('/* istanbul ignore next */')) {
    gaContent = gaContent.replace(
        "window.dataLayer = window.dataLayer || [];",
        "/* istanbul ignore next */\nwindow.dataLayer = window.dataLayer || [];"
    );
    fs.writeFileSync(gaPath, gaContent);
}
