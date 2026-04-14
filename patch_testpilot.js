const fs = require('fs');

let content = fs.readFileSync('.jules/testpilot.md', 'utf8');

const newLearnings = `
## 2025-03-24 - Service Worker Test Environment Mocks
**Learning:** When testing Service Worker \`fetch\` logic in JSDOM environments, explicitly mock both \`global.self.location.origin\` and \`window.self.location.origin\` to match the test URL's origin, ensuring same-origin policy checks evaluate correctly.

## 2025-03-24 - Mocking performance.now with Fake Timers
**Learning:** When unit testing modules that rely on \`performance.now()\` in JSDOM with Jest fake timers, explicitly mock \`window.performance.now\` *before* the module is required. This ensures any internal closure bindings (e.g., \`perfNow = window.performance.now.bind(...)\`) properly capture the mocked timer mechanism.
`;

fs.appendFileSync('.jules/testpilot.md', newLearnings);
