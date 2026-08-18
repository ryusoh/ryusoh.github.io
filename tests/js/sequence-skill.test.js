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

            // TDD: Generated report must be formatted and valid markdown
            expect(() => {
                execFileSync('npx', ['prettier', '--check', tempReportPath], {
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

            // Must also be formatted and valid markdown
            expect(() => {
                execFileSync('npx', ['prettier', '--check', tempReportPath], {
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

    test('inspect_gallery --report --commentary integrates custom commentary map into visual report', () => {
        const tempReportPath = path.join(
            REPO_ROOT,
            'assets',
            'img',
            'p5',
            'test-custom-comm-report.md'
        );
        const tempCommPath = path.join(REPO_ROOT, 'assets', 'img', 'p5', 'test-custom-comm.json');

        try {
            const customCommentary = {
                'DSCF9004-3.jpg': {
                    role: 'Custom Test Role',
                    subject: 'Subject Test description',
                    meaning: 'Custom Meaning Test',
                    vector: 'Custom Vector Test',
                    transition: 'Custom Transition Dynamic Test',
                },
            };
            fs.writeFileSync(tempCommPath, JSON.stringify(customCommentary), 'utf8');

            execFileSync(
                'node',
                [INSPECT_SCRIPT, 'p5', '--report', tempReportPath, '--commentary', tempCommPath],
                {
                    cwd: REPO_ROOT,
                    encoding: 'utf8',
                }
            );

            expect(fs.existsSync(tempReportPath)).toBe(true);
            const report = fs.readFileSync(tempReportPath, 'utf8');
            expect(report).toContain('Custom Test Role');
            expect(report).toContain('Subject Test description');
            expect(report).toContain('Custom Meaning Test');
            expect(report).toContain('Custom Vector Test');
            expect(report).toContain('Custom Transition Dynamic Test');
        } finally {
            if (fs.existsSync(tempReportPath)) {
                fs.unlinkSync(tempReportPath);
            }
            if (fs.existsSync(tempCommPath)) {
                fs.unlinkSync(tempCommPath);
            }
        }
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

    test('inspect_gallery dynamically adapts pacing role when sequence order shifts while preserving intrinsic commentary', () => {
        const tempReportPath = path.join(
            REPO_ROOT,
            'assets',
            'img',
            'p5',
            'test-dynamic-role-report.md'
        );

        try {
            // Reorder: Move DSCF9159.jpg (originally Frame 12 Coda) to Frame 1 Opener,
            // and DSCF9004-3.jpg (originally Frame 1 Opener) to Frame 12 Coda.
            const reorderedSequence = [
                'DSCF9159.jpg',
                '2025-05-11-0020.JPG',
                'DSCF8059.JPG',
                'DSCF1557-3.JPG',
                'DSCF5407-2.jpg',
                'DSCF8149-7.JPG',
                'DSCF8231.JPG',
                'DSCF0525.jpg',
                '849BDEFE-8868-48A8-B31D-ADB58F0161022.JPG',
                'DSCF6274.JPG',
                'IMG760.jpg',
                'DSCF9004-3.jpg',
            ];

            const script = `
                import { generateVisualReport } from './.agents/skills/sequence/scripts/inspect_gallery.mjs';
                await generateVisualReport('p5', {
                    outputPath: ${JSON.stringify(tempReportPath)},
                    sequenceOverride: ${JSON.stringify(reorderedSequence)}
                });
            `;

            execFileSync('node', ['--input-type=module', '-e', script], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });

            expect(fs.existsSync(tempReportPath)).toBe(true);
            const report = fs.readFileSync(tempReportPath, 'utf8');

            // DSCF9159 at Frame 1 should now have an Overture role (adapted dynamically)
            // while preserving its intrinsic visual subject and meaning
            expect(report).toMatch(
                /### \[1\/12\] DSCF9159\.jpg[\s\S]*?- \*Pacing Role\*: Act I: The Overture/
            );
            expect(report).toContain('eating yogurt with a spoon late at night');
            expect(report).toContain('quiet, unadorned humanity');

            // DSCF9004-3 at Frame 12 should now have a Coda role (adapted dynamically)
            // while preserving its intrinsic visual subject
            expect(report).toMatch(
                /### \[12\/12\] DSCF9004-3\.jpg[\s\S]*?- \*Pacing Role\*: Act IV: Coda/
            );
            expect(report).toContain('white helmet with both hands covering the face');
        } finally {
            if (fs.existsSync(tempReportPath)) {
                fs.unlinkSync(tempReportPath);
            }
        }
    });

    test('inspect_gallery helper functions calculate exact colorimetry and respiratory math', () => {
        const testCode = `
            import { calculateTransitionCost, calculatePairwiseTransitions, analyzeRespiratoryRhythm, deltaE, rgbToLab, parseGalleryMarkdown } from './.agents/skills/sequence/scripts/inspect_gallery.mjs';

            // 1. DeltaE exact calculation
            const lab1 = { L: 50, a: 10, b: 20 };
            const lab2 = { L: 54, a: 13, b: 20 };
            // sqrt((4)^2 + (3)^2 + 0) = 5.0
            const de = deltaE(lab1, lab2);
            if (Math.abs(de - 5.0) > 0.01) throw new Error(\`deltaE mismatch: expected 5.0, got \${de}\`);

            // 2. RGB to LAB conversion
            const whiteLab = rgbToLab(255, 255, 255);
            if (Math.abs(whiteLab.L - 100) > 1.0) throw new Error(\`whiteLab L mismatch: expected ~100, got \${whiteLab.L}\`);

            const blackLab = rgbToLab(0, 0, 0);
            if (Math.abs(blackLab.L - 0) > 1.0) throw new Error(\`blackLab L mismatch: expected ~0, got \${blackLab.L}\`);

            // 3. calculateTransitionCost with chromatic, luminance and aspect ratio delta
            const imgA = { filename: 'a.jpg', analysis: { aspectRatio: '1.50', orientation: 'landscape', luminance: 100, lab: { L: 50, a: 0, b: 0 } } };
            const imgB = { filename: 'b.jpg', analysis: { aspectRatio: '1.50', orientation: 'landscape', luminance: 50, lab: { L: 50, a: 0, b: 0 } } };
            const cost = calculateTransitionCost(imgA, imgB);
            // ΔE = 0, ΔLum = 50 -> lumStepCost = (50/255)*100 = 19.6078 -> totalCost = 19.6078 * 0.35 = 6.9
            if (cost.totalCost !== 6.9 || cost.deltaLum !== 50 || cost.deltaE !== 0) {
                throw new Error(\`calculateTransitionCost mismatch: expected 6.9, got \${cost.totalCost}\`);
            }

            // 4. analyzeRespiratoryRhythm detection
            const darkSeries = [
                { filename: '1.jpg', analysis: { luminance: 40, breathType: 'Exhalation' } },
                { filename: '2.jpg', analysis: { luminance: 45, breathType: 'Exhalation' } },
                { filename: '3.jpg', analysis: { luminance: 50, breathType: 'Exhalation' } },
            ];
            const respDark = analyzeRespiratoryRhythm(darkSeries);
            if (respDark.anomalies.length !== 1 || respDark.anomalies[0].type !== 'Suffocating Weight') {
                throw new Error('Failed to detect Suffocating Weight anomaly');
            }
            if (respDark.rhythmScore !== 85) throw new Error(\`rhythmScore mismatch: expected 85, got \${respDark.rhythmScore}\`);

            const brightSeries = [
                { filename: '1.jpg', analysis: { luminance: 160, breathType: 'Inhalation' } },
                { filename: '2.jpg', analysis: { luminance: 170, breathType: 'Inhalation' } },
                { filename: '3.jpg', analysis: { luminance: 180, breathType: 'Inhalation' } },
            ];
            const respBright = analyzeRespiratoryRhythm(brightSeries);
            if (respBright.anomalies.length !== 1 || respBright.anomalies[0].type !== 'Hyperventilation') {
                throw new Error('Failed to detect Hyperventilation anomaly');
            }

            // 5. parseGalleryMarkdown edge case with non-existent path
            const emptyMd = parseGalleryMarkdown('/tmp/nonexistent-file.md');
            if (emptyMd.entries.length !== 0) throw new Error('empty markdown parse failed');

            console.log('EXACT_MATH_PASSED');
        `;

        const stdout = execFileSync('node', ['--input-type=module', '-e', testCode], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });

        expect(stdout).toContain('EXACT_MATH_PASSED');
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
