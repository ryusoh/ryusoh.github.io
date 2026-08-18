'use strict';

/**
 * Verify that tool and script files referenced in agent docs and skills exist on disk.
 *
 * Ensures automated cleanup bots (e.g. Janitor) and refactors never delete
 * standalone CLI tools, page builders, or helper scripts that are referenced by
 * agent workflows, skills, or documentation.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');

// Regex pattern to extract scripts/, tools/, bin/, or skill-scoped script paths from markdown text
const SCRIPT_REF_PATTERN =
    /(?:^|[\s`"'])((?:\.agents\/skills\/[a-zA-Z0-9_-]+\/)?(?:scripts|tools|bin)\/[a-zA-Z0-9_\-/\.]+\.(?:js|mjs|cjs|py|sh|html|json|ya?ml))/g;

function collectMarkdownFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) {
        return results;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectMarkdownFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push(fullPath);
        }
    }
    return results;
}

function getAllDocFiles() {
    const files = [path.join(REPO_ROOT, 'AGENTS.md')];

    const julesDir = path.join(REPO_ROOT, '.jules');
    if (fs.existsSync(julesDir)) {
        files.push(...collectMarkdownFiles(julesDir));
    }

    const skillsDir = path.join(REPO_ROOT, '.agents', 'skills');
    if (fs.existsSync(skillsDir)) {
        files.push(...collectMarkdownFiles(skillsDir));
    }

    return files.filter((f) => fs.existsSync(f));
}

describe('doc-tool-references', () => {
    test('all scripts in scripts/, tools/, or bin/ referenced by agent docs must exist on disk', () => {
        const docFiles = getAllDocFiles();
        expect(docFiles.length).toBeGreaterThan(0);

        const missingRefs = [];

        for (const docFile of docFiles) {
            const content = fs.readFileSync(docFile, 'utf8');
            let match;
            const regex = new RegExp(SCRIPT_REF_PATTERN.source, SCRIPT_REF_PATTERN.flags);
            while ((match = regex.exec(content)) !== null) {
                const scriptRelPath = match[1];
                const scriptFullPath = path.join(REPO_ROOT, scriptRelPath);
                if (!fs.existsSync(scriptFullPath)) {
                    const relativeDoc = path.relative(REPO_ROOT, docFile);
                    missingRefs.push(`${relativeDoc} references missing script: ${scriptRelPath}`);
                }
            }
        }

        expect(missingRefs).toEqual([]);
    });

    test('core infrastructure tools and scripts exist', () => {
        const coreTools = [
            'scripts/gate-guard.js',
            'scripts/check-thinking-comments.js',
            'scripts/coverage-rank.js',
            'scripts/run-npx.sh',
            'scripts/sync-pages.mjs',
            'scripts/build-page.mjs',
            'scripts/templates/portfolio-shell.html',
            'tools/sync_commands.py',
        ];

        const missing = coreTools.filter((tool) => !fs.existsSync(path.join(REPO_ROOT, tool)));
        expect(missing).toEqual([]);
    });
});
