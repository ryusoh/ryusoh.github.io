const fs = require('fs');
let css = fs.readFileSync('css/main_style.css', 'utf8');

// Ensure --brand-ease is defined in :root. It actually seems to be already defined. Let's check.
