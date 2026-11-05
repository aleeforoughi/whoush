# Canvas to image: design and implementation map

**Source:** specialist handoff "WHOUSH — Canvas-to-Image Full Solution", v1.0, 5 November 2026, received by the owner. It is based on `test-reports/2026-11-05/REPORT.md` and the nine comparison sheets. The decisions below are the specialist's. The **Status in the code** column and section 9 map them onto this repository; that mapping is the lead's, dated 2026-11-05.

All routing defaults, module boundaries, benchmark sizes and acceptance procedures here are proposed engineering decisions, not measured improvements. The 2026-11-05 test runs are the only generation results behind them (`docs/HIGGSFIELD_EVIDENCE.md#model-fit-2026-11-05`).

## 1. The decision

Whoush should build a **scene compiler** that turns the canvas into the strongest inputs the chosen route actually supports. It should sit beside task-specific generation adapters and a small verification layer.

The flow is: resolve → validate → compile → route → generate → verify → calibrate.

- **LLMs** interpret intent and judge evidence.
- **Deterministic code** owns geometry, permissions, model contracts and money.

**What can be guaranteed:**
- consistent instructions
- correct control maps
- bounded spending
- honest result states

**What cannot:** an exact match of every canvas parameter in a generative image. Exact geometry is only enforceable in a deterministic render of accurate assets.

| Layer | First decision | Status in the code (2026-11-05) |
|---|---|---|
| Scene specification | Typed JSON owned by Whoush, versioned, one revision for chat and canvas | Partly: `Staging` (`lib/creative-plan.ts`), sent back at quote time as `stagingOverride`. No operation type, edit locks, revision number or world-coordinate contract yet |
| Prompt | Concise natural language compiled from that JSON; each hard instruction once | **First slice done:** `lib/scene-compiler.ts`. See section 5 |
| Visual guide | A clean composition render of the existing canvas | Not built. The canvas renderer exists (`lib/frame-css.ts`, `lib/scene3d.ts`) |
| Generation | One task-appropriate, production-verified route | Only `soul-image` is verified for images. None of the tested models has API evidence yet |
| Camera editing | Source image plus target-view guide, where supported | Not built |
| Relighting | Keep camera and geometry; use a dedicated relight route if qualified | Not built |
| QA | Deterministic checks, then measurements, then a rubric-based vision judge | Metadata checks only (`lib/output-qa.ts`) |
| Retry | No automatic generic refinement | Already true: no retries exist |
| Experience | One preview card, one price, one primary action | The canvas card and proposal card exist |

## 2. What the experiments do and do not establish

- **"Hybrid is best"** becomes "hybrid is a candidate": two seeds on one model, and the prompts differed in detail as well as format.
- **"No format can do worm's-eye"** becomes "none of these runs met the target": the café table can block a floor-level view, so camera, visibility and model capability are confounded.
- **3D Jutsu Angles** is described by the connector as powered by Seedream 5.0 Pro, so it is not proven to be a separate novel-view model.
- **"Flux cannot relight"** is too broad: one output from a rewritten prompt only rules out that route as the default.
- **`is_inpaint`** does not mean pixel protection. Its meaning differs by endpoint and must be verified.
- **The same seed** does not make different models comparable.
- **The `nano_banana_pro` → `nano_banana_2` mismatch** keeps those results out of any per-version claim.
- **Known failure: duplicate person.** One S4 output added a person; ask for an explicit subject count.
- **Known failure: wardrobe swap.** S4 outputs turned the jacket into a vest; add a garment check to the edit rubric.
- **Directional cues are real.** The Seedream relight showed real blue on the image-right side of the face, and directional red in S3 can be correct. Define light size, direction, fill and contrast before calling a result a failure.

A connector catalog read on 2026-11-05 also listed `nano_banana_2_1` with a mask role and an `is_inpaint` flag that limits an edit to a supplied mask. A search for "relight" returned nothing. These are connector observations, not API evidence: never turn a connector model id into an invented API path.

## 3. Three operations

| Operation | May change | Must keep | Limit |
|---|---|---|---|
| `create` | A new image under the scene | Canvas constraints; references in their role | A text description does not lock an identity |
| `camera_edit` | Camera position and orientation, lens and crop if asked; newly revealed surfaces | Person, wardrobe, pose, layout, world-space lights | Unseen surfaces are inferred |
| `relight_edit` | Light, shadows, highlights, reflections, exposure | Camera, crop, geometry, pose, identity, materials | Lighting changes pixels; "unchanged pixels" is not the test |

Two local operations need no generation: **crop or reframe** (no new perspective) and **colour adjustment**, which must be labelled as such and cannot simulate a new light.

## 4. One scene specification

**Precedence, highest first:**
1. The latest explicit user instruction.
2. That change applied to the scene and synced to the canvas.
3. Edit locks protect everything outside the authorized change.
4. Canvas geometry supplies camera, orientation, framing and lights.
5. References supply appearance, in their roles.
6. Style defaults fill only what is unspecified.

A stale canvas never overrides a fresh chat instruction, and a style preset never overrides a chosen light. When two explicit locks conflict, show the conflict and a proposed adjustment.

**Coordinates.** Right-handed world: +X right, +Y up, +Z the subject's forward direction, ground at Y=0, units in metres.
- The camera sees down its local −Z, with right +X and up +Y.
- Image coordinates have their origin top-left, normalized to [0,1].
- The screen side of a light is `sign(dot(lightPos − subjectPos, right))`, where `right = normalize(cross(normalize(T − C), U))`. Near-vertical cameras need a stable alternate up vector.
- Lights are stored in world space. Viewer-relative words ("from image-left") are derived from the final camera; never emit a bare "from the right".

**Contract (summary of the handoff's `SceneSpec`):**
- `schemaVersion`, `sceneId`, `revision`, `operation`, `sourceAssetId`
- `output`; `world`
- `subjects`: position; body yaw, head yaw and head pitch kept separate; gaze; `evidence` (authored, observed or estimated)
- `camera`: position, target, roll, focal length, effective gate; framing region, target box, tolerance and forbidden crops; locked fields
- `lights`: role, kind, position or direction to the source, size, sRGB colour, intensity and unit, `evidence`
- `objects`: each with a visibility of `must_show`, `may_show` or `offscreen_context`
- `references`: each with a role (source, identity, wardrobe, environment, composition or style)
- `editPolicy`: preserve, change, forbidden, mask and mask convention
- typed `constraints`, each with an `observableFromOutput` flag
- `spending`: max passes (1 or 2), approved quote id, max Neuron debit

Production uses discriminated unions, rejects unknown versions, and never fakes precision for geometry estimated from a photo.

## 5. Camera geometry before prompting

- **Presets are initial geometry, not prompt phrases.** Low angle means the camera sits below the subject's target and aims up. Worm's-eye means near the ground with a clear upward line of sight. Side profile and back three-quarter are head azimuth bands. Tight portrait and full length are measured crop bounds.
- **Lens and framing must agree.**
  - `vFov = 2·atan(gateH / (2·f))`
  - `distance ≈ regionH / (2·occupancy·tan(vFov/2))` is only a starting value; then fit the projected landmarks numerically.
  - Example: a 24×32 mm gate, 50 mm lens, 0.42 m region and 78% occupancy give about 0.84 m.
  - Incompatible locked values return a conflict and are never silently changed.
- **The café worm's-eye case.** Render depth and instances, then test whether the required landmarks are visible.
  - If the table blocks them, return `COMPOSITION_OCCLUDED` with the smallest useful adjustment: move the camera to the open side, widen the shot, or relax a conflicting requirement.
  - Apply the adjustment automatically only to fields that were free to move.
  - To isolate camera compliance from occlusion, test a stool in an open room first.
- **Head pose is separate from camera position.** A camera orbit must not turn the person's head.

## 6. Visual controls from the canvas

**Guide outputs, each for a qualified consumer only:**
- clean composition guide
- depth
- pose
- segmentation
- lighting preview
- radiance hints
- visibility report

Never include gizmos, grids, labels or arrows in model input. Use neutral proxy materials, and never a detailed mannequin face.

**Three control levels:**
1. **Text only:** best effort.
2. **Semantic visual reference:** guided, but role separation must be tested.
3. **Native spatial conditioning:** stronger, but still generative.

A depth image sent as an ordinary reference is not ControlNet, and provider fields that are not documented must never be invented. Cache guide renders by geometry, camera, light, renderer version and output settings. Identity data is never shared across users.

## 7. Prompt compiler rules

**Block order:**
1. Operation and reference roles
2. Camera, view and framing
3. Subject and visible content
4. Lighting and its visible effect
5. Preservation rules for edits
6. A few relevant exclusions

**Rules:**
- Emit each hard instruction once.
- Derive screen sides, angle and view from the transforms.
- Name colours in words. Keep the hex in the scene, never as a promised pixel value.
- Drop `offscreen_context` objects from the prompt.
- State an explicit subject count when duplicate people are a known failure.
- Say "back of head and upper back" for back views.
- Describe lit surfaces and fill for relights, not a colour mood.
- Turn off auto-enhancement only through a documented parameter, and record when the effective prompt is unknown.
- Store the compiled prompt hash and, when known, the effective prompt hash.

The LLM may propose a scene patch. It may not bypass validation, add an endpoint, edit locked fields or change the approved spend.

### Status: first slice (`lib/scene-compiler.ts`, compiler version `2026-11-05.1`)

**Before this slice,** an image prompt could carry camera and light up to four times:
- the planner's own direction (lens, framing and lighting words)
- the planner's scene
- an aspect line
- after a canvas change at quote time, the new scene stacked on the old one

The old scene therefore contradicted the new one.

**Now:**
- The orchestrator keeps the planner's content privately and compiles the image prompt once: the canvas camera and framing in plain words, then the content without its own camera, lens and light wording, then the full scene with lights, focus, lens and aspect ratio.
- A canvas change recompiles from the content, so there is exactly one scene, however many times it changes.
- Rule sentences (keep, preserve, never, only, do not) are never cut.
- Video prompts are unchanged.

### Status: second slice (2026-11-05)

- **Frame sides for lights:** every light is stated once, in the lead, by its side of the frame ("from frame right, level with the subject, at face height"). The canvas already keeps lights relative to the camera (0° frame right, 90° the camera's side, 180° frame left, 270° behind), and orbiting the camera turns them with it. The scene at the end no longer repeats the lights.
- **People count:** "Exactly one person in the picture" (or the number of people on the canvas), except in an over-the-shoulder shot.
- **Back views:** a person seen from behind is described by what shows ("the back of the head and upper back"), and the close framings say "upper back", never "chest".
- **Prompt hash:** each job stores the SHA-256 of the exact prompt it sent, privately; the public job never shows it.

**Still not done:** leaving out props that fall outside the crop. It needs a per-prop visibility test against the frame, which belongs with the occlusion preflight (P1).

**Ordering note:** the lights sit in the lead, before the content, not after it as section 7 orders them. In the 2026-11-05 tests, light stated at the start was followed and light buried after a long description was not.

## 8. Routing, budget and failures

**Decision table (initial, inspectable):**

| Task | Initial route | Limit |
|---|---|---|
| Ordinary new portrait | A qualified reference-capable model; test Nano Banana first for realism | Requalify the current id; the `_2` scores don't transfer to `_2_1` |
| New image with a strong camera angle | Composition guide plus a qualified route; Seedream first | Disclose best effort unless native spatial control is verified |
| Extreme angle | Geometry and occlusion validation, then guide-conditioned generation | No exact-camera promise on a text-only endpoint |
| Crop only | Deterministic crop | No generation |
| Camera edit | Source reference plus target guide on a qualified edit route | Unseen detail is reconstructed |
| Directional relight | A qualified relighter, otherwise a tested edit route labelled "limited control" | No automatic identity or beauty pass afterwards |
| Exact scene deliverable | Deterministic render | A generative finish cannot claim exactness |

**Eligibility before scoring.** A route qualifies only with:
- confirmed operation support
- production access
- the required media roles
- supported dimensions
- enough budget
- acceptable preservation

Capability states are `verified`, `documented_unverified`, `unknown` or `unsupported`.

**Provenance on every result:**
- provider, environment and endpoint
- requested and reported model id, and model version
- adapter, compiler and scene revision
- submitted and effective prompt hash
- reference hashes and their order
- control-map hashes
- requested and returned seed
- quote id and provider job id
- billed cost
- judge version and evaluation state

An unexpected model id inherits no scores, and that mapping leaves automatic selection until it is reconciled.

**Spending:**
- One generative pass by default, two at most.
- The quote covers the maximum authorized debit; there is never a surprise second charge.
- Provider credits are never Neurons.
- `expectedCost = preprocessing + firstPass + verification + P(second)·secondPass + overhead`.

A second pass is allowed only when all of these hold:
- the first passes camera, framing and layout
- the remaining failure is specific and localizable
- the endpoint can isolate the repair
- the quote covers the second pass
- the repair is checked against the source and the target

**Job states:**
- `draft → preflight → quoted → authorized → submitting → running → verifying`
- then one of `matched`, `partial_match`, `unverifiable` or `failed`
- plus `submission_unknown`, which is reconciled with the provider before any resubmission and never auto-retried as a paid job.

Transport failures, safety rejections and visual mismatches are mapped separately. The existing refund policy applies.

## 9. Relighting and camera edits

**Relighting order:**
1. Qualify an existing edit route for mild relights.
2. Pilot a dedicated relighter only if directional failures matter. Candidates:
   - **IC-Light:** check the non-commercial background-removal dependency.
   - **DiLightNet:** radiance-hint control, but multi-stage.
   - **LightLab:** research only.
3. Use radiance-conditioned routes only if exact placement is central and the simpler routes fail.

Masks follow the image transform. A full-scene relight is not limited to a face mask. The original background is only composited back when the light leaves it unaffected. Deterministic colour maths runs in linear light. Clipped areas are missing information.

**Camera edits:**
- A new view is a reconstruction.
- Use separate references for identity (the source) and geometry (the target guide).
- Generated turnarounds never become ground truth.
- Identity conditioning (for example PuLID) belongs only in compatible custom pipelines.

## 10. Verification

Each check is evaluated separately:
- dimensions
- person count
- crop
- view
- camera angle (never an exact height from one image)
- identity
- wardrobe (a jacket that becomes a vest fails)
- light direction (blue pixels alone don't pass)
- scene preservation
- realism, kept apart from compliance

A required failure is never averaged away, and an unobservable check is `unverifiable`, not a pass.

**The judge** sees the source, the clean guide, the output and an atomic rubric. It does not see the model, the cost or the format. It returns per-check states with evidence and abstains when it can't tell. Its confidence is not a calibrated probability.

**Calibration:**
- human labels per requirement, with a double-labelled subset
- calibration and held-out splits, with related scenes kept in the same split
- tracking of the critical false-pass rate, judge/human agreement and abstention
- every piece versioned

The judge's own scores never automatically reinforce the router.

## 11. Benchmark (proposed; needs an approved budget)

**Smoke test:** 6 cases (S1–S4, E1, E2) × 2 eligible routes × 2 outputs = 24 images, plus the stool version of S3.

**Pilot:** 30–50 varied cases per operation. Zero failures in 30 still allows up to about 9.5% failure (one-sided 95%).

**Metrics:**
- first-pass joint acceptance
- critical false-pass rate
- identity and wardrobe drift
- cost per accepted result
- P50 and P95 latency
- second-pass incremental value

Approve release thresholds before reading the results.

## 12. Experience

- **Before generation,** one compact card shows the shot in plain words, what is preserved, a clean composition preview and one priced action.
- **Limits are stated plainly** when they matter. For example, "The table blocks this floor-level view; this preview moves the camera beside it."
- **Results** are "Matched", "Partial match" or "Could not verify", with a short reason. Diagnostics stay in admin views.
- **Paid retries** are never run to turn a badge green.
- **Persian copy and RTL layout** must never flip the light rig or camera geometry.

## 13. Implementation sequence (one PR per row, in order)

| Pri | Deliverable | Where in this repo | Acceptance |
|---|---|---|---|
| P0 | **Compiler, first slice** | `lib/scene-compiler.ts`, `lib/orchestrator.ts` | **Done 2026-11-05:** one scene per prompt; the planner's camera and light removed; a canvas change replaces the scene |
| P0 | Compiler, second slice | `lib/scene-compiler.ts`, `lib/staging.ts`, `lib/jobs.ts` | **Done 2026-11-05:** frame sides for lights; people count; back-view wording; prompt hash on the job. Offscreen props moved to P1 (needs the visibility test) |
| P0 | Provenance and capability states | `lib/catalog.ts`, `lib/jobs.ts`, `lib/media-provider.ts` | Requested and reported model id, compiler version, prompt hash and seed recorded; four capability states; a mismatched id is flagged |
| P0 | Operation and edit policy | `lib/creative-plan.ts` (`Staging`), quote route | `create`, `camera_edit` and `relight_edit` with locks; disallowed edits fail before submission |
| P0 | `submission_unknown` | `lib/jobs.ts` | A timeout during submission never auto-submits another paid job |
| P1 | Occlusion preflight | `lib/scene3d.ts`, `lib/frame-css.ts` | The table blocking the face returns `COMPOSITION_OCCLUDED` before quoting |
| P1 | Guide export | canvas renderer | Correct crop, coordinates, order and mask polarity; only supported fields |
| P1 | QA states and judge | `lib/output-qa.ts` | Required failures and unverifiable checks never become `matched` |
| P1 | Six fixtures | `tests/` | S1–S4, E1 and E2 have exact scene states, target previews and rubrics |
| P2 | Calibrated routing; relight pilot; targeted repair | later | Measured, segmented by operation and version |

**Blocked outside the code:**
- API evidence and pricing for any new image model (`docs/HIGGSFIELD_EVIDENCE.md`)
- hosted, inspected user media for edits
- the launch gates

## 14. Answers to the report's questions

- **Worm's-eye:** no prompt guarantees it. Validate line of sight, then use a guide or native conditioning; render deterministically for exact geometry.
- **Relighting:** a qualified relight route; general editors are a bounded approximation.
- **Hybrid:** not universally better. Keep JSON internal and benchmark per route; default to concise compiled language.
- **Novel view plus identity pass:** only when measured, conditional and localized.
- **Vision judge for routing:** only with atomic rubrics, abstention, human calibration and held-out evaluation.

## Sources (as cited by the handoff, accessed 2026-11-05)

- **S1:** Higgsfield API documentation index and its discovery rules
- **S2:** ControlNet, "Adding Conditional Control to Text-to-Image Diffusion Models"
- **S3:** IC-Light repository
- **S4:** DiLightNet repository
- **S5:** LightLab (Google Research)
- **S6:** Zero-1-to-3
- **S7:** PuLID repository
- **S8:** the Higgsfield 3D Jutsu product page
