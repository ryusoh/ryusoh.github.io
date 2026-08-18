'use strict';

/**
 * Tests for the sequence skill automation script (inspect_gallery.mjs).
 */

const path = require('path');
const { execFileSync } = require('child_process');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '../..');
const INSPECT_SCRIPT = path.join(
    REPO_ROOT,
    '.agents',
    'skills',
    'sequence',
    'scripts',
    'inspect_gallery.mjs'
);

describe('sequence skill automation script', () => {
    test('inspect_gallery script exists on disk and is executable', () => {
        expect(fs.existsSync(INSPECT_SCRIPT)).toBe(true);
    });

    test('inspect_gallery parses p5 gallery and returns structured JSON', () => {
        const stdout = execFileSync('node', [INSPECT_SCRIPT, 'p5', '--json'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });

        const data = JSON.parse(stdout);
        expect(data).toHaveProperty('gallery');
        expect(data.gallery.pageId).toBe('p5');
        expect(data.gallery.title).toBe('SELF PORTRAITS AND BEHIND THE SCENES');
        expect(data.gallery.totalImages).toBe(12);
        expect(data.gallery.totalQuotes).toBe(3);

        expect(Array.isArray(data.images)).toBe(true);
        expect(data.images.length).toBe(12);

        // Check first image analysis
        const firstImg = data.images[0];
        expect(firstImg.filename).toBe('DSCF9004-3.jpg');
        expect(firstImg.exists).toBe(true);
        expect(firstImg.analysis.aspectRatio).toBe('1.50');
        expect(firstImg.analysis.orientation).toBe('landscape');
        expect(typeof firstImg.analysis.luminance).toBe('number');

        // Check quotes
        expect(Array.isArray(data.quotes)).toBe(true);
        expect(data.quotes.length).toBe(3);
    });

    test('inspect_gallery runs in formatted text mode without errors', () => {
        const stdout = execFileSync('node', [INSPECT_SCRIPT, 'p5'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });

        expect(stdout).toContain('GALLERY SEQUENCE INSPECTION: P5');
        expect(stdout).toContain('DSCF9004-3.jpg');
        expect(stdout).toContain('Interlude Quote');
    });

    test('inspect_gallery fails gracefully for non-existent gallery', () => {
        expect(() => {
            execFileSync('node', [INSPECT_SCRIPT, 'p99999'], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }).toThrow();
    });
});
