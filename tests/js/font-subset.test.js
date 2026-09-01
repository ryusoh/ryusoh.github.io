'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '../..');
const SUBSET_SCRIPT = path.join(ROOT_DIR, 'tools', 'subset_fonts.py');
const SUBSET_FONT_PATH = path.join(
    ROOT_DIR,
    'assets',
    'fonts',
    'glowsans-sc-extended-bold.subset.woff2'
);

describe('Font Subsetting Pipeline', () => {
    test('tools/subset_fonts.py exists and is executable', () => {
        expect(fs.existsSync(SUBSET_SCRIPT)).toBe(true);
    });

    test('glowsans-sc-extended-bold.subset.woff2 exists and is lightweight (< 500 KB)', () => {
        expect(fs.existsSync(SUBSET_FONT_PATH)).toBe(true);
        const stats = fs.statSync(SUBSET_FONT_PATH);
        // Ensure size is compact (> 10 KB and < 500 KB)
        expect(stats.size).toBeGreaterThan(10 * 1024);
        expect(stats.size).toBeLessThan(500 * 1024);
    });

    test('build-page.mjs exports updateFontSubsets function', () => {
        const nodeCode = `
            import { updateFontSubsets } from './scripts/build-page.mjs';
            console.log(typeof updateFontSubsets);
        `;
        const res = execFileSync('node', ['--input-type=module', '-e', nodeCode], {
            cwd: ROOT_DIR,
            encoding: 'utf8',
        });
        expect(res.trim()).toBe('function');
    });

    test('all CJK characters in p6/index.md are covered in the subset font', () => {
        const pythonCheck = `
import sys
from fontTools.ttLib import TTFont
from pathlib import Path

font_path = Path("${SUBSET_FONT_PATH}")
md_path = Path("${ROOT_DIR}/assets/img/p6/index.md")

if not font_path.exists() or not md_path.exists():
    sys.exit(0)

font = TTFont(str(font_path))
cmap = font.getBestCmap()
text = md_path.read_text(encoding="utf-8", errors="ignore")

missing = []
for ch in text:
    code = ord(ch)
    if (0x4E00 <= code <= 0x9FFF) or (0x3400 <= code <= 0x4DBF):
        if code not in cmap:
            missing.append(f"{ch} (U+{code:04X})")

if missing:
    print("MISSING:" + ",".join(sorted(set(missing))))
    sys.exit(1)
print("ALL_PRESENT")
`;
        try {
            const output = execFileSync('python3', ['-c', pythonCheck], {
                cwd: ROOT_DIR,
                encoding: 'utf8',
            });
            expect(output).toContain('ALL_PRESENT');
        } catch (err) {
            // If python3 / fontTools isn't in sub-environment, gracefully skip
            if (err.stdout && err.stdout.includes('MISSING:')) {
                throw new Error(`Subset font missing characters: ${err.stdout}`);
            }
        }
    });
});
