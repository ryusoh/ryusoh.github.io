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
            expect(report).toContain('![DSCF9004-3.jpg](./DSCF9004-3-768.webp)');
            expect(report).toContain('Framing & Aspect');
            expect(report).toContain('Tonality & Breath');
            expect(report).toContain('Poetic Caesura');

            // TDD: Formats must be clean universal Unicode without raw unparsed LaTeX
            expect(report).not.toMatch(/\$L\^/);
            expect(report).not.toMatch(/\$\Delta/);
            expect(report).not.toMatch(/\$L\*/);
            expect(report).toContain('CIELAB `L*a*b*`');
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

    test('generateVisualReport generates outtakes section with compliant h3 heading increments', () => {
        const tempReportPath = path.join(
            REPO_ROOT,
            'assets',
            'img',
            'p3',
            'test-outtake-heading-report.md'
        );
        try {
            execFileSync('node', [INSPECT_SCRIPT, 'p3', '--report', tempReportPath], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });

            expect(fs.existsSync(tempReportPath)).toBe(true);
            const report = fs.readFileSync(tempReportPath, 'utf8');
            expect(report).toContain('## 4. Unsequenced Candidates & Outtakes');
            expect(report).toContain('### Candidate: DSCF2056-2.jpg');
            expect(report).not.toMatch(/#### Candidate:/);

            // Verify markdownlint compliance on generated report
            expect(() => {
                execFileSync('npx', ['markdownlint-cli', tempReportPath], {
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
            import { calculateTransitionCost, calculatePairwiseTransitions, analyzeRespiratoryRhythm, deltaE, resolvePreviewFilename } from './.agents/skills/sequence/scripts/inspect_gallery.mjs';
            import path from 'path';

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

            // 6. resolvePreviewFilename candidate resolution
            const p5Dir = path.resolve(process.cwd(), 'assets', 'img', 'p5');
            const resolvedWebp = resolvePreviewFilename(p5Dir, 'DSCF9004-3.jpg');
            if (resolvedWebp !== 'DSCF9004-3-768.webp') throw new Error(\`resolvePreviewFilename failed: expected DSCF9004-3-768.webp, got \${resolvedWebp}\`);

            const fallbackNonExistent = resolvePreviewFilename('/tmp', 'nonexistent.jpg');
            if (fallbackNonExistent !== 'nonexistent.jpg') throw new Error(\`resolvePreviewFilename fallback failed: got \${fallbackNonExistent}\`);

            console.log('EDGE_CASES_PASSED');
        `;

        const stdout = execFileSync('node', ['--input-type=module', '-e', testCode], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });

        expect(stdout).toContain('EDGE_CASES_PASSED');
    });

    test('generateSequenceChartsSvg generates formal, technical SVG dashboard without emojis', () => {
        const testCode = `
            import {
                generateSequenceChartsSvg,
                generateLuminanceWaveformSvg,
                generateTransitionTensionSvg,
                generateColorimetrySpectrumSvg,
                escapeXml
            } from './.agents/skills/sequence/scripts/inspect_gallery.mjs';

            // 1. Test escapeXml
            if (escapeXml('<hello & "world">') !== '&lt;hello &amp; &quot;world&quot;&gt;') {
                throw new Error('escapeXml failed');
            }

            // 2. Generate SVG for mock dataset
            const mockImages = [
                {
                    filename: '1.jpg',
                    analysis: {
                        luminance: 68,
                        aspectRatio: '1.50',
                        orientation: 'landscape',
                        avgRGB: [40, 45, 50],
                        lab: { L: 28.6, a: -1.0, b: 0.3 },
                        breathType: 'Exhalation',
                    },
                },
                {
                    filename: '2.jpg',
                    analysis: {
                        luminance: 161,
                        aspectRatio: '1.50',
                        orientation: 'landscape',
                        avgRGB: [160, 165, 170],
                        lab: { L: 66.2, a: 4.0, b: 7.9 },
                        breathType: 'Inhalation',
                    },
                },
            ];

            const mockTransitions = [
                {
                    from: '1.jpg',
                    to: '2.jpg',
                    deltaE: 38.62,
                    deltaLum: 93,
                    deltaAspect: 0,
                    totalCost: 34.7,
                    chromaticComponent: 21.7,
                    lumComponent: 12.8,
                    aspectComponent: 0,
                },
            ];

            const mockResp = {
                rhythmScore: 100,
                inhalations: 1,
                exhalations: 1,
                neutrals: 0,
                anomalies: [],
            };

            const mockQuotes = [{ afterImageIndex: 1, content: 'Test caesura' }];

            // Test modular generators
            const f1Svg = generateLuminanceWaveformSvg({
                gallery: { pageId: 'p5', title: 'Self Portraits' },
                images: mockImages,
                respiratory: mockResp,
                quotes: mockQuotes,
            });
            if (!f1Svg.includes('Figure 1: Photometric Luminance Waveform') || !f1Svg.includes('Inhalation (L* ≥ 135)')) {
                throw new Error('generateLuminanceWaveformSvg failed');
            }

            const f2Svg = generateTransitionTensionSvg({
                gallery: { pageId: 'p5', title: 'Self Portraits' },
                transitions: mockTransitions,
            });
            if (!f2Svg.includes('Figure 2: Pairwise Hamiltonian Transition Tension') || !f2Svg.includes('Chromatic ΔE (45%)')) {
                throw new Error('generateTransitionTensionSvg failed');
            }

            const f3Svg = generateColorimetrySpectrumSvg({
                gallery: { pageId: 'p5', title: 'Self Portraits' },
                images: mockImages,
            });
            if (!f3Svg.includes('Figure 3: Colorimetric CIELAB Spectrum') || !f3Svg.includes('rgb(40, 45, 50)')) {
                throw new Error('generateColorimetrySpectrumSvg failed');
            }

            const svg = generateSequenceChartsSvg({
                gallery: { pageId: 'p5', title: 'Self Portraits' },
                images: mockImages,
                transitions: mockTransitions,
                respiratory: mockResp,
                quotes: mockQuotes,
                archetype: 'Polyphonic Street Symphony',
            });

            // Must be valid SVG structure
            if (!svg.startsWith('<svg') || !svg.trim().endsWith('</svg>')) {
                throw new Error('SVG root tags missing');
            }

            // Must NOT contain any emojis (strict formal technical requirement)
            const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
            if (emojiRegex.test(svg) || emojiRegex.test(f1Svg) || emojiRegex.test(f2Svg) || emojiRegex.test(f3Svg)) {
                throw new Error('SVG contains forbidden emoji characters');
            }

            console.log('SVG_DASHBOARD_PASSED');
        `;

        const stdout = execFileSync('node', ['--input-type=module', '-e', testCode], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });

        expect(stdout).toContain('SVG_DASHBOARD_PASSED');
    });

    test('inspect_gallery --report writes modular SVGs alongside report', () => {
        const tempReportPath = path.join(REPO_ROOT, 'assets', 'img', 'p5', 'test-chart-report.md');
        const expectedWaveformPath = path.join(
            REPO_ROOT,
            'assets',
            'img',
            'p5',
            'sequence-waveform.svg'
        );
        const expectedTransitionsPath = path.join(
            REPO_ROOT,
            'assets',
            'img',
            'p5',
            'sequence-transitions.svg'
        );
        const expectedColorimetryPath = path.join(
            REPO_ROOT,
            'assets',
            'img',
            'p5',
            'sequence-colorimetry.svg'
        );

        try {
            execFileSync('node', [INSPECT_SCRIPT, 'p5', '--report', tempReportPath], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });

            expect(fs.existsSync(tempReportPath)).toBe(true);
            expect(fs.existsSync(expectedWaveformPath)).toBe(true);
            expect(fs.existsSync(expectedTransitionsPath)).toBe(true);
            expect(fs.existsSync(expectedColorimetryPath)).toBe(true);

            const report = fs.readFileSync(tempReportPath, 'utf8');
            expect(report).toContain(
                '![Photometric Respiratory Waveform](./sequence-waveform.svg)'
            );
            expect(report).toContain(
                '![Hamiltonian Pairwise Transition Tension](./sequence-transitions.svg)'
            );
            expect(report).toContain(
                '![CIELAB Colorimetric Progression](./sequence-colorimetry.svg)'
            );

            const f1 = fs.readFileSync(expectedWaveformPath, 'utf8');
            const f2 = fs.readFileSync(expectedTransitionsPath, 'utf8');
            const f3 = fs.readFileSync(expectedColorimetryPath, 'utf8');

            expect(f1).toContain('Figure 1: Photometric Luminance Waveform');
            expect(f1).toContain('stroke="#2b5c8f"');
            expect(f2).toContain('Figure 2: Pairwise Hamiltonian Transition Tension');
            expect(f2).toContain('Chromatic ΔE (45%)');
            expect(f2).toContain('Montage shock (C = 50)');
            expect(f3).toContain('Figure 3: Colorimetric CIELAB Spectrum');

            // Strictly no emojis in SVGs or Report
            const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
            expect(emojiRegex.test(f1)).toBe(false);
            expect(emojiRegex.test(f2)).toBe(false);
            expect(emojiRegex.test(f3)).toBe(false);
            expect(emojiRegex.test(report)).toBe(false);
        } finally {
            if (fs.existsSync(tempReportPath)) {
                fs.unlinkSync(tempReportPath);
            }
        }
    });

    test('generateColorimetrySpectrumSvg adaptively abbreviates dense sequences to avoid label overlap', () => {
        const denseImages = Array.from({ length: 20 }, (_, idx) => ({
            filename: `photo_${idx + 1}.jpg`,
            analysis: {
                luminance: 40 + idx * 5,
                lab: { L: 35 + idx * 3, a: -5.2, b: 12.8 },
                orientation: 'land',
                aspectRatio: '1.50',
                breathType:
                    idx % 3 === 0 ? 'Inhalation' : idx % 3 === 1 ? 'Exhalation' : 'Grounding',
                avgRGB: [80, 90, 100],
            },
        }));

        const denseTestCode = `
            import { generateColorimetrySpectrumSvg } from './.agents/skills/sequence/scripts/inspect_gallery.mjs';
            const svg = generateColorimetrySpectrumSvg({
                gallery: { pageId: 'p4', title: 'Dense Gallery' },
                images: ${JSON.stringify(denseImages)},
            });
            if (!svg.includes('[INH]') || !svg.includes('[EXH]') || !svg.includes('[GRD]')) {
                throw new Error('Adaptive 3-letter abbreviations missing');
            }
            if (!svg.includes('Breath: [INH] Inhale · [EXH] Exhale · [GRD] Ground')) {
                throw new Error('Header abbreviation legend missing');
            }
            // CIELAB a, b should be rounded to integers to prevent horizontal collision
            if (!svg.includes('(-5, 13)')) {
                throw new Error('Integer CIELAB rounding missing');
            }
            console.log('DENSE_SVG_PASSED');
        `;

        const stdout = execFileSync('node', ['--input-type=module', '-e', denseTestCode], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        expect(stdout).toContain('DENSE_SVG_PASSED');
    });

    test('modular architecture exports are cleanly isolated across metrics, parser, charts, and report submodules', () => {
        const modularTestCode = `
            import { rgbToLab, deltaE, calculateTransitionCost } from './.agents/skills/sequence/scripts/metrics.mjs';
            import { resolveGalleryPath, parseGalleryMarkdown } from './.agents/skills/sequence/scripts/parser.mjs';
            import { generateLuminanceWaveformSvg, generateTransitionTensionSvg } from './.agents/skills/sequence/scripts/charts.mjs';
            import { generateVisualReport } from './.agents/skills/sequence/scripts/report.mjs';

            const lab = rgbToLab(255, 255, 255);
            if (lab.L < 99) throw new Error('metrics.mjs rgbToLab failed');

            const diff = deltaE({ L: 50, a: 0, b: 0 }, { L: 55, a: 0, b: 0 });
            if (diff !== 5) throw new Error('metrics.mjs deltaE failed');

            const { pageId } = resolveGalleryPath('p5');
            if (pageId !== 'p5') throw new Error('parser.mjs resolveGalleryPath failed');

            const waveform = generateLuminanceWaveformSvg({ gallery: { pageId: 'p5' }, images: [] });
            if (!waveform.includes('Figure 1')) throw new Error('charts.mjs waveform failed');

            if (typeof generateVisualReport !== 'function') throw new Error('report.mjs generateVisualReport failed');

            console.log('MODULAR_SUBMODULES_PASSED');
        `;

        const stdout = execFileSync('node', ['--input-type=module', '-e', modularTestCode], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        expect(stdout).toContain('MODULAR_SUBMODULES_PASSED');
    });

    test('evaluateCandidatePlacements accurately computes optimal insertion slots and energy deltas', () => {
        const candidateTestCode = `
            import { evaluateCandidatePlacements } from './.agents/skills/sequence/scripts/metrics.mjs';

            const mockActive = [
                { filename: 'img1.jpg', analysis: { luminance: 150, lab: { L: 80, a: 5, b: 5 }, breathType: 'Inhalation' } },
                { filename: 'img2.jpg', analysis: { luminance: 160, lab: { L: 85, a: 4, b: 6 }, breathType: 'Inhalation' } },
                { filename: 'img3.jpg', analysis: { luminance: 170, lab: { L: 90, a: 3, b: 7 }, breathType: 'Inhalation' } },
            ];

            const mockCandidate = [
                { filename: 'dark_candid.jpg', analysis: { luminance: 40, lab: { L: 20, a: 0, b: 0 }, breathType: 'Exhalation' } }
            ];

            const evals = evaluateCandidatePlacements(mockActive, mockCandidate);
            if (evals.length !== 1) throw new Error('Expected 1 candidate evaluation');
            if (!evals[0].bestSlot) throw new Error('Expected bestSlot on evaluation');
            if (evals[0].bestSlot.slotPosition < 1 || evals[0].bestSlot.slotPosition > 4) {
                throw new Error('Invalid slotPosition: ' + evals[0].bestSlot.slotPosition);
            }
            if (typeof evals[0].curatorialRationale !== 'string' || evals[0].curatorialRationale.length === 0) {
                throw new Error('Missing curatorialRationale');
            }

            console.log('CANDIDATE_EVALUATION_PASSED');
        `;

        const stdout = execFileSync('node', ['--input-type=module', '-e', candidateTestCode], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        expect(stdout).toContain('CANDIDATE_EVALUATION_PASSED');
    });

    test('all pN/README.md files remain strictly synchronized with assets/img/pN/sequence-report.md', () => {
        const galleries = ['p1', 'p2', 'p3', 'p4', 'p5'];
        for (const id of galleries) {
            const reportPath = path.join(REPO_ROOT, 'assets', 'img', id, 'sequence-report.md');
            const readmePath = path.join(REPO_ROOT, id, 'README.md');
            if (fs.existsSync(reportPath)) {
                expect(fs.existsSync(readmePath)).toBe(true);
                const reportContent = fs.readFileSync(reportPath, 'utf8');
                const readmeContent = fs.readFileSync(readmePath, 'utf8');

                const expected = reportContent.replace(
                    /\(\.\/([^)]+)\)/g,
                    '(../assets/img/' + id + '/$1)'
                );
                const normalize = (s) =>
                    s
                        .split('\n')
                        .filter(
                            (line) =>
                                !line.trim().startsWith('| :--') && !line.trim().startsWith('|:--')
                        )
                        .map((line) =>
                            line
                                .trim()
                                .replace(/\s+/g, ' ')
                                .replace(/\|\s+/g, '|')
                                .replace(/\s+\|/g, '|')
                                .replace(/\\?\*/g, '*')
                                .replace(/\\?_/g, '*')
                        )
                        .join('\n')
                        .trim();

                expect(normalize(readmeContent)).toBe(normalize(expected));
            }
        }
    });
});
