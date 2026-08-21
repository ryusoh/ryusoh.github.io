'use strict';

/**
 * Tests for Deterministic Gaze Vector & Head Pose Pre-processor (gaze.mjs).
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');
const GAZE_SCRIPT = path.join(REPO_ROOT, '.agents', 'skills', 'sequence', 'scripts', 'gaze.mjs');

function runEsm(code) {
    const stdout = execFileSync('node', ['--input-type=module', '-e', code], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
    return JSON.parse(stdout.trim());
}

describe('Deterministic Gaze Vector Pre-processor (gaze.mjs)', () => {
    test('gaze.mjs exists on disk and has valid ESM syntax', () => {
        expect(fs.existsSync(GAZE_SCRIPT)).toBe(true);
        const res = runEsm(`
            import * as gaze from './.agents/skills/sequence/scripts/gaze.mjs';
            console.log(JSON.stringify({
                hasPose: typeof gaze.computeHeadPose === 'function',
                hasEye: typeof gaze.computeEyeContact === 'function',
                hasSessions: typeof gaze.createSessions === 'function',
                hasEstimateImg: typeof gaze.estimateGazeForImage === 'function',
                hasEstimateGal: typeof gaze.estimateGazeForGallery === 'function',
                hasNms: typeof gaze.weightedNms === 'function',
                hasSvd: typeof gaze.svd3 === 'function',
                hasDet: typeof gaze.det3 === 'function',
            }));
        `);
        expect(res.hasPose).toBe(true);
        expect(res.hasEye).toBe(true);
        expect(res.hasSessions).toBe(true);
        expect(res.hasEstimateImg).toBe(true);
        expect(res.hasEstimateGal).toBe(true);
        expect(res.hasNms).toBe(true);
        expect(res.hasSvd).toBe(true);
        expect(res.hasDet).toBe(true);
    });

    describe('Pure-JS Pose Math & Landmark Fitting (Hermetic)', () => {
        test('canonical frontal face landmarks produce yaw ≈ 0°, pitch ≈ 0°, roll ≈ 0° and eyeContact true', () => {
            const res = runEsm(`
                import fs from 'fs';
                import { computeHeadPose, computeEyeContact } from './.agents/skills/sequence/scripts/gaze.mjs';
                const frontalData = JSON.parse(fs.readFileSync('tests/fixtures/gaze-synthetic-frontal.json', 'utf8'));
                const pose = computeHeadPose(frontalData);
                const eye = computeEyeContact(frontalData, pose.yawDeg, pose.pitchDeg);
                console.log(JSON.stringify({ pose, eye }));
            `);

            expect(Math.abs(res.pose.yawDeg)).toBeLessThanOrEqual(1.0);
            expect(Math.abs(res.pose.pitchDeg)).toBeLessThanOrEqual(1.0);
            expect(Math.abs(res.pose.rollDeg)).toBeLessThanOrEqual(1.0);
            expect(res.eye.eyeContact).toBe(true);
            expect(Math.abs(res.eye.irisOffset.left.x)).toBeLessThanOrEqual(0.1);
            expect(Math.abs(res.eye.irisOffset.right.x)).toBeLessThanOrEqual(0.1);
        });

        test('synthetic 30°-yaw rotated face landmarks produce yaw ≈ 30° and eyeContact false', () => {
            const res = runEsm(`
                import fs from 'fs';
                import { computeHeadPose, computeEyeContact } from './.agents/skills/sequence/scripts/gaze.mjs';
                const yaw30Data = JSON.parse(fs.readFileSync('tests/fixtures/gaze-synthetic-yaw30.json', 'utf8'));
                const pose = computeHeadPose(yaw30Data);
                const eye = computeEyeContact(yaw30Data, pose.yawDeg, pose.pitchDeg);
                console.log(JSON.stringify({ pose, eye }));
            `);

            expect(Math.abs(res.pose.yawDeg - 30.0)).toBeLessThanOrEqual(2.0);
            expect(Math.abs(res.pose.pitchDeg)).toBeLessThanOrEqual(2.0);
            expect(res.eye.eyeContact).toBe(false);
        });

        test('synthetic frontal face with off-center irises produces eyeContact false', () => {
            const res = runEsm(`
                import fs from 'fs';
                import { computeHeadPose, computeEyeContact } from './.agents/skills/sequence/scripts/gaze.mjs';
                const lookAwayData = JSON.parse(fs.readFileSync('tests/fixtures/gaze-synthetic-lookaway.json', 'utf8'));
                const pose = computeHeadPose(lookAwayData);
                const eye = computeEyeContact(lookAwayData, pose.yawDeg, pose.pitchDeg);
                console.log(JSON.stringify({ pose, eye }));
            `);

            expect(Math.abs(res.pose.yawDeg)).toBeLessThanOrEqual(1.0);
            expect(Math.abs(res.pose.pitchDeg)).toBeLessThanOrEqual(1.0);
            expect(res.eye.eyeContact).toBe(false);
            expect(Math.abs(res.eye.irisOffset.left.x)).toBeGreaterThan(0.35);
        });

        test('svd3 and det3 accurately compute matrix decomposition and determinants', () => {
            const res = runEsm(`
                import { svd3, det3 } from './.agents/skills/sequence/scripts/gaze.mjs';
                const identity = [[1,0,0],[0,1,0],[0,0,1]];
                const svd = svd3(identity);
                const detId = det3(identity);
                const reflection = [[-1,0,0],[0,1,0],[0,0,1]];
                const detRef = det3(reflection);
                console.log(JSON.stringify({ svd, detId, detRef }));
            `);

            expect(res.svd.S[0]).toBeCloseTo(1.0, 5);
            expect(res.svd.S[1]).toBeCloseTo(1.0, 5);
            expect(res.svd.S[2]).toBeCloseTo(1.0, 5);
            expect(res.detId).toBe(1);
            expect(res.detRef).toBe(-1);
        });

        test('weightedNms blends overlapping candidates weighted by score', () => {
            const res = runEsm(`
                import { weightedNms } from './.agents/skills/sequence/scripts/gaze.mjs';
                const candidates = [
                    { score: 0.9, cx: 0.5, cy: 0.5, w: 0.2, h: 0.2, keypoints: new Array(6).fill({ x: 0.5, y: 0.5 }) },
                    { score: 0.6, cx: 0.52, cy: 0.52, w: 0.2, h: 0.2, keypoints: new Array(6).fill({ x: 0.52, y: 0.52 }) },
                    { score: 0.8, cx: 0.1, cy: 0.1, w: 0.1, h: 0.1, keypoints: new Array(6).fill({ x: 0.1, y: 0.1 }) }
                ];
                const nms = weightedNms(candidates, 0.3);
                console.log(JSON.stringify(nms));
            `);

            expect(res.length).toBe(2);
            expect(res[0].score).toBe(0.9);
            expect(res[0].cx).toBeCloseTo(0.508, 3);
            expect(res[1].score).toBe(0.8);
            expect(res[1].cx).toBeCloseTo(0.1, 5);
        });
    });

    describe('Seam Testing with Mock ONNX Sessions', () => {
        test('estimateGazeForImage executes successfully with injectable stub sessions', () => {
            const res = runEsm(`
                import fs from 'fs';
                import { estimateGazeForImage } from './.agents/skills/sequence/scripts/gaze.mjs';

                const frontalData = JSON.parse(fs.readFileSync('tests/fixtures/gaze-synthetic-frontal.json', 'utf8'));
                const stubLandmarks = new Float32Array(478 * 3);
                for (let i = 0; i < 478; i++) {
                    const pt = frontalData[i];
                    stubLandmarks[i * 3] = pt.x + 128;
                    stubLandmarks[i * 3 + 1] = pt.y + 128;
                    stubLandmarks[i * 3 + 2] = pt.z;
                }

                const detRegressors = new Float32Array(896 * 16);
                // Detection in anchor 0: cx=64, cy=64, w=32, h=32
                detRegressors[0] = 0;
                detRegressors[1] = 0;
                detRegressors[2] = 32;
                detRegressors[3] = 32;
                // Eye keypoints (left, right)
                detRegressors[4] = -10;
                detRegressors[5] = -10;
                detRegressors[6] = 10;
                detRegressors[7] = -10;

                const detScores = new Float32Array(896).fill(-10.0);
                detScores[0] = 5.0; // 1 confident detection

                const stubDetSession = {
                    run: async () => ({
                        regressors: { data: detRegressors },
                        scores: { data: detScores }
                    })
                };

                const stubMeshSession = {
                    run: async () => ({
                        landmarks: { data: stubLandmarks },
                        score: { data: new Float32Array([10.0]) }
                    })
                };

                const stubOrt = {
                    Tensor: function(type, data, dims) {
                        this.type = type;
                        this.data = data;
                        this.dims = dims;
                    }
                };

                const result = await estimateGazeForImage(
                    'assets/img/p1/DSCF0361-2-768.webp',
                    { detSession: stubDetSession, meshSession: stubMeshSession },
                    { ortInstance: stubOrt }
                );

                console.log(JSON.stringify(result));
            `);

            expect(res).toHaveProperty('image', 'DSCF0361-2-768.webp');
            expect(res).toHaveProperty('modelVersion', 'face_landmarker_v2-onnx');
            expect(typeof res.latencyMs).toBe('number');
            expect(res.faces.length).toBe(1);
            expect(res.faces[0]).toHaveProperty('bbox');
            expect(res.faces[0]).toHaveProperty('confidence');
            expect(res.faces[0]).toHaveProperty('yawDeg');
            expect(res.faces[0]).toHaveProperty('eyeContact');
        });
    });

    describe('Absent-Models Behavior (Hermetic Graceful Degradation)', () => {
        test('createSessions returns models-not-installed object when model paths do not exist', () => {
            const res = runEsm(`
                import { createSessions } from './.agents/skills/sequence/scripts/gaze.mjs';
                const result = await createSessions({
                    detectorPath: '/non/existent/detector.onnx',
                    meshPath: '/non/existent/mesh.onnx'
                });
                console.log(JSON.stringify(result));
            `);

            expect(res).toEqual({
                error: 'models-not-installed',
                hint: 'run: make gaze-models',
            });
        });

        test('CLI exits 0 and prints models-not-installed JSON when models are missing', () => {
            const stdout = execFileSync('node', [GAZE_SCRIPT, 'p1'], {
                cwd: REPO_ROOT,
                env: {
                    ...process.env,
                    GAZE_MODELS_DIR: '/non/existent/models/dir',
                },
                encoding: 'utf8',
            });

            const parsed = JSON.parse(stdout);
            expect(parsed).toEqual({
                error: 'models-not-installed',
                hint: 'run: make gaze-models',
            });
        });
    });

    describe('Gallery Image Resolution', () => {
        test('resolveGalleryImages handles pageId "p5" and resolves active index.md images', () => {
            const res = runEsm(`
                import { resolveGalleryImages } from './.agents/skills/sequence/scripts/gaze.mjs';
                const gal = resolveGalleryImages('p5');
                console.log(JSON.stringify(gal));
            `);

            expect(res.images.length).toBe(12);
            expect(res.images[0]).toContain('DSCF9004-3.jpg');
        });

        test('resolveGalleryImages throws for non-existent gallery', () => {
            expect(() => {
                execFileSync(
                    'node',
                    [
                        '--input-type=module',
                        '-e',
                        `
                    import { resolveGalleryImages } from './.agents/skills/sequence/scripts/gaze.mjs';
                    resolveGalleryImages('p9999');
                `,
                    ],
                    {
                        cwd: REPO_ROOT,
                        encoding: 'utf8',
                        stdio: 'pipe',
                    }
                );
            }).toThrow();
        });
    });

    // Opt-in smoke test: un-skipped manually when models are present locally
    describe.skip('Opt-in Local ONNX Smoke Test', () => {
        test('runs end-to-end against real models on gallery p5', () => {
            const res = runEsm(`
                import { estimateGazeForGallery } from './.agents/skills/sequence/scripts/gaze.mjs';
                const results = await estimateGazeForGallery('p5');
                console.log(JSON.stringify(results));
            `);

            expect(Array.isArray(res)).toBe(true);
            expect(res.length).toBe(12);
            expect(res[0].image).toBe('DSCF9004-3.jpg');
        });
    });
});
