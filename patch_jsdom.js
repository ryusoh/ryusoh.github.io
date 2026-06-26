const fs = require('fs');
const filepath = 'tests/js/page-transition.test.js';
let content = fs.readFileSync(filepath, 'utf8');

// Use Object.defineProperty to override window.location safely in JSDOM, avoiding the Navigation API "Not implemented" error
const targetSearch = `window.location.search = '?transition=true';`;
const replaceSearch = `Object.defineProperty(window, 'location', { value: { href: window.location.href, search: '?transition=true' }, writable: true });`;

const targetEmptySearch = `window.location.search = '';`;
const replaceEmptySearch = `Object.defineProperty(window, 'location', { value: { href: window.location.href, search: '' }, writable: true });`;

const targetRestoreSearch = `window.location.search = originalSearch;`;
const replaceRestoreSearch = `Object.defineProperty(window, 'location', { value: { href: window.location.href, search: originalSearch }, writable: true });`;

content = content.replace(targetSearch, replaceSearch);
content = content.replace(targetEmptySearch, replaceEmptySearch);
content = content.replace(targetRestoreSearch, replaceRestoreSearch);

fs.writeFileSync(filepath, content, 'utf8');
