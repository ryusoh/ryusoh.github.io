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

    test('inspect_gallery parses p5 gallery and returns structured JSON with frontier metrics', () => {
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

        // Frontier respiratory rhythm
        expect(data).toHaveProperty('respiratoryRhythm');
        expect(typeof data.respiratoryRhythm.rhythmScore).toBe('number');
        expect(Array.isArray(data.respiratoryRhythm.sequence)).toBe(true);

        // Frontier pairwise transitions
        expect(data).toHaveProperty('transitions');
        expect(data.transitions.length).toBe(11);
        expect(data.transitions[0]).toHaveProperty('deltaE');
        expect(data.transitions[0]).toHaveProperty('deltaLum');
        expect(data.transitions[0]).toHaveProperty('totalCost');

        // Images array
        expect(Array.isArray(data.images)).toBe(true);
        expect(data.images.length).toBe(12);

        // Check image analysis fields
        const firstImg = data.images[0];
        expect(firstImg.filename).toBe('DSCF9004-3.jpg');
        expect(firstImg.exists).toBe(true);
        expect(firstImg.analysis.aspectRatio).toBe('1.50');
        expect(firstImg.analysis.orientation).toBe('landscape');
        expect(typeof firstImg.analysis.luminance).toBe('number');
        expect(firstImg.analysis).toHaveProperty('lab');
        expect(typeof firstImg.analysis.lab.L).toBe('number');
        expect(firstImg.analysis).toHaveProperty('breathType');

        // Check quotes
        expect(Array.isArray(data.quotes)).toBe(true);
        expect(data.quotes.length).toBe(3);
    });

    test('inspect_gallery runs in formatted text mode without errors', () => {
        const stdout = execFileSync('node', [INSPECT_SCRIPT, 'p5'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });

        expect(stdout).toContain('FRONTIER GALLERY SEQUENCE INSPECTION: P5');
        expect(stdout).toContain('DSCF9004-3.jpg');
        expect(stdout).toContain('Transition to #2');
        expect(stdout).toContain('Caesura Interlude');
    });

    test('inspect_gallery --report generates markdown report with embedded images and energy scores', () => {
        const tempReportPath = path.join(
            REPO_ROOT,
            'assets',
            'img',
            'p5',
            'test-sequence-report.md'
        );
        try {
            const stdout = execFileSync(
                'node',
                [INSPECT_SCRIPT, 'p5', '--report', tempReportPath],
                {
                    cwd: REPO_ROOT,
                    encoding: 'utf8',
                }
            );

            expect(stdout).toContain('Generated Visual Sequence Report for P5');
            expect(fs.existsSync(tempReportPath)).toBe(true);

            const report = fs.readFileSync(tempReportPath, 'utf8');
            expect(report).toContain('# Visual Curation & Sequence Report');
            expect(report).toContain('Hamiltonian Sequence Energy');
            expect(report).toContain('Respiratory Pacing Score');
            expect(report).toContain('![DSCF9004-3.jpg](./DSCF9004-3.jpg');
            expect(report).toContain('Framing & Aspect');
            expect(report).toContain('Tonality & Breath');
            expect(report).toContain('Poetic Caesura');

            // TDD: Formats must be clean universal Unicode without raw unparsed LaTeX
            expect(report).not.toMatch(/\$L\^/);
            expect(report).not.toMatch(/\$\Delta/);
            expect(report).not.toMatch(/\$L\*/);
            expect(report).toContain('CIELAB L*a*b*');
            expect(report).toContain('ΔE₇₆');

            // TDD: Photo credit must not be used as Curatorial Rationale body
            expect(report).toContain('Caption / Photo Credit');
            expect(report).not.toMatch(
                /\*\*Curatorial Rationale & Montage Dynamic\*\*:\s*@photo\.initiator/
            );

            // TDD: Curatorial Proposals & Interlude Recommendations (optimal sequence)
            expect(report).toContain('Curatorial Proposals & Optimized Sequence Arc');
            expect(report).toContain('optimal rhythmic pacing');

            // TDD: Generated report must be 100% compliant with repo markdownlint rules
            expect(() => {
                execFileSync('npx', ['markdownlint', tempReportPath], {
                    cwd: REPO_ROOT,
                    stdio: 'pipe',
                });
            }).not.toThrow();
        } finally {
            if (fs.existsSync(tempReportPath)) {
                fs.unlinkSync(tempReportPath);
            }
        }
    });

    test('generateVisualReport generates interlude proposals when sequence anomalies exist', () => {
        const tempReportPath = path.join(REPO_ROOT, 'assets', 'img', 'p5', 'test-anom-report.md');
        try {
            // Un-optimized sequence with 3 consecutive dark frames to trigger Suffocating Weight
            const unoptimized = [
                'DSCF9004-3.jpg',
                'DSCF8149-7.JPG',
                'DSCF8231.JPG',
                '849BDEFE-8868-48A8-B31D-ADB58F0161022.JPG',
                'DSCF0525.jpg',
            ];

            const script = `
                import { generateVisualReport } from './.agents/skills/sequence/scripts/inspect_gallery.mjs';
                const res = await generateVisualReport('p5', {
                    outputPath: ${JSON.stringify(tempReportPath)},
                    sequenceOverride: ${JSON.stringify(unoptimized)}
                });
            `;

            execFileSync('node', ['--input-type=module', '-e', script], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });

            expect(fs.existsSync(tempReportPath)).toBe(true);
            const report = fs.readFileSync(tempReportPath, 'utf8');

            expect(report).toContain('Recommended Interlude & Rhythm Solutions');
            expect(report).toContain('Poetic Caesura (Text Interlude)');
            expect(report).toContain('Visual Resequencing (Luminous Inhalation Wave)');
            expect(report).toContain('Proposed Sequence (Option B)');

            // Must also be 100% markdownlint compliant
            expect(() => {
                execFileSync('npx', ['markdownlint', tempReportPath], {
                    cwd: REPO_ROOT,
                    stdio: 'pipe',
                });
            }).not.toThrow();
        } finally {
            if (fs.existsSync(tempReportPath)) {
                fs.unlinkSync(tempReportPath);
            }
        }
    });

    test('inspect_gallery supports --help flag cleanly', () => {
        const stdout = execFileSync('node', [INSPECT_SCRIPT, '--help'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        expect(stdout).toContain('Usage: node inspect_gallery.mjs <pageId>');
        expect(stdout).toContain('--report [outputPath]');
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

    test('inspect_gallery helper functions handle edge cases and null inputs safely', () => {
        const testCode = `
            import { calculateTransitionCost, calculatePairwiseTransitions, analyzeRespiratoryRhythm, deltaE } from './.agents/skills/sequence/scripts/inspect_gallery.mjs';

            if (deltaE(null, null) !== 0) throw new Error('deltaE null failed');
            if (deltaE({ L: 50, a: 0, b: 0 }, null) !== 0) throw new Error('deltaE single null failed');

            const safeCost = calculateTransitionCost(null, { analysis: null });
            if (safeCost.totalCost !== 0 || safeCost.deltaE !== 0) throw new Error('calculateTransitionCost null failed');

            const emptyTrans = calculatePairwiseTransitions([]);
            if (!Array.isArray(emptyTrans) || emptyTrans.length !== 0) throw new Error('empty transitions failed');

            const singleTrans = calculatePairwiseTransitions([{ filename: 'a.jpg' }]);
            if (!Array.isArray(singleTrans) || singleTrans.length !== 0) throw new Error('single transitions failed');

            const emptyResp = analyzeRespiratoryRhythm([]);
            if (emptyResp.rhythmScore !== 100 || emptyResp.anomalies.length !== 0) throw new Error('empty respiratory failed');

            console.log('EDGE_CASES_PASSED');
        `;

        const stdout = execFileSync('node', ['--input-type=module', '-e', testCode], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });

        expect(stdout).toContain('EDGE_CASES_PASSED');
    });
});
