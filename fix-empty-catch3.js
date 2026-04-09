import fs from 'fs';
import path from 'path';

function findFiles(dir, ext) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.resolve(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            if (!filePath.includes('vendor') && !filePath.includes('node_modules')) {
                results = results.concat(findFiles(filePath, ext));
            }
        } else {
            if (filePath.endsWith(ext) && !filePath.includes('vendor')) {
                results.push(filePath);
            }
        }
    }
    return results;
}

const files = findFiles(path.resolve('./js'), '.js');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Check for generic empty or mostly empty catch blocks
    // we'll replace any catch block that only contains comments or whitespace
    // or specifically has the pattern of just doing nothing or is commented out
    const catchRegex = /catch\s*\(([^)]+)\)\s*\{([^}]*)\}/g;

    content = content.replace(catchRegex, (match, param, body) => {
        // if body is completely empty, or only contains comments, or is very simple suppression
        if (body.trim() === '' || body.trim() === '// ignore' || /^\s*(\/\/[^\n]*\n\s*)*$/.test(body)) {
             return `catch (${param}) {
        if (
            typeof window !== 'undefined' &&
            window !== null &&
            window.console &&
            typeof window.console.warn === 'function'
        ) {
            window.console.warn('Caught exception:', ${param});
        }
    }`;
        }
        return match;
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated empty catch in ${file}`);
    }
});
