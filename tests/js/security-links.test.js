const fs = require('fs');
const path = require('path');

describe('Security: rel="noopener noreferrer" for target="_blank"', () => {
    const htmlFiles = [];

    // Function to recursively find all HTML files
    function findHtmlFiles(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            // Skip node_modules and hidden directories
            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                findHtmlFiles(filePath);
            } else if (file.endsWith('.html')) {
                htmlFiles.push(filePath);
            }
        }
    }

    // Start from the project root
    findHtmlFiles(path.resolve(__dirname, '../../'));

    test('All HTML files should be found', () => {
        expect(htmlFiles.length).toBeGreaterThan(0);
    });

    htmlFiles.forEach((file) => {
        test(`File: ${path.relative(path.resolve(__dirname, '../../'), file)}`, () => {
            const html = fs.readFileSync(file, 'utf8');

            // Since we can't use JSDOM in this environment easily due to node VM,
            // we'll parse the HTML using regex.
            // This regex finds <a ... target="_blank" ... > tags
            const aTagRegex = /<a\s+([^>]*?)>/gi;
            let match;
            let foundTargetBlank = false;

            while ((match = aTagRegex.exec(html)) !== null) {
                const attributesStr = match[1];

                // Parse attributes
                const attrRegex =
                    /([a-z0-9\-_]+)(?:\s*=\s*(?:(?:"([^"]*)")|(?:'([^']*)')|([^>\s]+)))?/gi;
                let attrMatch;
                const attributes = {};

                while ((attrMatch = attrRegex.exec(attributesStr)) !== null) {
                    const name = attrMatch[1].toLowerCase();
                    const value = attrMatch[2] || attrMatch[3] || attrMatch[4] || '';
                    attributes[name] = value;
                }

                if (attributes['target'] === '_blank') {
                    foundTargetBlank = true;
                    const rel = attributes['rel'];

                    expect(rel).toBeDefined();
                    expect(rel).not.toBeNull();
                    expect(typeof rel).toBe('string');

                    const relTokens = rel.split(/\s+/).filter(Boolean);
                    expect(relTokens).toContain('noopener');
                    expect(relTokens).toContain('noreferrer');
                }
            }
        });
    });
});
