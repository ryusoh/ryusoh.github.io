# Research: Deterministic Gaze Vector Estimation for the `sequence` Skill

**Status:** findings document (research only — no code changed)
**Date:** 2026 (this session)
**Scope:** future-tooling exploration referenced by `docs/sequence-skill-architecture.md` §8.

---

## 1. The question

`docs/sequence-skill-architecture.md` (lines 413–414) flags this as open future work:

> "While luminance and CIELAB color histograms are computed via `sharp`, automated gaze vector calculation currently relies on the VLM's multi-modal visual attention. Integrating lightweight local face/pose estimation models (e.g. MediaPipe in Node) as deterministic pre-processors remains an area for future tooling exploration."

Today, gaze vectors (subject eye-contact direction, head orientation) are assessed by the VLM
visually per image in Pass 2 of the skill's Visual CoT. The question: **can a lightweight,
local, deterministic model pipeline compute per-image gaze/head-pose data in Node.js, the
same way `sharp` already computes CIELAB histograms — and which route is most viable?**

Constraints inherited from the repo: plain Node ESM CLI scripts (no bundler, no DOM),
Node v24.15.0, npm-based, Jest+jsdom tests that must be hermetic (scratch output only in
`tests/fixtures/sequence-scratch/`), and a preference for small, reviewable diffs.

## 2. The answer

### Executive summary

**The most viable route is ONNX Runtime for Node (`onnxruntime-node`) running a two-stage
detect-then-mesh pipeline** (BlazeFace or SCRFD detector + a MediaPipe FaceMesh/FaceLandmarker
ONNX conversion), with head pose computed from the landmarks in plain JS (PnP or an Umeyama
rigid fit against a canonical 3D face model) and eye contact from the iris landmarks
(indices 468–477).

**The officially suggested route — `@mediapipe/tasks-vision` (FaceLandmarker) in Node — is
not viable headless today.** The package targets browsers: its own npm README drives it with
`document.getElementById(...)` / `HTMLImageElement` inputs, and importing it in Node throws
`ReferenceError: self is not defined` (open upstream issue since Sep 2023, labeled
`stat:awaiting googler`). The only working Node bridges run a headless browser (Playwright),
which is far too heavyweight for this repo's CLI pre-processor layer.

**The TensorFlow.js route is a maintenance trap.** `@tensorflow/tfjs-node` has not published
since 2024-10-21 (v4.22.0) and its native binding fails to install on newer Node versions
(prebuilt-binary 404, source compile failure). `@tensorflow-models/face-landmarks-detection`
is likewise stalled at 1.0.6 (2024-10-10).

Accuracy expectations are bounded by the model card: MediaPipe FaceMesh V2 is a
**selfie/AR model** — it is explicitly unsuitable for faces looking away > 80°, tilted > 8°,
< 50% visible, or too small to rescale to 192×192. Street photography will therefore produce
many legitimately-null results; the deterministic layer should report "no usable face" rather
than guess. Where it does fire, landmark accuracy in single-shot ("reacquisition") mode is
~3.24% IOD MAE vs. a human-annotator discrepancy of 2.56% — good enough for coarse
yaw/pitch/eye-contact classification, not for precise gaze angles.

### Comparison table

| Route                                                      | Headless Node viability                                            | Landmarks / iris                         | Head pose output                       | License                                               | Footprint                                                       | CPU latency (indicative)                                                        |
| :--------------------------------------------------------- | :----------------------------------------------------------------- | :--------------------------------------- | :------------------------------------- | :---------------------------------------------------- | :-------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| `@mediapipe/tasks-vision` FaceLandmarker                   | ❌ import crashes in Node; needs DOM/browser or Playwright shim    | 478 landmarks incl. iris, 52 blendshapes | ✅ facial transformation matrix (4×4)  | Apache-2.0                                            | ~36.8 MB npm (wasm) + ~few MB `.task`                           | not stated officially for Node; browser-oriented                                |
| tfjs: `face-landmarks-detection` + `@tensorflow/tfjs-node` | ⚠️ stalled deps; tfjs-node install breaks on modern Node           | 478 keypoints; optional iris model       | ❌ none — DIY PnP from keypoints       | Apache-2.0                                            | native TF binding (~100+ MB installed)                          | not stated; native backend when it installs                                     |
| `onnxruntime-node` + ONNX BlazeFace/SCRFD + FaceMesh       | ✅ actively maintained; prebuilt CPU/CoreML binaries (macOS arm64) | 468 or 478 (iris) via converted models   | ❌ none — DIY PnP / Umeyama fit        | MIT (runtime); Apache-2.0 (MediaPipe-derived weights) | runtime ~tens of MB + models (detector ~0.1–2 MB, mesh ~3–5 MB) | BlazeFace ~10.9 ms, SCRFD ~23.1 ms detection-only (Apple M2, third-party bench) |
| `face-api.js`                                              | ⚠️ works but abandoned (last release 2020-03-22)                   | 68 points, **no iris**                   | ❌ none                                | MIT                                                   | tiny (68-pt model 350 KB; tiny 80 KB)                           | fast, but low fidelity                                                          |
| OpenCV.js (WASM) in Node                                   | ⚠️ runs, but ships no face-mesh DNN weights                        | none built-in (Haar/DNN only)            | ✅ `solvePnP` available as a math tool | Apache-2.0                                            | large wasm blob                                                 | n/a — math/library only                                                         |

## 3. Claim-by-claim evidence

### 3.1 `@mediapipe/tasks-vision` is browser-targeted; headless Node is unsupported

- The package's own npm README creates all vision tasks from DOM elements:
  `const image = document.getElementById("image") as HTMLImageElement;` — every example
  (FaceDetector, FaceLandmarker, PoseLandmarker, …) follows this pattern, and the wasm
  fileset is loaded from a CDN URL.
  Source: <https://www.npmjs.com/package/@mediapipe/tasks-vision> (fetched this session).
- Importing the package in Node fails immediately. Upstream issue **#4800
  "[tasks-vision] ReferenceError: self is not defined"** (opened 2023-09-15, **Status: Open**,
  labels include `platform:javascript`, `stat:awaiting googler`, `type:feature`) shows:
  `ReferenceError: self is not defined at .../@mediapipe/tasks-vision/vision_bundle.mjs`.
  Source: <https://github.com/google-ai-edge/mediapipe/issues/4800> (fetched this session).
- The existence of `beenotung/mediapipe-nodejs` — which runs MediaPipe "browser-only" models
  in Node by standing up "a local Express (web) server and Playwright (headless browser)" —
  corroborates that there is no native Node path; the community workaround embeds a whole
  browser. Source: <https://github.com/beenotung/mediapipe-nodejs>.
- The package itself is healthy and actively released: npm registry shows latest **1.0.1**
  published 2026-07-31 with daily `1.0.1-rc.*` releases through 2026-08-20, license
  Apache-2.0, unpacked size **36,831,894 bytes** (~36.8 MB, includes the wasm fileset).
  Source: `https://registry.npmjs.org/@mediapipe/tasks-vision` (fetched via curl this session).

**Verdict:** the _model_ is exactly right; the _JS runtime_ is wrong for a Node CLI. Using it
in Node means shipping Playwright + Chromium — unacceptable footprint and hermeticity cost for
this repo.

### 3.2 FaceLandmarker outputs: landmarks, blendshapes, and a head-pose matrix

Verified from the package's TypeScript source in `google-ai-edge/mediapipe`
(`mediapipe/tasks/web/vision/face_landmarker/`):

```ts
export declare interface FaceLandmarkerResult {
    faceLandmarks: NormalizedLandmark[][];
    faceBlendshapes: Classifications[]; // optional
    facialTransformationMatrixes: Matrix[]; // optional
}
```

with options `outputFaceBlendshapes` and `outputFacialTransformationMatrixes` gating the
optional streams. So yes — **FaceLandmarker outputs a facial transformation (head-pose)
matrix directly**, no DIY solvePnP needed _when using the official Tasks API_.
Source: raw source fetched this session from
`raw.githubusercontent.com/google-ai-edge/mediapipe/master/mediapipe/tasks/web/vision/face_landmarker/face_landmarker_result.d.ts`
and `face_landmarker.ts`.

Iris indices: MediaPipe's own connection tables place one iris ring at landmark indices
474–477 (`FACEMESH_LEFT_IRIS = frozenset([(474, 475), (475, 476), (476, 477), (477, 474)])`),
i.e. the iris landmarks occupy the 468–477 tail of the 478-point mesh (center + 4 ring points
per eye). Source: `mediapipe/python/solutions/face_mesh_connections.py` (raw, fetched this
session).

### 3.3 Model card: accuracy and, critically, out-of-scope face orientations

From the official **MediaPipe FaceMesh V2 model card** (2022-09-15,
`storage.googleapis.com/mediapipe-assets/Model Card MediaPipe Face Mesh V2.pdf`, fetched this
session):

- License: "Apache License, Version 2.0".
- Output: "478 3D landmarks"; z is relative to face center of mass; a face-presence flag
  (default threshold 0.5); a limited blendshape set.
- **Limitations (verbatim, decisive for street photography):** the model is "not suitable for
  detecting faces: looking away from the camera (more than 80°), inclined from the vertical
  orientation (more than 8°), only partially visible (less than 50% of the face), located too
  far away from the camera (cropped face can't be rescaled to model input of 192x192…)".
- Accuracy: human-annotation discrepancy baseline is **2.56% IOD MAE**; reacquisition (i.e.
  single-image, detect-then-mesh — exactly our use case) ranges **2.67%–3.85% across
  geographic subregions**, **3.24%–3.25% across genders**, 3.09%–3.75% across skin tones.
- Input contract: single centered face crop with 25% margin, eyes leveled; tolerates only
  "10% shift and scale" and "8° roll" of crop error.

### 3.4 TensorFlow.js route: stalled native binding

- `@tensorflow/tfjs-node`: latest **4.22.0, published 2024-10-21**; registry `modified`
  2025-01-13 — no releases in well over a year. Source: npm registry (curl, this session).
- Install failure on modern Node is documented upstream: issue **tensorflow/tfjs#8481**
  (2024-12-15) shows `node-pre-gyp` hitting `404 Not Found` on the prebuilt binary URL and the
  source fallback failing with `fatal error: 'memory' file not found`.
  Source: <https://github.com/tensorflow/tfjs/issues/8481>.
- `@tensorflow-models/face-landmarks-detection`: latest **1.0.6, published 2024-10-10** —
  equally stalled. Its README confirms the MediaPipeFaceMesh model "can detect multiple
  faces, each face contains 478 keypoints" and "optionally loads an iris detection model",
  with two runtimes (`runtime: 'mediapipe'` — which just wraps the same browser-only
  MediaPipe wasm — or `'tfjs'`). Source:
  <https://github.com/tensorflow/tfjs-models/tree/master/face-landmarks-detection> (fetched
  this session).

**Verdict:** even if you use the pure-JS `tfjs` runtime (CPU/wasm backend) to avoid the native
binding, you inherit a stalled dependency tree and still get no head-pose output.

### 3.5 ONNX route: maintained runtime + available converted models

- `onnxruntime-node`: latest **1.27.0, published 2026-06-19**, license **MIT**. Its npm README
  states "ONNXRuntime works on Node.js v16.x+ (recommend v20.x+)" and ships prebuilt binaries
  for macOS arm64 with CPU and CoreML execution providers.
  Sources: <https://www.npmjs.com/package/onnxruntime-node> and npm registry (this session).
- There is **no official Google ONNX export** of FaceLandmarker, but third-party conversions
  with measured parity exist. `yakhyo/mediapipe-face-mesh-onnx` provides BlazeFace
  (`face_detection_short_range.onnx`) + FaceMesh 468 and FaceLandmarker 478
  (`face_landmarker_Nx3x256x256.onnx`) under **Apache-2.0**, and reports parity vs. the
  original MediaPipe pipeline of "0.007% of inter-ocular distance" for the FaceLandmarker
  full pipeline. It also confirms the iris layout: "Iris points are 468-472 … and 473-477 …
  ordered center, right, top, left, bottom", and that the FaceLandmarker model is "113 against
  35 MMac" vs. the lighter FaceMesh. Source:
  <https://github.com/yakhyo/mediapipe-face-mesh-onnx> (fetched this session).
- Indicative CPU detector latency (Apple M2, third-party benchmark table in
  `1adrianb/face-alignment`): BlazeFace 10.9 ms, YuNet 5.6 ms, RetinaFace 25.2 ms, SCRFD
  23.1 ms — detection only, median over 20 runs, single face 450×450.
  Source: <https://github.com/1adrianb/face-alignment>. Treat as ballpark, not official.
- The standard head-pose step on top of landmarks is solvePnP against a 3D canonical face
  model; e.g. `yinguobing/head-pose-estimation` (MIT) does "Face detection → 68 landmarks →
  pose … calculated by a mutual PnP algorithm" on ONNX Runtime.
  Source: <https://github.com/yinguobing/head-pose-estimation>.

### 3.6 Lightweight alternatives

- **face-api.js**: Node usage requires monkey-patching `HTMLCanvasElement`,
  `HTMLImageElement`, `ImageData` (via `node-canvas`) and optionally `@tensorflow/tfjs-node`;
  landmark model is 68-point (350 KB, tiny 80 KB) with **no iris landmarks**, so eye-contact
  direction cannot be computed — only coarse head pose. Last npm release **0.22.2,
  2020-03-22** (MIT). Sources: <https://github.com/justadudewhohacks/face-api.js> + npm
  registry (this session). Weaker on both maintenance and capability.
- **OpenCV.js (WASM)**: gives you `solvePnP` and DNN loading in pure wasm, but no bundled
  modern face-mesh weights — you'd still import ONNX/TFLite models yourself, at which point
  `onnxruntime-node` is the smaller, better-maintained dependency. Useful only as a math
  library, and a heavy one for just PnP (PnP over ≤ 478 points is ~100 lines of plain JS).

## 4. Recommended integration design for this repo

### Shape

Add **one new optional script** in the deterministic layer —
`.agents/skills/sequence/scripts/gaze.mjs` — mirroring `inspect_gallery.mjs`'s CLI style,
invoked standalone (`node gaze.mjs <gallery-dir>`) rather than wired into the default digest
run, so the skill's existing fast path and tests are untouched. `report.mjs` can merge its
output into the digest when present (same pattern as optional metrics).

Pipeline per image:

1. Decode with the **already-installed `sharp`** (`raw().toBuffer({ resolveWithObject: true })`)
   → RGB `Uint8Array` tensor. No new image-I/O dependency.
2. `onnxruntime-node` session A: BlazeFace short-range ONNX (or SCRFD) → face boxes + 6
   keypoints + confidence.
3. Per face, crop with the model-card contract (square, 25% margin, eyes leveled) and run
   session B: FaceLandmarker-478 ONNX → landmarks + presence score.
4. Head pose: Umeyama/Procrustes rigid fit of a stable landmark subset against MediaPipe's
   canonical 3D face geometry → yaw/pitch/roll in degrees (cheaper and more portable than
   linking OpenCV for solvePnP; ~100 lines of JS).
5. Eye contact: iris centers (468, 473) offset within the eye-contour bounding boxes,
   combined with |yaw| — `eyeContact: true` only when both iris offsets are near-center and
   |yaw|, |pitch| below thresholds.

### Proposed JSON (per image, appended to the digest or emitted as `gaze.json`)

```json
{
    "image": "IMG_1234.jpg",
    "modelVersion": "face_landmarker_v2-onnx",
    "latencyMs": 41,
    "faces": [
        {
            "bbox": { "x": 0.41, "y": 0.22, "w": 0.18, "h": 0.24 },
            "confidence": 0.93,
            "yawDeg": -12.4,
            "pitchDeg": 3.1,
            "rollDeg": 1.8,
            "eyeContact": true,
            "irisOffset": { "left": { "x": 0.02, "y": -0.01 }, "right": { "x": 0.03, "y": 0.0 } },
            "facePixelWidth": 412
        }
    ]
}
```

`faces: []` (or a low `confidence`) is a first-class result: per the model card, profile,
occluded, and distant faces are out of scope, so the VLM keeps sole custody of gaze for those
frames and the digest should say so explicitly rather than interpolate.

### Dependencies & footprint

- Runtime dep: `onnxruntime-node` (MIT, prebuilt for macOS arm64 CPU/CoreML; no toolchain
  needed). Model files (~0.1–5 MB each, Apache-2.0) fetched by a `make gaze-models` target
  into a gitignored `.agents/skills/sequence/models/` dir — **download at install/setup time,
  never at test time**.
- Total added footprint: tens of MB — vs. the alternatives (Playwright+Chromium for
  tasks-vision, or the broken tfjs-node native build), this is the only route that respects
  the repo's "plain Node ESM CLI, npm, hermetic tests" posture.

### Test strategy (hermetic, per repo rules)

- Unit tests mock the two ONNX sessions behind a thin `createSessions()` seam; fixture
  landmark arrays (JSON in `tests/fixtures/`) drive the yaw/pitch/roll and eye-contact math,
  which is where the real logic lives. The math is pure JS → fully deterministic tests.
- One opt-in smoke test (`describe.skip` unless `models/` exists) runs the real model on a
  tiny synthetic image; any scratch output goes to `tests/fixtures/sequence-scratch/`.
- No model downloads in CI; `make precommit-fix` stays green without the models present.

## 5. Open questions / what I could NOT verify

1. **Official ai.google.dev FaceLandmarker docs were unreachable this session** (repeated
   network errors on `ai.google.dev` and `developers.google.com/mediapipe`). All
   FaceLandmarker API claims above are therefore verified from the upstream repo source
   (`face_landmarker_result.d.ts`, `face_landmarker.ts`) rather than the rendered docs.
2. **Whether tasks-vision 1.0.x can be coaxed into headless Node** with `self`/`fetch`/
   `ImageData` polyfills was not tested; upstream issue #4800 remains open with no googler
   response, so assume unsupported until a spike proves otherwise.
3. **Official per-image CPU latency for FaceLandmarker on desktop CPU** is not published in
   the model card (its benchmarks target mobile/tracking). The M2 numbers in §3.5 are
   third-party and detector-only; end-to-end latency for the ONNX route needs a local spike
   (expect tens of ms/image — fine for a batch pre-processor).
4. **License of each specific third-party ONNX weight file** (e.g. PINTO0309 conversions
   referenced by yakhyo) should be re-checked at vendoring time; the yakhyo repo itself
   states Apache-2.0 for models derived from MediaPipe, but the repo's own diligence, not
   this document, is authoritative at integration time.
5. **Iris quality at street-photography face sizes**: the model card's 192×192 rescale floor
   implies iris offsets will be noisy for small faces; the `facePixelWidth` field above exists
   so thresholds can be tuned empirically against the VLM's current Pass-2 assessments.
6. **Whether the VLM disagrees productively**: no measurement yet of VLM-vs-model gaze
   agreement on the existing galleries; a calibration pass over one gallery would set the
   eye-contact thresholds and is the natural first spike.
