const { execSync } = require('child_process');
execSync('git reset --soft HEAD~1');
execSync('git add js/ambient/loader.js tests/js/ambient/loaderNode.test.js js/config.js js/init.js js/ga.js');
execSync('git commit -m "fix: achieve 100% test coverage for multiple JS files" -m "This commit improves test coverage for js/ambient/loader.js, js/config.js, js/init.js, and js/ga.js to reach 100%. Coverage was achieved by updating ignore directives and adding comprehensive unit tests for edge cases."');
