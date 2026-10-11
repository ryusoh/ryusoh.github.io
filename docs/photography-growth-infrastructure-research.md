# Research: Long-Term, Compounding Infrastructure for Photographic Growth

**Status:** findings document (research only — no code changed)
**Date:** 2026-10-11
**Scope:** what infrastructure — in this repo or alongside the practice — could
systematically compound a street photographer's growth over a 30+ year horizon.

---

## 1. The question

Given the infrastructure already in `ryusoh.github.io` (the `/sequence` curation
skill with its deterministic CIELAB/gaze pre-processors, the `new-page` gallery
pipeline, ThumbHash blur-up and responsive AVIF/WebP builds, the skills/state-ledger
workflow, and the Jest-gated repo itself), what other **long-term, compounding
infrastructure** should be built — in the repo or alongside the photographic
practice — to systematically close the gap to the Magnum masters over the next
30 years? The synthesis must draw on four bodies of knowledge: the repo's existing
assets, frontier learning-science and computational-imaging research, classic
photography theory and the Magnum contact-sheet tradition, and broader mastery /
compounding frameworks (Thiel's _Zero to One_, Ericsson's deliberate practice,
spaced repetition, quantified self).

---

## 2. The answer

Seven infrastructure proposals, prioritized by compounding leverage. Each builds
on something that already exists in the repo. The deep pattern behind all of them:
**Magnum masters were distinguished less by shooting skill than by the editing
institution around the shooting** (see §4, Magnum contact sheets). The repo already
has half of that institution (the `/sequence` skill is a machine editor); what is
missing is the capture ledger, the training loop, the archive discipline, and the
long-horizon strategy that turn one-off curation into a 30-year compounding machine.

### Proposal 1 (highest leverage): A contact-sheet ledger — digital contact sheets + edit-history as first-class artifacts

**What it is.** For every shoot (not just every finished gallery), commit a
machine-generated "digital contact sheet": all frames from the outing laid out in
capture order, with the chosen selects marked — the Magnum grease-pencil markup,
digitized. Store the _rejected_ frames alongside the selects, plus a one-line
editing rationale per select/reject decision, in a `contact-sheets/` ledger
(sibling repo or gitignored directory, given size).

**Why it compounds.** Kristen Lubben's _Magnum Contact Sheets_ demonstrated that
the contact sheet is where a photographer's growth is actually recorded: it shows
"how the most celebrated Magnum photographers capture and edit the very best shots"
— the working process, not just the results ([TIME via publisher copy](#4-claim-by-claim-evidence)).
Ericsson's deliberate-practice research shows that improvement requires practice
on defined tasks **with feedback**, not mere accumulated hours
([Ericsson et al. 1993](#4-claim-by-claim-evidence)). A contact-sheet ledger converts every outing
into a reviewable practice artifact: six months later you can audit whether your
hit rate (selects per roll), your working-the-scene depth (frames per subject),
and your select-vs-reject accuracy are trending. Without the rejected frames, none
of this is measurable; the current repo keeps only winners (`assets/img/pN/`
holds sequenced finals plus a thin outtakes concept).

**Builds on existing infra.** The `/sequence` skill already computes CIELAB,
ΔE, luminance breath, and gaze vectors per image (`inspect_gallery.mjs` and
`gaze.mjs` under `.agents/skills/sequence/scripts/`) — the same CLI can score
contact sheets, so the "how did my eye change over 5 years" question becomes a
diff of JSON digests, not a vibe. The `p99` synthetic fixture pattern shows the
repo already knows how to keep test data hermetic while production content
evolves.

**Theory backing.** Magnum contact-sheet tradition (Lubben); Ericsson's
deliberate practice (feedback requirement); Simonton's equal-odds rule — the
probability of a great frame per exposure is roughly constant, so greatness scales
with _edited volume_, and the ledger makes volume legible ([Simonton](#4-claim-by-claim-evidence)).

### Proposal 2: A perceptual-learning + spaced-repetition "eye gym" — Anki deck of master images and own near-misses

**What it is.** A personal flashcard system (Anki, or a plain-text deck format
kept in-repo) with two card types:

1. **Master-image cards**: a photograph by Webb, Frank, Moriyama, Kawauchi, Hido
   on the front; on the back, the specific formal mechanism (slant-rhyme diagonal,
   inhalation/exhalation class, montage tier it would occupy). Recognition-first,
   not trivia.
2. **Own near-miss cards**: frames from the contact-sheet ledger (Proposal 1)
   that _almost_ worked, with the failure mode on the back ("horizon cuts subject's
   neck; needed 2 steps left").

**Why it compounds.** Two research lines converge here. Kellman's perceptual-learning
work shows expert pattern extraction is trainable through high-volume classification
trials with feedback — perceptual learning modules have accelerated pattern
recognition in domains from algebra to flight training
([Kellman & Garrigan 2009](#4-claim-by-claim-evidence)). Eye-tracking research shows experts
literally see differently: experts follow "an optimal scan path, often consisting
of fewer" fixations than novices, and in photographic-composition tasks experts
"chose the images with rules of third more often" than novices
([scanpath and composition studies](#4-claim-by-claim-evidence)). And the spacing effect is among
the most replicated findings in memory science — distributed practice beats massed
practice for long-term retention (Cepeda et al. 2006 reviewed 839 assessments;
Roediger & Karpicke 2006 showed retrieval practice beats re-study,
61% vs 40% recall a week later) ([memory studies](#4-claim-by-claim-evidence)). Wozniak's SuperMemo
work operationalized this: review each item at the moment of predicted decay
([SuperMemo 20 rules](#4-claim-by-claim-evidence)).

A 10-minute daily deck reviewing formal mechanisms of master images trains exactly
the perceptual apparatus that street photography runs on — the ability to
pre-recognize a forming geometry before it exists. Over 30 years, ~100,000
spaced reviews of deliberately-chosen images is a compounding perceptual asset no
single workshop can match.

**Builds on existing infra.** The `/sequence` skill's `principles.md` is already a
structured taxonomy of formal mechanisms (Eisenstein tiers, Kawauchi breath
classes, slant rhymes) — each entry is a card-back waiting to happen. The
deterministic layer can auto-generate card metadata (breath class, ΔE to
neighbors) for master images the user curates.

**Sourcing plan (feasibility).** The corpus comes from three tiers, and copyright
shapes the architecture rather than the feasibility:

1. **Public domain / open access (unrestricted, redistributable).** The Library of
   Congress FSA/OWI collection (~175,000 frames by US-government photographers —
   Walker Evans, Dorothea Lange, Gordon Parks's early work — public domain,
   full-resolution downloads) ([LOC FSA/OWI](#4-claim-by-claim-evidence)); museum
   open-access programs — the Met offers 492,000+ public-domain images under CC0
   and the Art Institute of Chicago 50,000+, both with public APIs
   ([Met and AIC Open Access](#4-claim-by-claim-evidence)). This tier alone covers
   the classical documentary canon at zero legal risk.
2. **In-copyright modern masters (private study copies only).** Webb, Frank,
   Kawauchi, Moriyama et al. are findable via agency sites (Magnum), artist
   estates/foundations, and museum online collection pages. Reference copies for
   private study are common practice, but these files **must never enter this
   repo** — it is a public GitHub Pages site, so committing them would be
   redistribution. The corpus lives in a gitignored local directory (or a separate
   private repo); the repo holds only the deck tooling, the taxonomy, and the
   card metadata. (The rights status of a private deck was not legally assessed —
   see §5.)
3. **Own near-misses (free, and the highest-value tier).** Produced continuously
   by Proposal 1's contact-sheet ledger; these cards connect the drill back to
   field shooting, which is the documented weak point of perceptual-learning
   transfer (§5, item 2).

Scale check: a working deck is ~200–500 images (≈10 per formal mechanism in
`principles.md`), and study thumbnails of ~800px suffice — perceptual-learning
studies use far cruder stimuli. Initial curation is a weekend, then slow
accretion; the scheduling software (Anki, or a small local SM-2 page reusing the
repo's thumbhash/responsive-tier pipeline) is a solved problem.

**Theory backing.** Kellman (perceptual learning), Cepeda/Wozniak (spacing),
Roediger & Karpicke (retrieval practice). Note the honest limitation from the
perceptual-learning literature: transfer beyond the trained discrimination is
narrow — the deck trains _seeing_, not _shooting_, and must be paired with
Proposal 1's field practice.

### Proposal 3: An automated critique loop — extend `/sequence` from curation to adversarial self-critique with calibration data

**What it is.** Today `/sequence` curates an already-selected gallery. Extend the
same dual-layer architecture (deterministic metrics + multi-agent deliberation)
one step earlier: run it over a shoot's contact sheet _before_ selection, as an
adversarial critic that must argue why each candidate fails. Then — the compounding
part — record **disagreements between the machine critic and the human editor** in
a calibration log: every frame where the human kept what the machine cut, or vice
versa, with a one-line reason.

**Why it compounds.** The gaze-vector work in this repo already established the
pattern and its caveat: deterministic models (FaceLandmarker) complement rather
than replace VLM judgment, and the next step flagged in
`docs/gaze-vector-action-items.md` §6 was explicitly "VLM-vs-model agreement
calibration over a real gallery to tune the thresholds." Proposal 3 generalizes
that: the disagreement log _is_ the artist's evolving taste made measurable. Barthes gives the theoretical
frame: the machine critic can only ever assess the _studium_ — the culturally
coded, legible content — while the _punctum_, "that accident which pricks me", is
precisely the private, un-automatable residue
([Barthes, _Camera Lucida_](#4-claim-by-claim-evidence)). A 30-year log of human-machine
disagreements is a 30-year empirical map of one's own punctum — arguably the
single most defensible artistic asset a photographer can own in an age of AI
curation (Aftershoot and Lightroom already automate studium-level culling —
duplicates, blinks, blur — commercially; see [industry culling tools](#4-claim-by-claim-evidence)).

**Builds on existing infra.** MAD-protocol council, `inspect_gallery.mjs`,
`gaze.mjs`, `commentary.json` merge semantics — all already built. The new pieces
are a `--contact-sheet` mode and a `calibration.json` append-only log.

**Theory backing.** Barthes (studium/punctum as the human-machine boundary);
Ericsson (feedback quality determines practice value); the repo's own gaze-vector
research doc (calibration methodology).

### Proposal 4: A quantified-shooting self-study — EXIF + outing metadata as a personal longitudinal dataset

**What it is.** A small CLI (`scripts/shoot-log.mjs`) that ingests each outing's
files and emits a dated ledger entry: frames shot, keep rate, focal lengths
actually used, shutter-speed distribution, time-of-day histogram, frames per
scene (working-the-scene depth), plus self-reported conditions (mood, hours walked,
location). Aggregate monthly into a simple report.

**Why it compounds.** This is the quantified-self pattern applied to craft:
Wolf and Kelly founded the movement in 2007 on "self-knowledge through numbers"
([Quantified Self](#4-claim-by-claim-evidence)). Most photographers _feel_ they shoot certain
subjects at certain times; almost none know. Thirty years of structured
shooting data answers questions no amount of talent can: Do I keep more frames
in year 10 than year 5? Which focal length am I actually growing into? Did my
flash work begin when I started shooting past 9pm? Ericsson's framework supplies
the causal logic: deliberate practice requires that performance be measurable
against a standard, and measurement infrastructure is precisely what this
provides ([Ericsson et al. 1993](#4-claim-by-claim-evidence)).

**Builds on existing infra.** `sharp` already reads image metadata in the build
pipeline (`scripts/build-page.mjs`); EXIF extraction is a small extension. The
repo's state-ledger philosophy (`.agents/state/`, disk-backed ground truth per
`AGENTS.md`) is exactly the right architecture for an append-only shoot log.

**Theory backing.** Quantified self; deliberate practice measurement
requirements; the design-research doc's own "EXIF as testimony" art direction
(`docs/design-research.md` §A) — the site already treats EXIF as a first-class
narrative surface, so the same data feeds both art and self-study.

### Proposal 5: Archive discipline as a compounding asset — boring, redundant, documented storage

**What it is.** A documented archival protocol for the lifetime body of work:
RAW + JPEG masters in open formats, 3-2-1 backup, descriptive metadata written at
ingest, and a written "future reader" README. Deliberately the least glamorous
proposal.

**Why it compounds.** The Library of Congress's personal-digital-archiving
guidance exists precisely because personal digital collections rot silently —
format obsolescence, single-copy loss, undescribed files
([LOC Personal Digital Archiving](#4-claim-by-claim-evidence)). For a photographer, the archive
_is_ the career: every retrospective book, every re-edit (cf. how the Magnum
contact-sheet project mined 70-year-old sheets), every future sequence a
more-skilled future-self will make depends on today's files surviving and being
interpretable. The option value of an intact, well-described 30-year archive is
enormous and entirely forfeited by a disk failure in year 7.

**Builds on existing infra.** The repo already practices checksum discipline
(`MODELS.lock` SHA-256 registry) and pipeline determinism (golden-master
roundtrip tests in `docs/page-generation-pipeline.md` §9); extending the same
"verify, don't trust" posture to the master archive is culturally native here.

**Theory backing.** LOC preservation guidance; the Magnum archive tradition
(Lubben's book is itself an artifact of preserved contact sheets).

### Proposal 6: Public cadence — the publishing pipeline as a forcing function, and the site as a compounding public artifact

**What it is.** Commit to a fixed publishing cadence (e.g. one sequenced gallery
per N months) executed through the existing `make page` pipeline, with each
gallery's `sequence-report.md` treated as a public artist's-statement artifact.
Over decades, the site becomes a dated, navigable record of the eye's evolution —
the longitudinal portfolio as the portfolio.

**Why it compounds.** Simonton's equal-odds rule implies that eminent creators
do not have a higher hit rate per work — they produce more works, so the count of
great works scales with total output ([Simonton](#4-claim-by-claim-evidence)). A fixed cadence
converts that statistical fact into a commitment device. It also compounds
socially: each published sequence report is a public proof-of-process that
distinguishes the site from an Instagram feed.

**Builds on existing infra.** `make page ID=pN`, `sequence-report.md` generation,
`portfolio-shell.html`, sync-pages governance — the entire publication machine
already exists; this proposal is a _schedule_, not code.

**Theory backing.** Simonton (equal odds); Sontag's warning as the counterweight —
_On Photography_ critiques photography's appetite to appropriate and accumulate
("to photograph is to appropriate the thing photographed"), which is the argument
for cadence-with-editing over cadence-as-dump ([Sontag](#4-claim-by-claim-evidence)).

### Proposal 7: Strategy layer — Thiel applied to a one-person art practice

**What it is.** Not software — a written, annually-revisited strategy document
(`docs/practice-strategy.md` or personal notes) applying four _Zero to One_
ideas to the practice itself:

1. **Secrets.** Thiel's question — "what important truth do very few people agree
   with you on?" — becomes an artistic one: what do I see on the street that no
   one is photographing? A maintained list of candidate "secrets" (places, times,
   communities, light conditions the local photo scene ignores) is a prospecting
   map for original work.
2. **Monopoly of one.** Thiel's "competition is for losers" / build a monopoly via
   being 10x different in a niche translates to: do not compete with every
   Instagram street photographer on generic decisive moments; compound in a niche
   (a specific place + method + register, e.g. the repo's existing hardboiled
   flash-noir direction) until the style itself is the moat. Flusser supplies the
   warning that makes this urgent: the camera's program defines the space of
   possible images, and photographers who shoot without a concept merely execute
   the apparatus's program — monopoly-of-one is the deliberate escape from the
   program ([Flusser](#4-claim-by-claim-evidence)).
3. **Definite optimism.** Thiel contrasts the definite optimist (a plan, built
   deliberately over years) with the indefinite optimist (things will work out).
   A 30-year mastery arc _is_ definite optimism: Proposals 1–6 are the definite
   plan; without them, "get better at photography" is indefinite.
4. **Compounding advantages as design principle.** Thiel's durable-monopoly
   characteristics (proprietary technology 10x better, network effects, scale
   economies, brand) map cleanly onto this whole document: the critique/calibration
   system (Proposal 3) is the proprietary technology; the archive (Proposal 5) is
   the scale economy; the published cadence (Proposal 6) builds the brand; the
   eye gym (Proposal 2) compounds the human capital none of the others work
   without.

**Why it compounds.** Career-length art practices fail more often from strategic
drift than from insufficient skill. A written strategy that survives mood is the
infrastructure that keeps the other six proposals running for decades.

**Theory backing.** Thiel & Masters, _Zero to One_ (2014, Crown Business)
([book](#4-claim-by-claim-evidence)); Flusser, _Towards a Philosophy of Photography_
([Flusser](#4-claim-by-claim-evidence)).

### What deliberately is NOT proposed

- **Chasing computational-aesthetics scores.** NIMA (Talebi & Milanfar) and
  CLIP-style aesthetic predictors can rank images by learned crowd preferences,
  and they are useful as _critique sparring partners_ (Proposal 3) — but training
  one's eye toward a learned average of crowd taste is anti-compounding: it
  optimizes the studium at the expense of the punctum. Use them as instruments,
  never as targets.
- **More web-effects infrastructure.** `docs/design-research.md` already covers
  site aesthetics exhaustively; per its own logic, the site is the frame, not
  the picture.

---

## 3. Existing repo infrastructure inventory (the foundation)

Grounded by direct reading of the sources below this session:

1. **Gallery compilation pipeline** (`make page ID=pN` → `scripts/build-page.mjs`):
   compiles `p<N>/index.html` from `assets/img/pN/index.md` + raw photos via the
   canonical shell `scripts/templates/portfolio-shell.html`; updates nav across all
   pages and `js/preloader.js`. Source: `.agents/skills/new-page/SKILL.md`,
   `docs/page-generation-pipeline.md`.
2. **Responsive image + placeholder builds** (`scripts/build-images.mjs`,
   `scripts/generate-thumbhashes.mjs`): AVIF/WebP tiers at 768w/1200w/2048w,
   sharp-extracted dimensions, 28-char ThumbHash blur-up baked into HTML.
   Source: `docs/page-generation-pipeline.md` §4.1, `docs/image-loading-performance-research.md`.
3. **The `/sequence` curation skill** (`.agents/skills/sequence/`): dual-layer
   architecture — a deterministic Node CLI layer (`inspect_gallery.mjs`: CIELAB
   L\*a\*b\*, ΔE₇₆ transition costs, Kawauchi inhalation/exhalation cadence,
   Hamiltonian step-cost matrix) feeding a multi-agent deliberation council
   (Curator, Montage Director, Slant/Breath Synthesist, Pruning Critic) grounded
   in Eisenstein/Webb/Kawauchi/Eskenazi photobook theory. Generates
   `sequence-report.md` + SVG figures; `commentary.json` stores intrinsic
   (image-bound) critiques separately from relational (position-bound) ones, so
   future models can re-curate incrementally. Source: `docs/sequence-skill-architecture.md`.
4. **Deterministic gaze pipeline** (`gaze.mjs`): two-stage ONNX (BlazeFace +
   FaceLandmarker-478) head-pose and eye-contact estimation, with a researched
   calibration agenda (VLM-vs-model agreement). Source: `docs/gaze-vector-estimation-research.md`,
   `docs/gaze-vector-action-items.md` (implemented).
5. **Skill system & governance**: canonical skills in `.agents/skills/` with
   generated commands, `make precommit-fix` gate, hermetic test fixtures (`p99`),
   state-ledger working philosophy (`.agents/state/`, disk as source of truth).
   Source: `AGENTS.md`.
6. **Design/performance research base**: `docs/design-research.md` (hardboiled art
   direction, EXIF-as-testimony), `docs/image-loading-performance-research.md`
   (delivery pipeline already engineered to frontier practice).

Notable absences (the gaps the proposals address): no record of rejected frames or
shooting process (only winners persist); no memory/training system for the
photographer's own perception; no longitudinal shooting metrics; no documented
archive/backup protocol; no written long-horizon strategy.

---

## 4. Claim-by-claim evidence

### Learning science

- **Deliberate practice requires defined tasks with feedback; hours alone don't
  produce expertise.** Ericsson, Krampe & Tesch-Römer (1993), "The Role of
  Deliberate Practice in the Acquisition of Expert Performance", _Psychological
  Review_ 100(3), 363–406. <https://doi.org/10.1037/0033-295X.100.3.363>
  (citation and DOI verified via multiple independent reference lists).
- **Perceptual expertise is trainable via high-volume classification trials with
  feedback.** Kellman & Garrigan (2009), "Perceptual learning and human
  expertise", _Physics of Life Reviews_ 6(2). PDF:
  <https://kellmanlab.psych.ucla.edu/files/kellman_garrigan_2009.pdf>.
  PLM applications in flight training and mathematics: Kellman lab archive,
  e.g. <https://kellmanlab.psych.ucla.edu/wp-content/uploads/sites/357/2025/09/kellman_stratechuk_hampton_1999.pdf>.
  Caveat on narrow transfer: consistent with the critical summaries found
  (e.g. <https://www.mindomax.com/visual-pattern-recognition-150-milliseconds>).
- **Spaced/distributed practice beats massed practice for long-term retention.**
  Cepeda, Pashler, Vul, Wixted & Rohrer (2006), "Distributed practice in verbal
  recall tasks: A review and quantitative synthesis", _Psychological Bulletin_
  132(3), 354–380. <https://doi.org/10.1037/0033-2909.132.3.354>. Optimal-gap
  follow-up: Cepeda et al. (2008), "Spacing effects in learning: A temporal
  ridgeline of optimal retention", _Psychological Science_ 19(11), 1095–1102.
- **Retrieval practice (testing) beats re-study.** Roediger & Karpicke (2006),
  "Test-enhanced learning", _Psychological Science_ 17(3), 249–255 (61% vs 40%
  delayed recall figure cited from secondary review).
- **Spaced-repetition scheduling operationalizes the spacing effect.** Wozniak,
  "Effective learning: Twenty rules of formulating knowledge" (SuperMemo, 1999+):
  <https://super-memory.com/articles/20rules.htm> (URL verified via multiple
  references). Anki (open-source SRS): <https://apps.ankiweb.net/>.

### Attention / eye-tracking

- **Experts scan scenes more efficiently than novices** (fewer fixations, more
  consistent/optimal scanpaths): scanpath comparison study,
  <https://link.springer.com/content/pdf/10.3758/s13428-018-1154-0.pdf>; summary
  of Reingold & Sheridan (2012) expert-novice eye-movement findings in
  <https://trepo.tuni.fi/bitstream/handle/10024/116456/978-952-03-1178-0.pdf>.
- **Composition preference differs by expertise**: "An Eye-Tracking Study on
  Composition" (Torabi et al.) — "the experts chose the images with rules of third
  more often while the novices chose other elements".
  <https://soad.kmutt.ac.th/wp-content/uploads/2021/06/2021INTC3.pdf>.

### Computational aesthetics / industry

- **NIMA predicts technical and aesthetic quality distributions from human
  ratings.** Talebi & Milanfar (2018), "NIMA: Neural Image Assessment", _IEEE
  TIP_ 27(8), 3998–4011. <https://arxiv.org/abs/1709.05424> (verified this
  session; also cited as IEEE TIP 2018 by later work).
- **CLIP provides general image-text embeddings usable for retrieval/curation.**
  Radford et al. (2021), "Learning Transferable Visual Models From Natural
  Language Supervision". <https://arxiv.org/abs/2103.00020>.
- **Commercial AI culling is now standard industry practice** (duplicate grouping,
  blink/blur rejection, style-learning edit profiles): Aftershoot feature set per
  independent reviews, e.g. <https://www.unite.ai/aftershoot-review/>,
  <https://jessicawhitaker.co/blog/aftershoot-culling-review>; Lightroom's own
  AI culling noted as a direct competitor in
  <https://aiarty.com/edit-photo/aftershoot-reviews.htm>.

### Photography theory and the editing tradition

- **Magnum's masters worked through contact sheets; editing was the craft.**
  Lubben (ed.), _Magnum Contact Sheets_ (Thames & Hudson): presents "how the most
  celebrated Magnum photographers capture and edit the very best shots"; 139
  contact sheets from 69 photographers. Publisher/retail copy and TIME review:
  <https://www.amazon.com/Magnum-Contact-Sheets-Kristen-Lubben/dp/0500292914>;
  ICP interview with Lubben:
  <https://icplibrary.wordpress.com/2012/02/20/magnum-contact-sheets-an-interview-with-kristen-lubben/>.
- **Szarkowski's five characteristics of the medium** — the thing itself, the
  detail, the frame, time, vantage point (_The Photographer's Eye_, MoMA 1964/66):
  corroborated summaries at
  <https://medium.com/@kat.pokorny/szarkowskis-5-categories-of-photos-d483470cb62b>
  and <https://grokipedia.com/page/John_Szarkowski>; cited in-repo by
  `docs/sequence-skill-architecture.md` §7 (Shore, _The Nature of Photographs_,
  Phaidon 2007, likewise).
- **Barthes: studium vs punctum.** _Camera Lucida_ (1980); punctum = "that
  accident which pricks me". <https://en.wikipedia.org/wiki/Studium_and_punctum>.
- **Sontag: photography as appropriation and aggression.** _On Photography_
  (1977), opening essay "In Plato's Cave": "To photograph is to appropriate the
  thing photographed"; "There is an aggression implicit in every use of the
  camera." Excerpt and discussion:
  <https://germanmodernism.org/2008/07/27/in-platos-cave-by-susan-sontag-from-on-photography-1977/>.
- **Flusser: apparatus, program, technical images.** _Towards a Philosophy of
  Photography_ (1983/84): the photographer operates within the camera's program;
  freedom lies in playing _against_ the apparatus. Flusser Studies citation:
  <https://flusserstudies.net/sites/www.flusserstudies.net/files/media/attachments/the-non-deterministic-apparatus.pdf>;
  summary: <https://inigomedina.co/library/work/flusser-towards-philosophy-of-photography>.
- **Benjamin: aura and mechanical reproduction.** "The Work of Art in the Age of
  Mechanical Reproduction" (1935) — aura as unique presence, eroded by
  reproducibility: summary at
  <https://culturalstudiesnow.blogspot.com/2013/05/walter-benjamins-concept-of-aura-and.html>.

### Mastery / compounding frameworks

- **Thiel, _Zero to One_ (2014, Crown Business).** Core theses used here: 0→1 vs
  1→n progress; secrets ("what important truth do very few people agree with you
  on?"); definite vs indefinite optimism; monopoly characteristics (proprietary
  technology 10x better, network effects, economies of scale, branding) and
  start-small-then-expand. Publication details verified from the book's front
  matter: <https://icrrd.com/public/media/01-11-2020-203418Zero%20to%20One.pdf>;
  thesis summaries: <https://mooncamp.com/blog/zero-to-one-book-summary>,
  <https://aibooksummarizer.com/book-summaries/zero-to-one-summary>.
- **Simonton's equal-odds rule**: quality of output is a linear function of
  quantity; per-work probability of impact is roughly constant across a career.
  Empirical examination: <https://link.springer.com/content/pdf/10.1007/s11192-020-03571-w.pdf>;
  Simonton's own abstracts: <https://simonton.faculty.ucdavis.edu/research/abstracts/abs200/>.
- **Quantified Self**: founded by Gary Wolf and Kevin Kelly (Wired) in 2007,
  motto "self-knowledge through numbers", quantifiedself.com launched 2008.
  Corroborated by multiple academic theses, e.g.
  <https://open.uct.ac.za/bitstream/handle/11427/27443/thesis_com_2017_de_villiers_stephanie.pdf>.

### Archival practice

- **Library of Congress Personal Digital Archiving guidance** (identify, decide,
  organize, backup copies in different places):
  <https://digitalpreservation.gov/personalarchiving/>; photo-specific tips:
  <https://www.digitalpreservation.gov/personalarchiving/documents/PA_photo.pdf>
  (URL referenced in <https://pda.missouri.edu/resources-supporting-pda/intermediate-resources/digital-photographs-archiving-toolsresources/>).

### Image corpus sources (Proposal 2 sourcing plan)

- **LOC FSA/OWI collection**: ~175,000 black-and-white photographs documenting
  American life 1935–1944, made by US-government photographers (Walker Evans,
  Dorothea Lange, Gordon Parks, Arthur Rothstein, Russell Lee, among others) and
  therefore public domain, with full-resolution downloads:
  <https://www.loc.gov/collections/fsa-owi-black-and-white-negatives/about-this-collection/>
  (URL identified via search this session; loc.gov blocks automated fetches — the
  page and the 175,000-frame count are corroborated by the LOC's own Picture This
  blog: <https://blogs.loc.gov/picturethis/2015/07/sampling-slices-of-the-fsaowi-collection/>).
- **Met Open Access**: over 492,000 public-domain images available "for free and
  unrestricted use" under CC0, with a public API and CSV datasets:
  <https://www.metmuseum.org/about-the-met/policies-and-documents/open-access>
  (fetched this session).
- **Art Institute of Chicago Open Access**: "free, unrestricted use of over 50,000
  images" under CC0, plus a unified public API: <https://www.artic.edu/open-access>
  (fetched this session).

### Repo sources (read this session)

- `.agents/skills/sequence/SKILL.md`, `.agents/skills/new-page/SKILL.md`
- `docs/sequence-skill-architecture.md` (dual-layer architecture, archetypes,
  hermetic p99 fixtures, `commentary.json` merge semantics)
- `docs/gaze-vector-estimation-research.md`, `docs/gaze-vector-action-items.md`
  (implemented ONNX gaze pipeline; calibration explicitly deferred)
- `docs/page-generation-pipeline.md` (3-tier hybrid architecture, golden-master
  testing, sync governance)
- `docs/design-research.md` (hardboiled direction, EXIF-as-testimony)
- `docs/image-loading-performance-research.md` (delivery pipeline state)
- `AGENTS.md` (state-ledger philosophy, hermetic testing rules)

---

## 5. Open questions / what could not be verified

1. **No primary text of _Zero to One_, _Camera Lucida_, _On Photography_, or
   Flusser was fetched in full this session** — claims about them rest on the
   verified secondary summaries and excerpt pages cited above (plus a scanned
   front-matter PDF for Thiel's publication details). Short quoted phrases were
   cross-checked across at least two independent pages, but a close-reading pass
   of the originals is warranted before quoting them in published artist
   statements.
2. **Transfer distance of perceptual learning to aesthetic judgment is unproven.**
   Kellman's PLM results are strong for structured pattern recognition (math,
   flight, medicine); whether a "master-image flashcard deck" measurably improves
   _street-photography composition in the field_ is an extrapolation, not a
   demonstrated result. The proposal is a well-motivated self-experiment
   (measurable via Proposal 4's keep-rate trend), not established science.
3. **NIMA/CLIP as critique instruments on street photography specifically**:
   both models were trained on crowd-rated or web-alt-text data biased toward
   conventional aesthetics; their scores on deliberately harsh flash-noir work
   are unvalidated. Treat any such score as noise until calibrated against the
   photographer's own edit history (Proposal 3's disagreement log).
4. **Empirical dose for the eye gym** (reviews/day, deck size, photography-specific
   card design) is unspecified; Wozniak's minimum information principle and
   card-formulation rules apply but need iteration. The corpus sourcing plan is
   now specified (§2, Proposal 2), but the rights status of tier-2 in-copyright
   images kept as private study copies was not legally assessed — no legal advice
   is given here.
5. **Quantitative baselines for "improvement"** (what keep-rate or hit-rate trend
   is realistic over years) have no published norm that could be verified; the
   shoot-log proposal exists precisely because each photographer must establish
   their own baseline.
6. **Benjamin citation** rests on secondary summaries only; the 1935 essay text
   itself was not fetched this session.
