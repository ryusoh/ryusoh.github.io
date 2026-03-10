const fs = require('fs');
const path = require('path');

// Simple regex parser as we don't have jsdom installed
// and the environment is node (based on earlier check)
function findTags(html, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*>`, 'gi');
    return html.match(regex) || [];
}

function getAttribute(tag, attrName) {
    // Regex to match attribute safely, handling single or double quotes
    const regex = new RegExp(`${attrName}=["']([^"']*)["']`, 'i');
    const match = tag.match(regex);
    return match ? match[1] : null;
}

describe('Security: target="_blank" links', () => {
    const rootDir = path.resolve(__dirname, '../../');

    // Find all HTML files
    function getHtmlFiles(dir, fileList = []) {
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                // Ignore node_modules, .git, etc
                if (!file.startsWith('.') && file !== 'node_modules') {
                    getHtmlFiles(filePath, fileList);
                }
            } else if (file.endsWith('.html')) {
                fileList.push(filePath);
            }
        });

        return fileList;
    }

    const htmlFiles = getHtmlFiles(rootDir);

    htmlFiles.forEach(file => {
        it(`should have rel="noopener noreferrer" for all target="_blank" links in ${path.relative(rootDir, file)}`, () => {
            const content = fs.readFileSync(file, 'utf8');
            const links = findTags(content, 'a');

            links.forEach(link => {
                const target = getAttribute(link, 'target');
                if (target === '_blank') {
                    const rel = getAttribute(link, 'rel');
                    expect(rel).toBeDefined();
                    expect(rel).not.toBeNull();

                    const relParts = rel.split(' ').filter(Boolean);
                    expect(relParts).toContain('noopener');
                    expect(relParts).toContain('noreferrer');
                }
            });
        });
    });
});
