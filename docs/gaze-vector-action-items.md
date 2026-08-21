# Action Items: Deterministic Gaze Vector Estimation Spike & Implementation

**Status:** ready for delegation
**Source of truth:** `docs/gaze-vector-estimation-research.md` (read it first; this document
is the executable distillation, not a replacement)
**Target executor:** an unattended coding agent with a low thinking budget. This document is
written defensively for that audience.

---

## 0. Contract for the executing agent (read before doing anything)

These rules exist because you are assumed to be cheap and hallucination-prone. Violating any
of them invalidates the entire run.

1. **Evidence or it didn't happen.** Every "done" claim must be immediately followed by the
   pasted output of the verification command you actually ran this session. Never claim a
   file exists, a test passes, or a command succeeded from memory or inference.
2. **Run commands verbatim.** Where this document gives an exact command, run exactly that.
   If you must deviate, state why in one sentence.
3. **Never invent an API.** After installing `onnxruntime-node`, read its TypeScript
   declarations under `node_modules/onnxruntime-node/` before writing any inference code.
   If the README and the installed types disagree, the installed types win.
4. **Two strikes, then stop.** If any step fails twice in a row, stop the run and report the
   failing command, its full stderr, and what you tried. Do not improvise a third approach.
5. **Scope is frozen.** You may create or modify ONLY the files listed in §4. Do not touch
   `js/`, `css/`, `sw.js`, `index.html`, `p*/`, `.github/`, `AGENTS.md`, or any file under
   `.agents/skills/sequence/` other than the new files listed. Do not edit generated files
   (`.claude/commands/*`).
6. **Never commit.** Leave all changes in the working tree. The human reviews and commits.
7. **npm only.** Never run `pnpm`, `yarn`, or hand-edit `package-lock.json`.
8. **Hermetic tests.** Model downloads happen at setup time, never at test time. Scratch
   output goes only to `tests/fixtures/sequence-scratch/` (gitignored).
9. **No visual claims.** You cannot see images. Report numbers (confidence, yaw, latency),
   never "the detection looks right."
10. **Gate discipline.** Run `make precommit-fix` once, at the end. If it is red, fix and
    rerun; never rerun a red gate on an unchanged tree.

---

## 1. Goal (one paragraph)

Add an **optional** deterministic pre-processor, `.agents/skills/sequence/scripts/gaze.mjs`,
that runs a two-stage ONNX face pipeline (BlazeFace detector + FaceLandmarker-478 mesh) via
`onnxruntime-node` and emits per-image JSON with head pose (yaw/pitch/roll), an eye-contact
flag, iris offsets, and face size — the gaze data the `sequence` skill currently gets from
VLM visual inspection. Models download at setup time into a gitignored directory; the
default skill workflow and its tests must remain green with the models **absent**.

Non-goals (do not do these): wiring gaze into the default `inspect_gallery.mjs` digest run,
editing `SKILL.md` workflow steps, using `@mediapipe/tasks-vision` (crashes in Node —
upstream issue google-ai-edge/mediapipe#4800), using `@tensorflow/tfjs-node` (stalled,
broken install on modern Node), using Playwright/Chromium.

## 2. Pre-flight checklist (verify, do not assume)

Run and paste output:

```bash
node --version            # expect v24.x
git status --porcelain    # note any pre-existing dirty files; do not touch them
ls docs/gaze-vector-estimation-research.md   # must exist; read it
grep -n '"sharp"' package.json              # sharp already installed; reuse it for decode
```

If the research doc is missing, stop — this document alone is insufficient context.

## 3. Phase 0 — Environment & latency spike (GO / NO-GO gate)

Phase 0 exists to kill the project cheaply if the research assumptions are wrong. Do not
proceed to Phase 1 unless every GO criterion is met.

### 3.1 Install the runtime

```bash
npm install onnxruntime-node
```

Paste the tail of the install log. Then verify headless loading:

```bash
node -e "import('onnxruntime-node').then(m => console.log('onnxruntime-node OK', m.default?.version ?? m.version ?? 'version-unknown'))"
```

GO criterion: prints `onnxruntime-node OK ...` with no error. NO-GO: any load error → stop
and report per rule 4.

### 3.2 Fetch the models (setup-time, recorded, checksummed)

Model files needed (Apache-2.0, per the research doc §3.5):

- BlazeFace short-range detector: `face_detection_short_range.onnx`
- FaceLandmarker 478-point mesh: `face_landmarker_Nx3x256x256.onnx` (the `N` is part of the
  upstream filename pattern; use the real filename from the source repo)

Do **not** guess URLs. Procedure:

```bash
curl -fsSL https://raw.githubusercontent.com/yakhyo/mediapipe-face-mesh-onnx/main/README.md -o tests/fixtures/sequence-scratch/yakhyo-readme.md
grep -niE 'onnx|download|release' tests/fixtures/sequence-scratch/yakhyo-readme.md | head -40
```

From that README (and its `models/` directory listing via
`gh api repos/yakhyo/mediapipe-face-mesh-onnx/contents/models` if needed), find the actual
download URLs, then:

```bash
mkdir -p .agents/skills/sequence/models
curl -fL <REAL-URL> -o .agents/skills/sequence/models/<real-filename>.onnx
shasum -a 256 .agents/skills/sequence/models/*.onnx
```

Record each real URL and its SHA-256 in `.agents/skills/sequence/models/MODELS.lock` (one
`sha256  filename  url` line per model). If the yakhyo repo has moved or the files 404,
stop and report — do not substitute a model from another source you have not verified.

### 3.3 Latency & sanity spike (scratch only — never commit the spike script)

Write `tests/fixtures/sequence-scratch/spike-gaze.mjs` (this path is gitignored; keep it
there) that:

1. Loads both ONNX sessions with `onnxruntime-node` (CPU execution provider).
2. Decodes 5 real gallery images (use `assets/img/p1/` `-768.webp` tiers) with
   `sharp(path).raw().toBuffer({ resolveWithObject: true })`.
3. Runs detector → crop → mesh per image, timing end-to-end with
   `performance.now()`.

Run it and paste the full output:

```bash
node tests/fixtures/sequence-scratch/spike-gaze.mjs
```

GO criteria (all must hold):

- Both sessions load and run without error on this machine.
- Median end-to-end latency ≤ 200 ms/image (ballpark from research: detector ~10–25 ms +
  mesh ~tens of ms on Apple silicon; we accept 200 ms for a batch tool).
- At least one gallery image yields `faces.length >= 1` with detector confidence ≥ 0.5.
  (Many street photos legitimately yield `faces: []` — that is expected, per the model
  card's > 80° / < 50%-visible / too-small exclusions, not a failure.)

NO-GO on any unmet criterion → stop, report numbers, do not start Phase 1.

## 4. Phase 1 — Implementation

Create exactly these files (plus the `.gitignore` and `Makefile` edits below — nothing else):

### 4.1 `.agents/skills/sequence/scripts/gaze.mjs`

Plain Node ESM CLI, mirroring the style of the existing `inspect_gallery.mjs` (read it first
and copy its CLI/argument conventions). Interface:

```bash
node .agents/skills/sequence/scripts/gaze.mjs <gallery-dir> [--json]
```

Behavior:

1. Enumerate images in `<gallery-dir>` (same extensions `inspect_gallery.mjs` accepts).
2. Load both ONNX sessions lazily from `.agents/skills/sequence/models/`. If the models are
   absent, exit 0 with a single JSON object `{"error": "models-not-installed", "hint": "run: make gaze-models"}` — never crash, never download at runtime.
3. Per image: `sharp` decode → BlazeFace → per-face crop (square, 25% margin, per the model
   card input contract) → FaceLandmarker-478 → pose math → eye-contact classification.
4. Emit one JSON object per image to stdout (or a single array with `--json`), matching this
   schema exactly (field names are contractual — the research doc §4 defines them):

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

Pose math (plain JS, ~100 lines, no new dependency):

- Use an Umeyama/Procrustes rigid fit of a stable landmark subset against MediaPipe's
  canonical 3D face geometry. Suggested subset (standard for this task; verify the indices
  against the canonical model you vendor): nose tip 1, chin 152, left eye outer corner 33,
  right eye outer corner 263, mouth corners 61 and 291.
- Decompose the fitted rotation to yaw/pitch/roll in degrees.

Eye-contact classification:

- Iris centers are landmark indices 468 (left) and 473 (right); ring points 469–472 and
  474–477 (verified in the research doc §3.2/§3.5).
- `eyeContact: true` only when both iris-center offsets (normalized within each eye-contour
  bounding box) are near-center AND `|yawDeg|`, `|pitchDeg|` are below thresholds. Start with
  `|yaw| ≤ 15°`, `|pitch| ≤ 15°`, `|offset| ≤ 0.35`; expose the three thresholds as named
  constants at the top of the file (they will be tuned in a later calibration pass — see §6).

`faces: []` is a first-class result. Never interpolate or guess for profile/occluded/tiny
faces; the VLM keeps custody of those frames.

### 4.2 `.gitignore` — append one line

```gitignore
.agents/skills/sequence/models/*.onnx
```

(Keep `MODELS.lock` tracked; ignore only the weight files.)

### 4.3 `Makefile` — add a `gaze-models` target

Read the Makefile first and match its style. The target re-downloads the models using the
URLs recorded in `MODELS.lock` and verifies each SHA-256 with `shasum -a 256 -c`. Do not
wire this target into any existing default/precommit target.

## 5. Phase 2 — Tests (hermetic)

Create `tests/js/gaze.test.js` (Jest, jsdom — match `tests/js/sequence-skill.test.js`
conventions; read it first). Before writing tests, `grep` the existing sequence test file for
reusable fixtures/patterns per the repo's testing guidance, and read
`docs/testing-notes.md`.

Required coverage:

1. **Math tests (the real logic):** pure-JS yaw/pitch/roll fitting and eye-contact
   classification, driven by fixture landmark arrays stored as JSON under
   `tests/fixtures/` (e.g. synthetic frontal face → yaw ≈ 0, eyeContact true; synthetic
   30°-rotated face → eyeContact false). These must run with **no models and no network**.
2. **Seam test:** `gaze.mjs` must isolate ONNX session creation behind an injectable
   `createSessions()` seam so unit tests can substitute stub sessions returning fixed
   landmark tensors.
3. **Absent-models test:** with the models directory missing, the CLI exits 0 and emits the
   `models-not-installed` JSON from §4.1.
4. **Opt-in smoke test:** `describe.skip` by default; only un-skipped manually when models
   are present locally. Any scratch output → `tests/fixtures/sequence-scratch/`.

Verification (paste output):

```bash
npx jest tests/js/gaze.test.js
make test        # coverage floor must not regress
```

## 6. Phase 3 — Gate, docs, and handoff

1. Run `make precommit-fix` once; it must exit 0. Paste the tail.
2. Update **one** status line in `docs/sequence-skill-architecture.md` §8 item 2: append a
   pointer sentence, e.g. "Spike/implementation: see `docs/gaze-vector-action-items.md`
   (executor report) — status: <implemented | blocked at Phase 0>." No other edits to that
   file.
3. Leave a short executor report at the top of your final reply (not a new file): phases
   completed, measured median latency, GO/NO-GO results, files changed, and the exact
   verification outputs.

Explicitly deferred (NOT part of this run): VLM-vs-model agreement calibration over a real
gallery to tune the §4.1 thresholds (needs the expensive VLM in the loop); merging gaze
output into `report.mjs`; wiring gaze into the default digest; any SKILL.md workflow change.

## 7. Definition of done (all required)

- [ ] Phase 0 GO criteria all met, with pasted evidence (or a clean NO-GO stop report)
- [ ] `gaze.mjs` runs on one real gallery and emits schema-conformant JSON (pasted sample)
- [ ] `npx jest tests/js/gaze.test.js` green (pasted)
- [ ] `make test` green, coverage floor not regressed (pasted)
- [ ] `make precommit-fix` exits 0 (pasted tail)
- [ ] Only the files listed in §4/§5 changed; `git status --porcelain` pasted
- [ ] Nothing committed; no model weights tracked by git
