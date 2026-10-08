# KARTA_SPACE v0.2, revision 6: the orbit composition and the real satellite

**Type:** a changes-only document. It lists only what differs from revision 5.
**Applies on top of:** `docs/spec-v0.2.md` (MVP v0.2, revision 5). Everything not mentioned here is unchanged. Where this document and the spec disagree, **this document wins**.
**Source:** the sender's sketch of the orbit screen. The planet sits small in the bottom-right corner, the satellite is large in the middle and opens like a real one, the contrail comes in at the top-left, and the comet passes by at the top-right.
**Mockups:** the rows M4, M5, M8, M9, M12 and M14 of the **KARTA_SPACE v0.2 mockups** canvas (https://claude.ai/artifact/A2tNPJyQpoauYQ9LXxGbtd, private until shared). The index is in §10.

---

## 0. Summary

| # | Change | Replaces (revision 5) |
|---|---|---|
| **R18** | **New orbit composition.** In the hub the planet is a small arc in the bottom-right corner. The satellite is large and centred on a diagonal. The trail enters at the top-left, and the comet passes by at the top-right on a short dotted path. | §8.9 composition, §9.1 trail placement, §11.2 orbit orientation |
| **R19** | **The satellite opens like a real one.** Two solar-array wings on booms extend from opposite faces of the cube and unfold like an accordion, three panels per wing. They replace the four petals that swung up. | §8.2 timeline and panel look, §12.2 `deploy` cue, §23.3 glint sweep |
| **R20** | **A co-moving hub camera.** In the hub the satellite no longer travels round a ring on screen. It holds its place with a slow station-keeping drift, while the sky turns slowly behind it. The orbit ring is no longer drawn in the hub; the chart still draws it. | §8.9 satellite motion and ring, §22 `ORBIT_PERIOD_S` |
| R21 | **Knock-on changes.** The paths of the departure, the rocket, the reply star and the returned comet are re-routed to fit the new layout. The hint moves to the top at 72px. The comet always shows a short dotted segment ahead of it in the hub, with a minimum on-screen tail. | §8.4, §8.9, §8.10, §10.3, §10.4, §11.2 |

The state machine, the comet moment, the nudge, the sheets, the chart (§8.5), the close-up, the server, the emails and the editor are **all unchanged**.

---

## 1. Working with Claude Code

1. Commit this file as `docs/spec-v0.2-r6-orbit.md` next to `docs/spec-v0.2.md`, and link it from `docs/README.md` with one line: "Revision 6 (orbit composition) overrides §8.2, §8.4, §8.9, §8.10, §9.1, §10.3–10.4, §11.2, §12.2, §16, §17, §18, §22 and §23 where stated."
2. **Where it lands in §19:**

   | Phase | Change |
   |---|---|
   | 5 | Camera and orbit composition: `hubPose`, co-moving camera, sky turn, framing checks (§3, §7) |
   | 6 | Deployment: `SolarWings` and the new timeline (§2) |
   | 8 | Comet visuals: orbit orientation, the dotted segment ahead, the minimum tail, the departure path (§4) |
   | 13 | Rocket: the launch path and the star position (§4) |

3. **If those phases are not built yet,** use this document together with the spec in the same session. Prompt: "Read `docs/spec-v0.2.md` §0 and §19 phase N, then `docs/spec-v0.2-r6-orbit.md`, which overrides it. Implement phase N. Add the verify checks both list. Finish with `npm run verify` and `npm run typecheck` green."
4. **If they are already built,** run one migration session first. Prompt: "Read `docs/spec-v0.2-r6-orbit.md`. Apply §11 (migration steps) in order. Keep `npm run verify` green after each step, then update the docs named in §8." The steps in §11 are ordered so that every intermediate commit still works.
5. For composition and motion, open the rev-6 frames listed in §10. **The numbers in this document win over the frames.**

---

## 2. The satellite opens like a real one (R19)

### 2.1 Geometry (`lib/satelliteGeometry.ts`, pure; `components/three/SolarWings.tsx`)

All sizes are in cube units: the cube edge is 2, and the cube's local axes are X (the wing axis), Y (up) and Z (the front face).

| Part | Spec |
|---|---|
| Body | the cube itself, unchanged: glass faces, `Edges` `#9fb4c9`. The front face keeps a faint inner glow. |
| Booms | two, from the centres of the +X and −X faces, length `BOOM_L = 0.5`, radius 0.03, `#9fb4c9` |
| Wings | one per boom, `N_PANELS = 3` panels in a chain along ±X |
| Panel | `PANEL_W = 1.1` along X × 1.9 along Y, 0.02 thick. Front: `--navy` base with the existing ion cell-grid shader (`shaders/panelCells.ts`) and `Edges` `#9fb4c9`. Back: `#141a28`, no grid. |
| Mast | 0.45 tall on the top face, off-centre at (0.4, 1, 0.4), carrying the nav light (unchanged: ion-white, 2.6 s, 10% duty) |
| Deployed span | tip to tip 2 + 2 × (0.5 + 3 × 1.1) = **9.6** cube units |

**The wing chain.** `wingChain(side, boom, unfold)` returns the four hinge points of one wing.

- The root is at `(side × (1 + BOOM_L × boom), 0, 0)`.
- Panel k is hinged about Y and turned by `a_k = ±θ` in the X–Z plane, with the sign alternating per panel (an accordion).
- `θ = WING_FOLD_MAX × (1 − unfold)`, and `WING_FOLD_MAX = 84°`.
- At `unfold = 0` the panels are a folded stack beside the face. At `unfold = 1` they are flat and in line.

`SolarWings.tsx` builds the panel quads from these points. The same function feeds verify (§7) and the mockups.

**While reading there are no wings.** Nothing may cover a face while the letter is being read. The booms and folded stacks exist only from `deploying` t = 0.15 until `undeploying` finishes. They emerge from the face centres: the stack scales from 0 → 1 along the boom axis over t 0.15–0.25, so it never intersects the cube.

### 2.2 Deployment timeline (`deploying`, `DEPLOY_MS = 3600`)

This replaces the table in spec §8.2. Ownership and `deployEnd` are unchanged. `CameraRig` uses the same constant.

| t | Cube and wings | Camera and scene |
|---|---|---|
| 0–0.25 | slerp from the face-6 orientation to the **display orientation**: the wing axis at −50° on screen, the +X wing nearer the camera and upper-right, the front face and top face visible | overlay starts fading; dimming lifts |
| 0.15–0.35 | both booms extend 0 → 0.5, carrying the folded stacks out of the ±X faces | camera begins easing toward the hub pose |
| 0.35–0.75 | **each wing unfolds like an accordion**, root to tip: fold 84° → 0°, the three hinges staggered by `WING_STAGGER_MS = 120`, the near wing 80 ms after the far one. Each panel locks with a soft click (sound, §2.4) and a glint as the key light catches it. | the planet rises into the **bottom-right corner** |
| 0.70–0.80 | one thruster pulse: a point-light flash under the body, 0 → 2 → 0 | – |
| 0.60–1.0 | the cube scales 1 → `SAT_SCALE` (0.42, unchanged; the wings are part of the scaled satellite) | camera settles at the **hub pose** (§3) |

- The orbit ring no longer fades in (R20).
- `undeploying` plays the same timeline in reverse: the wings fold, the booms retract into the faces, and it lands back on an identical closing screen.
- Reduced motion: a 300 ms crossfade to the deployed satellite at the hub pose.

### 2.3 Light (spec §23.3)

The glint now **sweeps across the six panels in turn** (far wing root → tip, then near wing root → tip) whenever the key-light angle passes, instead of across four panels. Everything else in §23.3 is unchanged.

### 2.4 Sound (spec §12.2)

| Cue | When | Character |
|---|---|---|
| `deploy` | `deploying` start | rising pad over 3.4 s plus **a soft click as each of the six panels locks**, following the stagger |

---

## 3. The orbit hub composition (R18, R20)

This replaces the composition bullets and the satellite motion in spec §8.9. The interaction table, bottom bar and sheets are unchanged.

### 3.1 Framing targets (`hubPose(aspect)` in `framing.ts`, replacing `orbitPose()`)

The world stays as it is: the planet (radius 2.2), the satellite on its orbit, and the comet's orbit. `hubPose` places the camera so the numbers below hold. Values are fractions of the viewport (x from the left, y from the top).

| | Portrait (reference 390 × 844) | Landscape (reference 1280 × 800) |
|---|---|---|
| **Planet** | a small arc in the bottom-right corner: centre off-screen at about (1.21, 1.22), radius ≈ 1.07 × width. The limb meets the bottom edge at x ≈ 0.25 and the right edge at y ≈ 0.74. Visible area 8–15% of the frame (mock: 13%). | centre about (1.11, 1.44), radius ≈ 0.55 × width. The limb meets the bottom edge at x ≈ 0.64 and the right edge at y ≈ 0.58. Visible area 8–15% (mock: 10%). |
| **Satellite** | body centre (0.44, 0.55); wing axis −50° ± 6° (lower-left → upper-right); the near (+X) wing upper-right and larger; tip to tip 75–85% of the width (mock: 81%); the whole hull inside the frame with ≥ 4% margin (mock hull x 0.19–0.84, y 0.35–0.70) | body centre (0.47, 0.50); same axis; tip to tip 32–40% of the width (mock: 36%) |
| **Trail** | inside the top-left quadrant: near end about (0.30, 0.34), just above-left of the far wing; it rises and recedes to its far end about (0.38, 0.11). Nothing above y = 88px, so the social row stays clear. | near end (0.32, 0.42) → far end (0.36, 0.07) |
| **Comet (away)** | top-right quadrant, around (0.82, 0.22) for the sample. The dotted segment ahead runs up-left into the distance to about (0.53, 0.13) (§4.1). | around (0.81, 0.22), segment ahead to (0.66, 0.12) |
| **Comet (returned)** | beside the planet at the right edge, around (0.90, 0.66), tail pointing up and away from the planet, clear of the satellite | around (0.88, 0.70) |
| **UI** | sound toggle top-right, social row top-left (unchanged); the hint line moves from 96px to **72px** from the top; bottom bar unchanged (it overlays the lower part of the planet) | unchanged |

### 3.2 What moves in the hub (the co-moving camera)

- **The satellite holds its place.** It no longer circles the planet on screen. It keeps a slow station-keeping drift: ±1.5% of the viewport and ±1.2° of roll over 30 s, on top of the existing ±6° tumble. The mock's `kStation` animation shows this.
- **The orbit is felt, not drawn.** The sky (starfield and nebula sphere) turns about the planet's axis at 0.6° per 10 s, but only in the hub. The planet's surface and clouds keep rotating, and the key light keeps moving (§23.3). This stays inside the §23.5 calm limits.
- **No orbit ring in the hub.** `OrbitRing` is drawn only in the chart (§8.5), where the satellite is a glint on its tiny ring. `ORBIT_PERIOD_S = 48` now drives only that glint.
- **Hit areas.** The satellite's hit area is its projected hull, body and wings, which is much larger than before. Tapping it still dispatches `dock`. The planet's hit area is its visible arc above the bottom bar, at least 48px on screen.
- Reduced motion: no drift, no sky turn (as for all ambient motion).

---

## 4. Knock-on changes (R21)

### 4.1 The comet in the hub (spec §11.2)

- **Orbit orientation.** Orient the comet's orbit so that, from the hub pose:
  - the outbound leg rises from the planet up the right-hand side and recedes toward the top centre-right;
  - for 0.06 ≤ f ≤ 0.94 the comet projects into the top-right quadrant (portrait x ≥ 0.5, y ≤ 0.45), at least 24px from the satellite's hull;
  - perihelion stays just outside the planet's limb (bottom-right), so the departure and the return happen there.

  This replaces "the aphelion points into the far background (−z, slightly up)". The 22° tilt and the seeded rotation are unchanged, but the seeded rotation is now limited to ±6° so the quadrant rule always holds.
- **Dotted segment ahead, always visible in the hub.** The next 6% of the orbit parameter ahead of the comet is drawn as a dotted line (dash 2 / gap 6, 1.2px). It fades from 0.7 to 0 opacity, ion `#7fd4f5`, or warm once the receiver's words are aboard. This is what makes it read as passing by. The full orbit line stays chart-only (§8.5) and hover-only.
- **Minimum tail in the hub.** The tail is drawn at least 24px long on screen in portrait (36px in landscape), even when the distance formula gives less. The chart and close-up keep their own rules.

### 4.2 Departure (spec §8.4)

`DEPART_MS`, the ownership and the line `彗星が、旅立ちます。` are unchanged.

- The comet comes round the planet's limb at the **right edge (bottom-right)**.
- It rises past the **tip of the near wing**; its point light sweeps a glint across that wing's panels as the hand-over.
- It heads up the right-hand side to its position in the top-right, time-lapsed as before.
- The camera turn is at most 4° (was 8°), since the path stays in frame.

### 4.3 Rocket (spec §10.3, §10.4)

- It lifts off the planet's limb in the bottom-right and rises past the near wing tip (glint).
- It runs up the right-hand side along the comet's path, overtakes the comet in the top-right, and settles **just beyond it on the dotted segment ahead**. The camera turn is at most 4°.
- The reply star's position rule (§10.4) is unchanged: the comet's position on the launch date, 1.5 units further along its orbit. With the new orientation it lands on or near the dotted segment.

### 4.4 The returned day (spec §8.10)

The comet sits beside the planet at the right edge (§3.1) with its long tail pointing up, away from the planet and clear of the satellite. The warm halo around the satellite is 2.1 and 2.9 × the body's half-edge on screen (smaller than before, so it does not swamp the wings). The meteors are unchanged.

### 4.5 Trail geometry (spec §9.1)

- The trail's near end now starts just above-left of the far wing, and the curve rises and recedes into the upper left: −z and up, with the far end at z ≈ −70 as before. Its screen position follows §3.1.
- The 6–8 seeded control points, the ribbon, the colours and the memory spacing are unchanged.
- `rewinding` still joins the trail at the newest memory.

---

## 5. Timing constants (spec §22)

| Constant | Revision 5 | Revision 6 | Where |
|---|---|---|---|
| `DEPLOY_MS` | 3200 | **3600** | MessageCube + CameraRig |
| `BOOM_L` / `PANEL_W` / `N_PANELS` | – | **0.5 / 1.1 / 3** (cube units) | satelliteGeometry |
| `WING_FOLD_MAX` | – | **84°** | satelliteGeometry |
| `WING_STAGGER_MS` | – | **120** (near wing +80 ms) | SolarWings |
| `ORBIT_PERIOD_S` | 48, the hub | 48, **the chart's satellite glint only** | ChartOverlay / chart scene |
| station keeping | – | **30 s, ±1.5%, ±1.2°** | CameraRig (hub) |
| sky turn | – | **0.6° per 10 s**, hub only | SpaceEnvironment |
| departure / launch camera turn | ≤ 8° | **≤ 4°** | CameraRig |
| hub comet tail minimum | – | **24px portrait / 36px landscape** | Comet |
| dotted segment ahead | – | **6% of the orbit parameter** | Comet |
| hint line top | 96px | **72px** | OrbitOverlay |

---

## 6. Mock keyframes (spec §23.6)

| Mock keyframe | Implement as |
|---|---|
| `kStation` (M5, M8, M9b, M12a, M14) | the satellite's station-keeping drift in the hub (§3.2); replaces `kOrbit` in the hub |
| `kGlint` on six panels | the glint sweep across both wings (§2.3) |
| `kDraw` on the short dotted segment (M5, M14b) | the dotted segment ahead of the comet; in the app it is static apart from the comet's own motion |
| `kOrbit` | no longer used in the hub |

---

## 7. Verify (spec §17): replace and add

**Remove:** "The full satellite ellipse and the planet's visible arc fit the orbit frame with ≥ 8% margin" and "A comet at perihelion, with its full tail, stays inside the orbit frame".

**Add, in `satelliteGeometry`:**

- `wingChain` is continuous in `boom` and `unfold`: adjacent samples 0.01 apart move no hinge point by more than 0.1 units.
- At `unfold = 1` all panels are coplanar and in line, and the span is 9.6.
- At `boom = 0` no wing geometry lies outside the cube.
- Sampled every 0.01 of deploy t, no panel intersects the body or another panel.
- The deploy t → `(boom, unfold)` mapping follows §2.2, including the stagger.

**Add, in `hubPose` framing** (390×844, 430×932, 1280×800 and 1512×945):

- The satellite's projected hull is inside the frame with ≥ 4% margin.
- The body centre is within ±0.04 of the §3.1 target.
- The wing axis is −50° ± 6°.
- Tip to tip is within the §3.1 range.
- The planet's visible area is 8–15%, and its limb meets the bottom and right edges within ±0.05 of the targets.
- Every trail control point projects into the top-left quadrant, below 88px (portrait).
- The comet for f = 0.06, 0.25, 0.5, 0.75, 0.94 projects into the top-right quadrant, ≥ 24px from the satellite's hull.
- The returned comet and its tail do not intersect the satellite's hull.
- The departure and launch paths stay inside the frame, allowing for the ≤ 4° camera turn.

**Keep:** "`DEPLOY_MS` camera duration ≤ cube deploy duration" (now 3600), and every state-machine check.

---

## 8. Files (spec §16)

```text
lib/
  satelliteGeometry.ts    NEW     wingChain(), deploy t → (boom, unfold), projected hull for framing
components/three/
  SolarWings.tsx          NEW     booms, two accordion wings (3 panels each), panel shader, glint (replaces CubeSatPanels.tsx)
  CubeSatPanels.tsx       REMOVE  (if built: see §11 step 2)
  MessageCube.tsx         EXTEND  mount SolarWings from deploying t = 0.15; mast + nav light
  framing.ts              EXTEND  hubPose(aspect) replaces orbitPose(); targets from §3.1
  CameraRig.tsx           EXTEND  hub pose, station keeping; departure / launch turn ≤ 4°
  OrbitRing.tsx           CHANGE  used by the chart only
  Comet.tsx               EXTEND  dotted segment ahead in the hub, minimum on-screen tail
  CometDeparture.tsx      CHANGE  path of §4.2
  RocketLaunch.tsx        CHANGE  path of §4.3
  SpaceEnvironment.tsx    EXTEND  sky turn uniform (hub only)
  Trail.tsx               CHANGE  control points per §4.5
components/card/
  OrbitOverlay.tsx        CHANGE  hint at 72px
```

Docs: update `docs/orbit.md` (composition, the satellite's form, why the camera co-moves) and `docs/verification.md`.

---

## 9. Acceptance (spec §18): replace and add

- [ ] Deployment: the cube turns, two booms push folded wings out of opposite faces, and each wing unfolds panel by panel with a click and a glint, like a real satellite. There are no wings while reading, and the reverse returns to an identical closing screen.
- [ ] The hub matches §3.1 on a phone and on desktop: the planet small in the bottom-right, the satellite large and centred on its diagonal, the trail at the top-left, the comet at the top-right with its dotted segment ahead.
- [ ] In the hub the satellite holds its place with a slow drift, and the sky turns slowly. No orbit ring is drawn. With reduced motion everything is still.
- [ ] The departure, the rocket and the returned comet follow the right-hand side and never cross the satellite. The reply star sits just beyond the comet.
- [ ] Over two minutes the key light sweeps a glint across the six panels.
- [ ] 30+ FPS in the hub on a recent iPhone. The satellite now fills more of the screen, but the draw calls are 6 panel quads + 2 booms + a mast (instanced where possible).

---

## 10. Mockups (spec Part C): changed frames

| ID | Artboard file | What changed |
|---|---|---|
| M4a | `M4a-Deploy-turn.dc.html` | the cube turns; two booms push the folded wings out of the side faces |
| M4b | `M4b-Deploy-unfold.dc.html` | the wings unfold panel by panel; the planet rises in the bottom-right |
| M4c | `M4c-Deploy-rise.dc.html` | fully deployed, thruster pulse, settling into the hub |
| M5a | `M5a-Orbit-mobile.dc.html` | **the new hub** (the sketch): planet bottom-right, satellite centre, trail top-left, comet top-right |
| M5b | `M5b-Orbit-desktop.dc.html` | the same on desktop; hovering the satellite: `手紙を読みかえす` |
| M8a, M8d | reply panel and error | over the new hub |
| M8b | `M8b-Reply-launching.dc.html` | launch up the right-hand side, overtaking the comet |
| M8c | `M8c-Reply-star.dc.html` | the star just beyond the comet |
| M9b | `M9b-Returned-hub.dc.html` | the returned comet beside the planet at the right edge; smaller warm halo |
| M12a | `M12a-Comet-departs.dc.html` | the departure up the right-hand side, past the near wing |
| M14a, M14b | crossroads, words aboard | over the new hub; warm dotted segment when the words are aboard |

All other frames are unchanged: M0–M3, M7, M9a, M10–M13, M14c, the emails and the editor. The rev-6 frames are on the 8-point grid (checked: 0 values off-grid across 44 files).

---

## 11. Migration steps (only if phases 5, 6, 8 or 13 were already built)

1. **Geometry first.** Add `lib/satelliteGeometry.ts` with its verify checks (§7). No visual change yet.
2. **Wings.** Add `SolarWings.tsx` and wire it into `MessageCube` with the §2.2 timeline. Delete `CubeSatPanels.tsx` in the same commit. Set `DEPLOY_MS = 3600`. Update the `deploy` sound cue.
3. **Camera.** Replace `orbitPose()` with `hubPose()`. Remove the satellite's on-screen orbit motion and the hub ring. Add station keeping and the sky turn. Swap in the framing checks.
4. **Scene.** Re-route the trail control points, the comet orbit orientation (with the ±6° seed limit), the dotted segment ahead and the minimum tail.
5. **Paths.** Update the departure, the launch and the returned-day comet position, and move the hint to 72px.
6. **Docs.** Update `docs/orbit.md` and `docs/verification.md`, and check the acceptance items in §9 on a phone and on desktop.
