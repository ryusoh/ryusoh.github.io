'use strict';

/**
 * Tests for Agent Skills validation, metadata schema, and symlink discovery.
 *
 * Validates that all .agents/skills/ definitions follow the Open Agent Skills
 * specification, contain required frontmatter, use standard placeholders, and
 * that .claude/skills correctly symlinks to .agents/skills for autonomous runtimes.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SKILLS_DIR = path.join(REPO_ROOT, '.agents', 'skills');
const CLAUDE_SKILLS_SYMLINK = path.join(REPO_ROOT, '.claude', 'skills');

function parseFrontmatter(content) {
    const parts = content.split('---', 3);
    if (parts.length < 3) {
        return { frontmatter: {}, body: content.trim() };
    }

    const yamlLines = parts[1].trim().split('\n');
    const data = {};
    for (const line of yamlLines) {
        if (line.includes(':')) {
            const [key, ...rest] = line.split(':');
            const val = rest
                .join(':')
                .trim()
                .replace(/^["']|["']$/g, '');
            data[key.trim()] = val;
        }
    }
    return { frontmatter: data, body: parts[2].trim() };
}

describe('agent skills validation', () => {
    test('canonical .agents/skills directory exists and contains skills', () => {
        expect(fs.existsSync(SKILLS_DIR)).toBe(true);
        expect(fs.statSync(SKILLS_DIR).isDirectory()).toBe(true);
        const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
        const skills = entries.filter((e) => e.isDirectory());
        expect(skills.length).toBeGreaterThan(0);
    });

    test('each skill subfolder has a valid SKILL.md with required frontmatter', () => {
        const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
        const skillDirs = entries.filter((e) => e.isDirectory());

        for (const skillDir of skillDirs) {
            const skillPath = path.join(SKILLS_DIR, skillDir.name);
            const skillMd = path.join(skillPath, 'SKILL.md');

            expect(fs.existsSync(skillMd)).toBe(true);

            const content = fs.readFileSync(skillMd, 'utf8');
            const { frontmatter, body } = parseFrontmatter(content);

            expect(frontmatter).toHaveProperty('name');
            expect(frontmatter.name).toBe(skillDir.name);
            expect(frontmatter).toHaveProperty('description');
            expect(frontmatter.description.length).toBeGreaterThan(10);
            expect(body.length).toBeGreaterThan(0);

            // Canonical skills should use open standard {{args}}, not Claude's generated $ARGUMENTS
            expect(body).not.toContain('$ARGUMENTS');
        }
    });

    test('.claude/skills symlink exists and resolves to .agents/skills', () => {
        expect(fs.existsSync(CLAUDE_SKILLS_SYMLINK)).toBe(true);
        const lstat = fs.lstatSync(CLAUDE_SKILLS_SYMLINK);
        expect(lstat.isSymbolicLink()).toBe(true);

        const resolvedTarget = fs.realpathSync(CLAUDE_SKILLS_SYMLINK);
        const expectedTarget = fs.realpathSync(SKILLS_DIR);
        expect(resolvedTarget).toBe(expectedTarget);
    });

    test('self-contained skill bundles have valid directory structure', () => {
        const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
        const skillDirs = entries.filter((e) => e.isDirectory());

        for (const skillDir of skillDirs) {
            const skillPath = path.join(SKILLS_DIR, skillDir.name);

            const scriptsDir = path.join(skillPath, 'scripts');
            if (fs.existsSync(scriptsDir) && fs.statSync(scriptsDir).isDirectory()) {
                const scripts = fs.readdirSync(scriptsDir);
                expect(scripts.length).toBeGreaterThan(0);
            }

            const refsDir = path.join(skillPath, 'references');
            if (fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()) {
                const refs = fs.readdirSync(refsDir);
                expect(refs.length).toBeGreaterThan(0);
            }
        }
    });
});
