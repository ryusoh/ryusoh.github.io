#!/usr/bin/env node

/**
 * Deterministic Gaze Vector Estimation & Head Pose Pre-processor
 * Runs a two-stage ONNX face pipeline (BlazeFace short-range + FaceLandmarker-478)
 * using onnxruntime-node and sharp.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import ort from 'onnxruntime-node';
import { performance } from 'perf_hooks';

// Exported threshold constants for calibration
export const YAW_THRESHOLD_DEG = 15;
export const PITCH_THRESHOLD_DEG = 15;
export const IRIS_OFFSET_THRESHOLD = 0.35;
export const DETECTION_THRESHOLD = 0.5;
export const NMS_IOU_THRESHOLD = 0.3;
export const CROP_MARGIN = 0.25;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '../../../../');
export const DEFAULT_MODELS_DIR = process.env.GAZE_MODELS_DIR || path.join(__dirname, '../models');

export const DEFAULT_DETECTOR_PATH = path.join(
    DEFAULT_MODELS_DIR,
    'face_detection_short_range.onnx'
);
export const DEFAULT_MESH_PATH = path.join(DEFAULT_MODELS_DIR, 'face_landmarker_Nx3x256x256.onnx');

// MediaPipe canonical 3D face model subset (coordinates in mm / canonical unit space)
// Landmark indices: nose tip 1, chin 152, viewer-left eye outer 33, viewer-right eye outer 263, mouth corners 61, 291
export const CANONICAL_MODEL = [
    [0.0, -1.12, 4.0], // 1: Nose tip
    [0.0, -63.6, -12.5], // 152: Chin
    [-43.3, 32.7, -26.0], // 33: Viewer-left eye outer corner
    [43.3, 32.7, -26.0], // 263: Viewer-right eye outer corner
    [-28.9, -28.9, -24.1], // 61: Viewer-left mouth corner
    [28.9, -28.9, -24.1], // 291: Viewer-right mouth corner
];

export const SUBSET_INDICES = [1, 152, 33, 263, 61, 291];

/**
 * Generate 896 SSD anchor centers for 128x128 BlazeFace short-range detector.
 *
 * @returns {Array<[number, number]>}
 */
export function generateFaceAnchors() {
    const anchors = [];
    const strides = [8, 16, 16, 16];
    let idx = 0;
    while (idx < strides.length) {
        let last = idx;
        while (last < strides.length && strides[last] === strides[idx]) {
            last++;
        }
        const repeats = 2 * (last - idx);
        const cells = Math.floor(128 / strides[idx]);
        for (let y = 0; y < cells; y++) {
            for (let x = 0; x < cells; x++) {
                const ax = (x + 0.5) / cells;
                const ay = (y + 0.5) / cells;
                for (let r = 0; r < repeats; r++) {
                    anchors.push([ax, ay]);
                }
            }
        }
        idx = last;
    }
    return anchors;
}

export const ANCHORS = generateFaceAnchors();

/**
 * Weighted Non-Maximum Suppression (MediaPipe convention: score-weighted averaging of overlapping candidates).
 *
 * @param {Array<object>} detections
 * @param {number} iouThreshold
 * @returns {Array<object>}
 */
export function weightedNms(detections, iouThreshold = NMS_IOU_THRESHOLD) {
    let remaining = detections.slice().sort((a, b) => b.score - a.score);
    const output = [];

    while (remaining.length > 0) {
        const top = remaining[0];
        const overlapping = [];
        const nonOverlapping = [];

        const tx1 = top.cx - top.w / 2;
        const ty1 = top.cy - top.h / 2;
        const tx2 = top.cx + top.w / 2;
        const ty2 = top.cy + top.h / 2;
        const tArea = (tx2 - tx1) * (ty2 - ty1);

        for (const item of remaining) {
            const x1 = item.cx - item.w / 2;
            const y1 = item.cy - item.h / 2;
            const x2 = item.cx + item.w / 2;
            const y2 = item.cy + item.h / 2;
            const itemArea = (x2 - x1) * (y2 - y1);

            const interW = Math.max(0, Math.min(x2, tx2) - Math.max(x1, tx1));
            const interH = Math.max(0, Math.min(y2, ty2) - Math.max(y1, ty1));
            const inter = interW * interH;
            const union = itemArea + tArea - inter;
            const iou = union > 1e-9 ? inter / union : 0;

            if (iou > iouThreshold) {
                overlapping.push(item);
            } else {
                nonOverlapping.push(item);
            }
        }

        let totalWeight = 0;
        let sumCx = 0;
        let sumCy = 0;
        let sumW = 0;
        let sumH = 0;
        const sumKp = new Array(6).fill(0).map(() => ({ x: 0, y: 0 }));

        for (const item of overlapping) {
            const w = item.score;
            totalWeight += w;
            sumCx += item.cx * w;
            sumCy += item.cy * w;
            sumW += item.w * w;
            sumH += item.h * w;
            for (let k = 0; k < 6; k++) {
                sumKp[k].x += item.keypoints[k].x * w;
                sumKp[k].y += item.keypoints[k].y * w;
            }
        }

        output.push({
            score: top.score,
            cx: sumCx / totalWeight,
            cy: sumCy / totalWeight,
            w: sumW / totalWeight,
            h: sumH / totalWeight,
            keypoints: sumKp.map((kp) => ({ x: kp.x / totalWeight, y: kp.y / totalWeight })),
        });

        remaining = nonOverlapping;
    }

    return output;
}

/**
 * 3x3 Singular Value Decomposition via classical Jacobi iteration.
 *
 * @param {Array<Array<number>>} A
 * @returns {{ U: Array<Array<number>>, S: number[], V: Array<Array<number>> }}
 */
export function svd3(A) {
    const V = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];
    const AtA = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let k = 0; k < 3; k++) sum += A[k][r] * A[k][c];
            AtA[r][c] = sum;
        }
    }

    for (let iter = 0; iter < 20; iter++) {
        let maxOff = 0;
        let p = 0;
        let q = 1;
        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
                if (Math.abs(AtA[i][j]) > maxOff) {
                    maxOff = Math.abs(AtA[i][j]);
                    p = i;
                    q = j;
                }
            }
        }
        if (!Number.isFinite(maxOff) || maxOff < 1e-12) break;

        const diff = AtA[q][q] - AtA[p][p];
        let t;
        if (Math.abs(AtA[p][q]) < 1e-12) {
            t = 0;
        } else {
            const theta = diff / (2 * AtA[p][q]);
            t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        }
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        const App = AtA[p][p];
        const Aqq = AtA[q][q];
        const Apq = AtA[p][q];
        AtA[p][p] = c * c * App - 2 * s * c * Apq + s * s * Aqq;
        AtA[q][q] = s * s * App + 2 * s * c * Apq + c * c * Aqq;
        AtA[p][q] = 0;
        AtA[q][p] = 0;

        for (let k = 0; k < 3; k++) {
            if (k !== p && k !== q) {
                const akp = AtA[k][p];
                const akq = AtA[k][q];
                AtA[k][p] = c * akp - s * akq;
                AtA[p][k] = AtA[k][p];
                AtA[k][q] = s * akp + c * akq;
                AtA[q][k] = AtA[k][q];
            }
            const vkp = V[k][p];
            const vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq;
            V[k][q] = s * vkp + c * vkq;
        }
    }

    const singularValues = [
        Math.sqrt(Math.max(0, AtA[0][0])),
        Math.sqrt(Math.max(0, AtA[1][1])),
        Math.sqrt(Math.max(0, AtA[2][2])),
    ];

    const U = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            let sum = 0;
            for (let k = 0; k < 3; k++) sum += A[i][k] * V[k][j];
            U[i][j] = singularValues[j] > 1e-9 ? sum / singularValues[j] : 0;
        }
    }

    return { U, S: singularValues, V };
}

/**
 * 3x3 Matrix Determinant.
 *
 * @param {Array<Array<number>>} M
 * @returns {number}
 */
export function det3(M) {
    return (
        M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
        M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
        M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
    );
}

/**
 * Compute head pose (yaw, pitch, roll in degrees) via Umeyama / Orthogonal Procrustes rigid alignment.
 *
 * @param {Array<{ x: number, y: number, z: number }>} landmarks - 478 3D landmark array
 * @returns {{ yawDeg: number, pitchDeg: number, rollDeg: number }}
 */
export function computeHeadPose(landmarks) {
    const P = CANONICAL_MODEL;
    const Q = SUBSET_INDICES.map((idx) => {
        const pt = landmarks[idx] || { x: 0, y: 0, z: 0 };
        return [pt.x, -pt.y, pt.z];
    });

    const N = P.length;
    const meanP = [0, 0, 0];
    const meanQ = [0, 0, 0];
    for (let i = 0; i < N; i++) {
        for (let d = 0; d < 3; d++) {
            meanP[d] += P[i][d] / N;
            meanQ[d] += Q[i][d] / N;
        }
    }

    const H = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (let i = 0; i < N; i++) {
        const p = [P[i][0] - meanP[0], P[i][1] - meanP[1], P[i][2] - meanP[2]];
        const q = [Q[i][0] - meanQ[0], Q[i][1] - meanQ[1], Q[i][2] - meanQ[2]];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                H[r][c] += q[r] * p[c];
            }
        }
    }

    const { U, V } = svd3(H);

    const UVt = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            for (let k = 0; k < 3; k++) UVt[r][c] += U[r][k] * V[c][k];
        }
    }
    const d = det3(UVt) < 0 ? -1 : 1;

    const R = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            for (let k = 0; k < 3; k++) {
                const scale = k === 2 ? d : 1;
                R[r][c] += U[r][k] * scale * V[c][k];
            }
        }
    }

    const pitchRad = Math.asin(Math.max(-1, Math.min(1, -R[1][2])));
    let yawRad;
    let rollRad;
    if (Math.abs(R[1][2]) < 0.999) {
        yawRad = Math.atan2(R[0][2], R[2][2]);
        rollRad = Math.atan2(R[1][0], R[1][1]);
    } else {
        yawRad = Math.atan2(-R[2][0], R[0][0]);
        rollRad = 0;
    }

    return {
        yawDeg: Number(((yawRad * 180) / Math.PI).toFixed(1)),
        pitchDeg: Number(((pitchRad * 180) / Math.PI).toFixed(1)),
        rollDeg: Number(((rollRad * 180) / Math.PI).toFixed(1)),
    };
}

/**
 * Classify eye-contact and calculate normalized iris center offsets within eye contours.
 *
 * @param {Array<{ x: number, y: number, z?: number }>} landmarks
 * @param {number} yawDeg
 * @param {number} pitchDeg
 * @param {object} [thresholds]
 * @returns {{ eyeContact: boolean, irisOffset: { left: { x: number, y: number }, right: { x: number, y: number } } }}
 */
export function computeEyeContact(
    landmarks,
    yawDeg,
    pitchDeg,
    thresholds = {
        yawThreshold: YAW_THRESHOLD_DEG,
        pitchThreshold: PITCH_THRESHOLD_DEG,
        offsetThreshold: IRIS_OFFSET_THRESHOLD,
    }
) {
    const leftIris = landmarks[468] || { x: 0, y: 0 };
    const leftCorners = [33, 133, 159, 145].map((i) => landmarks[i] || { x: 0, y: 0 });
    const lMinX = Math.min(...leftCorners.map((p) => p.x));
    const lMaxX = Math.max(...leftCorners.map((p) => p.x));
    const lMinY = Math.min(...leftCorners.map((p) => p.y));
    const lMaxY = Math.max(...leftCorners.map((p) => p.y));
    const lWidth = Math.max(1e-6, lMaxX - lMinX);
    const lHeight = Math.max(1e-6, lMaxY - lMinY);

    const leftOffsetX = (leftIris.x - (lMinX + lMaxX) / 2) / (lWidth / 2);
    const leftOffsetY = (leftIris.y - (lMinY + lMaxY) / 2) / (lHeight / 2);

    const rightIris = landmarks[473] || { x: 0, y: 0 };
    const rightCorners = [362, 263, 386, 374].map((i) => landmarks[i] || { x: 0, y: 0 });
    const rMinX = Math.min(...rightCorners.map((p) => p.x));
    const rMaxX = Math.max(...rightCorners.map((p) => p.x));
    const rMinY = Math.min(...rightCorners.map((p) => p.y));
    const rMaxY = Math.max(...rightCorners.map((p) => p.y));
    const rWidth = Math.max(1e-6, rMaxX - rMinX);
    const rHeight = Math.max(1e-6, rMaxY - rMinY);

    const rightOffsetX = (rightIris.x - (rMinX + rMaxX) / 2) / (rWidth / 2);
    const rightOffsetY = (rightIris.y - (rMinY + rMaxY) / 2) / (rHeight / 2);

    const lMag = Math.hypot(leftOffsetX, leftOffsetY);
    const rMag = Math.hypot(rightOffsetX, rightOffsetY);

    const yawLimit = thresholds.yawThreshold ?? YAW_THRESHOLD_DEG;
    const pitchLimit = thresholds.pitchThreshold ?? PITCH_THRESHOLD_DEG;
    const offsetLimit = thresholds.offsetThreshold ?? IRIS_OFFSET_THRESHOLD;

    const eyeContact =
        Math.abs(yawDeg) <= yawLimit &&
        Math.abs(pitchDeg) <= pitchLimit &&
        lMag <= offsetLimit &&
        rMag <= offsetLimit;

    return {
        eyeContact,
        irisOffset: {
            left: { x: Number(leftOffsetX.toFixed(2)), y: Number(leftOffsetY.toFixed(2)) },
            right: { x: Number(rightOffsetX.toFixed(2)), y: Number(rightOffsetY.toFixed(2)) },
        },
    };
}

/**
 * Sample a rotated square crop (size x size) from a raw RGB buffer.
 *
 * @param {Uint8Array} buffer
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 * @param {{ cx: number, cy: number, side: number, angleDeg: number }} roi
 * @param {number} size
 * @returns {Float32Array}
 */
export function sampleCrop(buffer, width, height, channels, roi, size = 256) {
    const { cx, cy, side, angleDeg } = roi;
    const sideSafe = Math.max(1, side || 1);
    const angleSafe = Number.isFinite(angleDeg) ? angleDeg : 0;
    const dst = new Float32Array(3 * size * size);
    const theta = (angleSafe * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const scale = size / sideSafe;

    for (let v = 0; v < size; v++) {
        const dv = v + 0.5 - size / 2;
        for (let u = 0; u < size; u++) {
            const du = u + 0.5 - size / 2;
            const srcX = cx + (cosT * du - sinT * dv) / scale - 0.5;
            const srcY = cy + (sinT * du + cosT * dv) / scale - 0.5;

            const x0 = Math.floor(srcX);
            const x1 = Math.min(width - 1, x0 + 1);
            const wx1 = srcX - x0;
            const wx0 = 1 - wx1;

            const y0 = Math.floor(srcY);
            const y1 = Math.min(height - 1, y0 + 1);
            const wy1 = srcY - y0;
            const wy0 = 1 - wy1;

            const dstIdx = v * size + u;
            if (y0 >= 0 && y1 < height && x0 >= 0 && x1 < width) {
                const idx00 = (y0 * width + x0) * channels;
                const idx01 = (y0 * width + x1) * channels;
                const idx10 = (y1 * width + x0) * channels;
                const idx11 = (y1 * width + x1) * channels;

                for (let c = 0; c < 3; c++) {
                    const val =
                        (buffer[idx00 + c] * wx0 + buffer[idx01 + c] * wx1) * wy0 +
                        (buffer[idx10 + c] * wx0 + buffer[idx11 + c] * wx1) * wy1;
                    dst[c * size * size + dstIdx] = val / 255.0;
                }
            } else {
                for (let c = 0; c < 3; c++) {
                    dst[c * size * size + dstIdx] = 0.0;
                }
            }
        }
    }

    return dst;
}

/**
 * Create ONNX inference sessions with an injectable seam for unit testing.
 *
 * @param {object} [options]
 * @param {string} [options.detectorPath]
 * @param {string} [options.meshPath]
 * @param {object} [options.ortInstance]
 * @returns {Promise<{ detSession: any, meshSession: any } | { error: string, hint: string }>}
 */
export async function createSessions(options = {}) {
    const detectorPath = options.detectorPath || DEFAULT_DETECTOR_PATH;
    const meshPath = options.meshPath || DEFAULT_MESH_PATH;
    const runtime = options.ortInstance || ort;

    if (!fs.existsSync(detectorPath) || !fs.existsSync(meshPath)) {
        return {
            error: 'models-not-installed',
            hint: 'run: make gaze-models',
        };
    }

    const detSession = await runtime.InferenceSession.create(detectorPath);
    const meshSession = await runtime.InferenceSession.create(meshPath);

    return { detSession, meshSession };
}

/**
 * Estimate gaze vectors and head pose for a single image.
 *
 * @param {string} imagePath
 * @param {{ detSession: any, meshSession: any }} sessions
 * @param {object} [options]
 * @returns {Promise<{ image: string, modelVersion: string, latencyMs: number, faces: Array<object> }>}
 */
export async function estimateGazeForImage(imagePath, sessions, options = {}) {
    const filename = path.basename(imagePath);
    const start = performance.now();
    const runtime = options.ortInstance || ort;

    const meta = await sharp(imagePath).metadata();
    const width = meta.width;
    const height = meta.height;
    const scale = 128 / Math.max(width, height);
    const padX = (128 - width * scale) / 2;
    const padY = (128 - height * scale) / 2;

    const { data: letterboxData } = await sharp(imagePath)
        .removeAlpha()
        .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
        .raw()
        .toBuffer({ resolveWithObject: true });

    const tensor = new Float32Array(3 * 128 * 128);
    for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 128; x++) {
            const idx = (y * 128 + x) * 3;
            for (let c = 0; c < 3; c++) {
                tensor[c * 128 * 128 + y * 128 + x] = (letterboxData[idx + c] - 127.5) / 127.5;
            }
        }
    }

    const detInputTensor = new runtime.Tensor('float32', tensor, [1, 3, 128, 128]);
    const detOutputs = await sessions.detSession.run({ input: detInputTensor });
    const regressors = detOutputs.regressors.data;
    const scoreLogits = detOutputs.scores.data;

    const candidates = [];
    const detThreshold = options.detectionThreshold ?? DETECTION_THRESHOLD;
    for (let i = 0; i < 896; i++) {
        const logit = scoreLogits[i];
        const score = 1.0 / (1.0 + Math.exp(-logit));
        if (score >= detThreshold) {
            const regIdx = i * 16;
            const ax = ANCHORS[i][0];
            const ay = ANCHORS[i][1];
            const cxNorm = regressors[regIdx] / 128 + ax;
            const cyNorm = regressors[regIdx + 1] / 128 + ay;
            const wNorm = regressors[regIdx + 2] / 128;
            const hNorm = regressors[regIdx + 3] / 128;

            const kp = [];
            for (let k = 0; k < 6; k++) {
                kp.push({
                    x: regressors[regIdx + 4 + 2 * k] / 128 + ax,
                    y: regressors[regIdx + 5 + 2 * k] / 128 + ay,
                });
            }

            candidates.push({
                score,
                cx: cxNorm,
                cy: cyNorm,
                w: wNorm,
                h: hNorm,
                keypoints: kp,
            });
        }
    }

    const nmsResults = weightedNms(candidates, options.nmsThreshold ?? NMS_IOU_THRESHOLD);

    let fullRawBuffer = null;
    if (nmsResults.length > 0) {
        const fullRaw = await sharp(imagePath)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        fullRawBuffer = fullRaw.data;
    }

    const faces = [];
    for (const det of nmsResults) {
        const cx = (det.cx * 128 - padX) / scale;
        const cy = (det.cy * 128 - padY) / scale;
        const w = (det.w * 128) / scale;
        const h = (det.h * 128) / scale;

        const kpImg = det.keypoints.map((p) => ({
            x: (p.x * 128 - padX) / scale,
            y: (p.y * 128 - padY) / scale,
        }));

        const x1 = cx - w / 2;
        const y1 = cy - h / 2;

        const margin = options.cropMargin ?? CROP_MARGIN;
        const side = Math.max(1, (1 + 2 * margin) * Math.max(w, h));
        const dx = kpImg[1].x - kpImg[0].x;
        const dy = kpImg[1].y - kpImg[0].y;
        const angleDeg =
            Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;

        const roi = { cx, cy, side, angleDeg };

        const meshCrop = sampleCrop(fullRawBuffer, width, height, 3, roi, 256);
        const meshInput = new runtime.Tensor('float32', meshCrop, [1, 3, 256, 256]);

        const meshOut = await sessions.meshSession.run({ input: meshInput });
        const rawLandmarks = meshOut.landmarks.data;

        const angleSafe = Number.isFinite(angleDeg) ? angleDeg : 0;
        const theta = (angleSafe * Math.PI) / 180;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const cropScale = 256 / side;

        const landmarks = [];
        for (let l = 0; l < 478; l++) {
            const u = rawLandmarks[l * 3];
            const v = rawLandmarks[l * 3 + 1];
            const z = rawLandmarks[l * 3 + 2];

            const du = u - 128;
            const dv = v - 128;
            const imgX = cx + (cosT * du - sinT * dv) / cropScale;
            const imgY = cy + (sinT * du + cosT * dv) / cropScale;
            const imgZ = z * (side / 256);

            landmarks.push({ x: imgX, y: imgY, z: imgZ });
        }

        const pose = computeHeadPose(landmarks);
        const eye = computeEyeContact(landmarks, pose.yawDeg, pose.pitchDeg, {
            yawThreshold: options.yawThreshold ?? YAW_THRESHOLD_DEG,
            pitchThreshold: options.pitchThreshold ?? PITCH_THRESHOLD_DEG,
            offsetThreshold: options.offsetThreshold ?? IRIS_OFFSET_THRESHOLD,
        });

        faces.push({
            bbox: {
                x: Number((x1 / width).toFixed(2)),
                y: Number((y1 / height).toFixed(2)),
                w: Number((w / width).toFixed(2)),
                h: Number((h / height).toFixed(2)),
            },
            confidence: Number(det.score.toFixed(2)),
            yawDeg: pose.yawDeg,
            pitchDeg: pose.pitchDeg,
            rollDeg: pose.rollDeg,
            eyeContact: eye.eyeContact,
            irisOffset: eye.irisOffset,
            facePixelWidth: Math.round(w),
        });
    }

    const elapsed = Math.round(performance.now() - start);

    return {
        image: filename,
        modelVersion: 'face_landmarker_v2-onnx',
        latencyMs: elapsed,
        faces,
    };
}

/**
 * Resolve gallery argument to a list of image paths.
 * If index.md is present, respects the sequenced image order; otherwise lists directory image files.
 *
 * @param {string} galleryArg
 * @returns {{ dir: string, images: string[] }}
 */
export function resolveGalleryImages(galleryArg) {
    let resolvedDir = path.resolve(galleryArg);
    let mdCandidate = null;

    if (galleryArg.match(/^p\d+$/i) || galleryArg.match(/^\d+$/)) {
        const pageNum = galleryArg.replace(/^p/i, '');
        resolvedDir = path.join(REPO_ROOT, `assets/img/p${pageNum}`);
        mdCandidate = path.join(resolvedDir, 'index.md');
    } else if (galleryArg.endsWith('index.md') || galleryArg.endsWith('.md')) {
        mdCandidate = path.resolve(galleryArg);
        resolvedDir = path.dirname(mdCandidate);
    } else {
        mdCandidate = path.join(resolvedDir, 'index.md');
    }

    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        throw new Error(`Directory not found: ${resolvedDir}`);
    }

    const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

    // 1. If index.md exists, extract images mentioned in it
    if (mdCandidate && fs.existsSync(mdCandidate)) {
        const content = fs.readFileSync(mdCandidate, 'utf8');
        const lines = content.split(/\r?\n/);
        const mdImages = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('>') || trimmed.startsWith('---')) continue;
            const [filename] = trimmed.split('|');
            const cleanFilename = filename.trim();
            if (/\.(jpe?g|png|webp|avif)$/i.test(cleanFilename)) {
                const fullPath = path.join(resolvedDir, cleanFilename);
                if (fs.existsSync(fullPath)) {
                    mdImages.push(fullPath);
                }
            }
        }
        if (mdImages.length > 0) {
            return { dir: resolvedDir, images: mdImages };
        }
    }

    // 2. Otherwise enumerate directory files
    const files = fs
        .readdirSync(resolvedDir)
        .filter((f) => validExts.includes(path.extname(f).toLowerCase()))
        .filter((f) => !f.match(/-(384|768|1152|1200|1536)\.(webp|avif)$/i))
        .map((f) => path.join(resolvedDir, f));

    if (files.length === 0) {
        const allImgs = fs
            .readdirSync(resolvedDir)
            .filter((f) => validExts.includes(path.extname(f).toLowerCase()))
            .map((f) => path.join(resolvedDir, f));
        return { dir: resolvedDir, images: allImgs };
    }

    return { dir: resolvedDir, images: files };
}

/**
 * Run deterministic gaze vector estimation for an entire gallery directory.
 *
 * @param {string} galleryArg
 * @param {object} [options]
 * @returns {Promise<Array<object> | { error: string, hint: string }>}
 */
export async function estimateGazeForGallery(galleryArg, options = {}) {
    const sessions = await createSessions(options);
    if ('error' in sessions) {
        return sessions;
    }

    const { images } = resolveGalleryImages(galleryArg);
    const results = [];

    for (const imgPath of images) {
        const result = await estimateGazeForImage(imgPath, sessions, options);
        results.push(result);
    }

    return results;
}

/**
 * CLI Runner.
 */
async function main() {
    const args = process.argv.slice(2);
    const hasHelp = args.includes('--help') || args.includes('-h');
    const galleryArg = args.find((a) => !a.startsWith('--'));

    if (hasHelp || !galleryArg) {
        console.log(`
Usage: node gaze.mjs <gallery-dir> [options]

Arguments:
  <gallery-dir>            Gallery identifier or directory (e.g. "p5", "assets/img/p1")

Options:
  --json                   Output structured JSON array
  --help, -h               Show this help message
`);
        process.exit(hasHelp ? 0 : 1);
    }

    const jsonOutput = args.includes('--json');

    // If models are missing, exit 0 with contractual JSON error object
    const sessions = await createSessions();
    if ('error' in sessions) {
        console.log(JSON.stringify(sessions, null, 2));
        process.exit(0);
    }

    let galleryData;
    try {
        galleryData = resolveGalleryImages(galleryArg);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    const results = [];
    for (const imgPath of galleryData.images) {
        const res = await estimateGazeForImage(imgPath, sessions);
        results.push(res);
        if (!jsonOutput) {
            const faceCount = res.faces.length;
            const filename = res.image.padEnd(30, ' ');
            if (faceCount === 0) {
                console.log(
                    `[${filename}] 0 faces detected | Latency: ${String(res.latencyMs).padStart(3, ' ')} ms`
                );
            } else {
                const f = res.faces[0];
                const eyeStr = f.eyeContact ? '[EYE-CONTACT]' : '[LOOK-AWAY]   ';
                console.log(
                    `[${filename}] ${faceCount} face(s) | Conf: ${f.confidence.toFixed(2)} | Yaw: ${String(f.yawDeg).padStart(5, ' ')}° | Pitch: ${String(f.pitchDeg).padStart(5, ' ')}° | Roll: ${String(f.rollDeg).padStart(5, ' ')}° | ${eyeStr} | Latency: ${res.latencyMs} ms`
                );
            }
        }
    }

    if (jsonOutput) {
        console.log(JSON.stringify(results, null, 2));
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((err) => {
        console.error('Error running gaze estimation:', err);
        process.exit(1);
    });
}
