# KARTA_SPACE v0.2, revision 7.1: 夜明け (Dawn), with company in orbit

**Type:** a changes-only document. It lists only what differs from the documents it builds on.
**Applies on top of:** `docs/spec-v0.2.md` (revision 5) and `docs/spec-v0.2-r6-orbit.md` (revision 6). Where this document disagrees with them, **this document wins**. Everything not mentioned here is unchanged.
**Replaces:** revision 7.0 of this file, in full. Same path: `docs/spec-v0.2-r7-dawn.md`.
**Mockup:** `KARTA_SPACE_orbit_dawn_v7.1_mockup.html`, a live, interactive scene. Open it in a browser. It has these controls:
- view: desktop or phone;
- state: 今日, 返事を送った, 言葉をのせた, 再会の日;
- the days-until-reunion slider;
- the moments: 到着 · arrival (Propel), 返事を打ち上げる (launch bloom), 言葉をのせる (boarding);
- **orbiting things:** a toggle per set, *Shuffle (new card)*, and *Real speed* / *Preview ×6*;
- layers: the Milky Way, the Tanabata stars, annotations, a before/after against the current build, and pause.

The numbers in this document win over the mockup.

> **Changes since 7.0**
> - **Kept exactly as built: the contrail.** Its geometry, place, colour, width, head and glints all stay as they are now. R24 ("the trail is the wake") is **withdrawn**. So are 7.0 §7 and the step-0 items about the trail's colour and its distance from the satellite.
> - **Kept exactly as built: the satellite's place and small movement.** R23 ("heading into the light") is **withdrawn**: there is no move to the left, no lead room and no world sliding past. The satellite keeps its build position, its gentle drift and its slow roll. Only the light on it changes.
> - **Principle 15** ("ahead is to the right") is dropped.
> - **Propel** (R28) is smaller: a 6 px nudge on desktop and 4 px on phone (was 16 / 10). There are no star streaks and no wake brightening.
> - **The comet's aphelion** on desktop moves to (0.76, 0.07) (was 0.66, 0.08), so the comet's path clears the satellite's upper wing at its build position.
> - **New, R30: company in orbit.** Small things now orbit あなたの星: tiny satellites, a station, rocks, a far moonlet, a paper crane and paper planes. See §8.
> - **If you already landed 7.0 steps 4 or 5:** revert the satellite's position, the world parallax and the wake (its geometry and streaming particles) to the pre-r7 build first (§14, step 0).

**Goal.** The current orbit scene reads as solitude: one dark object, holding still in a cold, empty sky, after something has ended. The scene should instead feel optimistic, exciting and mesmerising. It should make both people look forward to meeting again. Revision 7.1 gets there with **light** (the dawn) and **company** (things in orbit), not by moving what already works.

**Kept exactly as built:**
- the **satellite**: its design (the body, edges and faces, the two gridded wings, the booms and the mast), its **place** on screen and its **small movement**;
- the **contrail**;
- the state machine, the comet moment and its sheets, the crossroads, the server, the emails and the editor.

Only the *light that falls on* the satellite and the contrail changes.

---

## 0. Summary

| # | Change | Overrides |
|---|---|---|
| **R22** | **Dawn is the countdown.** The sun is always rising over あなたの星. Its height, warmth and the light on everything follow the comet's progress towards the reunion: blue hour with a gold horizon far from the day, a full sunrise on the day. It is never full night. | spec §23.3 (key light), §23.4 (planet); new `lib/dawn.ts` |
| ~~R23~~ | *Withdrawn in 7.1.* The satellite stays where it is built, with its small movement. | – |
| ~~R24~~ | *Withdrawn in 7.1.* The contrail stays exactly as built. | – |
| **R25** | **Home is alive.** The planet shows its night side: warm city lights, a soft aurora, an atmosphere that turns gold where the sun comes up, and a sunlit crescent that widens with the dawn. | spec §23.4 |
| **R26** | **Still connected.** Faint signal pulses travel from the satellite's mast to the planet's lights and to the comet. | new |
| **R27** | **The promise is on screen.** The promise and the rough return sit in the top-right corner of the orbit view. The comet keeps its tail, pointing away from the actual sun, and grows as the day nears. | spec §8.9, r6 §4.1 |
| **R28** | **Joyful, not loud.** A short, small "propel" beat on arriving in orbit, and a small firework bloom when the reply overtakes the comet. Finished things look warm and done instead of greyed out. The sound moves from a hollow drone to a bright, open chord. | spec §2 principle 6, §10.3, §12.2, §21 |
| **R29** | **A sky worth looking at.** A band of the Milky Way crosses the upper left. Optionally, Vega and Altair (the Tanabata stars) sit on either side of it. | spec §23.2 |
| **R30** | **Company in orbit.** Small things orbit あなたの星 on slow, real orbits: tiny satellites blinking, a station catching the sun, tumbling rocks, a far moonlet, a paper crane and paper planes. Each swings out into the sky, slows and turns, then falls back past the planet, in front of it on one side and behind it on the other. Every card gets its own set, seeded from its slug. | new: `lib/orbiters.ts`, `Orbiters.tsx` |

---

## 1. Working with Claude Code

1. Commit this file as `docs/spec-v0.2-r7-dawn.md`, replacing 7.0. Put the mockup in `docs/specs/mockups/orbit-dawn.html`, replacing the 7.0 mockup, so later sessions can open it. Link both from `docs/README.md` with one line: "Revision 7.1 (dawn) changes the orbit scene's light, adds things in orbit, and keeps the satellite and the contrail as built; see the table in §0."
2. The scene is already built, so this lands as a **migration**. Run §14's steps one per session, in order. Each step keeps `npm run verify` and `npm run typecheck` green and is visible on its own.
3. Session prompt: "Read `docs/spec-v0.2.md` §0, `docs/spec-v0.2-r6-orbit.md` and `docs/spec-v0.2-r7-dawn.md` (which wins). Open `docs/specs/mockups/orbit-dawn.html` for the look. Do step N of §14 in r7. Add the verify checks it names. Do not change the satellite's geometry, materials, position or movement. Do not change the contrail."
4. When something in the build does not match the earlier documents, fix it in step 0 before adding anything new (§14). The two kept items are the exception: for the contrail and the satellite, **the build is the reference**, even where it differs from r5 or r6.

---

## 2. Principles (spec §2): amended

| # | Was | Now |
|---|---|---|
| 6 | **Loud is wrong.** No explosions, confetti or "blast off". | **Joyful, not loud.** Still no shaking, explosions or confetti. Small, elegant moments of joy are welcome: a light bloom, a sparkle, a rising chord. |
| 11 | **Warm light means "from the receiver" or "opened".** Everything else stays ion-blue. | Two kinds of warm. **Warm marks** (a glow, ring, strand or button state that belongs to an object) still mean "from the receiver" or "opened". **Warm light** (sunlight, the sunrise, sunlight on a paper crane) is for everyone and may warm the whole scene. The tiny red and green navigation blinks on orbiting craft (§8) are neither; they stay 1.1 px or smaller and never glow. |
| 12 | Alive, not busy. | Alive, not busy, **and never night**: there is always a sunrise on the horizon. Things in orbit drift and turn; nothing darts (§8.7). |

*(7.0's principle 15, "ahead is to the right", is dropped.)*

---

## 3. Dawn: the model (`lib/dawn.ts`, pure, new)

```ts
export type Dawn = { p: number; sunElevation: number; warmth: number };

/** f: the comet's progress in its current cycle (spec §11.2). status: the comet status (spec §14.1). */
export function dawn(f: number, status: "away" | "returned" | "kept"): Dawn;
//   p = status === "returned" ? 1
//     : status === "kept"     ? 0.7
//     : clamp(0.2 + 0.8 · f^2.2, 0.2, 1)
//   sunElevation = R · (−0.04 + 0.085 · p)   // portrait: R · (−0.035 + 0.075 · p)
//   warmth = p
```

| Days left (97-day sample) | 97 | 73 | 49 | 24 | 10 | 0 (the day) |
|---|---|---|---|---|---|---|
| f | 0 | 0.25 | 0.5 | 0.75 | 0.9 | 1 |
| p | 0.20 | 0.24 | 0.37 | 0.62 | 0.83 | 1.00 |
| What you see | blue hour, a gold line on the horizon, the sun's glow behind the limb | the same, a touch brighter | the gold widens | **the sun's disc clears the horizon (p ≈ 0.47)** | a full sunrise, long rays | the sun fully up, the whole scene warm |

- **Never night:** p ≥ 0.2 from the first visit. Like the comet's Kepler motion, most of the change comes near the end, so each visit late in the wait is visibly brighter.
- **Reduced motion:** p is still computed (it is a date, not motion); only the ambient movement stops.
- **Where it applies:**
  - the orbit view and every state shown in it: `orbit`, `departing`, `launching`, the crossroads, the returned hub;
  - the chart and the close-up take the sky colours and the warm haze, but no sun flare;
  - landing, reading and the closing screen are unchanged;
  - *(Should)* the sender's comet page (`/comet/[token]`) uses the same `dawn(f)` from the token's dates.

---

## 4. Composition (r6 §3.1, with two changes)

Fractions of the viewport (x from the left, y from the top). Desktop numbers hold from 16:9 to the current ~1.83:1 build.

| | Desktop | Portrait (390 × 844) |
|---|---|---|
| **Planet** | unchanged from r6: centre off-screen about (1.06, 1.45), radius ≈ 0.495 × width; the limb meets the right edge at y ≈ 0.55 and the bottom edge at x ≈ 0.63 | unchanged from r6: centre about (1.21, 1.22), radius ≈ 1.07 × width |
| **Sun** | behind the limb where x = 0.915, raised along the planet's radius by `sunElevation` (§3) | where x = 0.90 |
| **Satellite** | **as built.** `hubPose` does not change. The mockup measured the build at about body centre (0.475, 0.54) with a cube half-edge of 0.045 × width. | **as built** (mockup: about (0.45, 0.52), half-edge 0.085 × width) |
| **Contrail** | **as built.** In the build it is a thin pale-blue curve in the upper left, from about (0.30, 0.15) curving right and down to its bright head near (0.33, 0.40). Nothing about it changes. | **as built** |
| **Comet orbit, as seen** | perihelion (the meeting point) 26 px above the limb where x = 0.80; **aphelion projected at (0.76, 0.07)** (7.0: 0.66, 0.08); lateral squash 0.6 | perihelion 20 px above the limb where x = 0.74; aphelion at (0.88, 0.05); squash 0.22 |
| **Milky Way band** | centre line (0.60, −0.08) → (−0.05, 0.72), core width 0.11 × max(w, h). It runs behind the contrail. | (1.05, −0.06) → (−0.20, 0.50), width 0.12 |
| **Promise caption** | top-right, right edge 24 px from the side, top 80 px | right 16 px, top 72 px |
| **Tanabata stars (optional)** | Vega (0.44, 0.12), Altair (0.10, 0.42) | Vega (0.62, 0.10), Altair (0.12, 0.36) |
| **Orbiting things** | apoapses inside x 0.05–0.90, y 0.08–0.70, not under the caption (x > 0.66 and y < 0.25) and not on the satellite (§8.3) | x 0.06–0.94, y 0.08–0.62; not under the caption (x > 0.50 and y < 0.20) |

**What moves:**

- **The satellite**, as built. It keeps its small movement. The mockup reproduces it as a drift of ±3 px over 30 s and ±2 px over 23 s, plus a roll of ±0.8° over 40 s about the body's centre. If the build's own numbers differ, **the build wins**. There is no station-keeping change and no world sliding past.
- **The sky** stays as built. The far stars and the twinkling layer stay in place (7.0's parallax is withdrawn). The nebula may sway by ±0.8% over periods of 60 s and 71 s, inside the §23.5 calm limit. Dust motes keep the build's behaviour; the mockup drifts each one slowly along its own direction at 2–6 px/s.
- **The ground** turns as spec §23.4 says (1 turn / 20 min).
- **Things in orbit** move as §8 says.
- **Reduced motion:** a still frame at the current dawn, with the orbiting things frozen at their start positions.

---

## 5. Light (spec §23.3): the key light comes from the sun

`keyLight` now takes the dawn:

```ts
export function keyLight(t: number, seed: number, d: Dawn): KeyLight;
// dir       = from the satellite towards the sun's world position (the sun sits just beyond the
//             planet's limb, to the right of the satellite), plus the existing small wobble (±3°, 37 s)
// color     = mix(#9fb8ff /* blue hour */, #ffe2b8 /* golden */, d.p)
// intensity = mix(0.6, 1.2, d.p) · (1 + 0.04·sin(2πt/23))
// fill      = a cool fill from the opposite side, 0.25, so the shadow side never goes black
```

**On the satellite**, with no change to its materials:

- the faces turned towards the sun take a warm tint, at most 10% (`0.10 · lit · p`);
- the edges on that side pick up a warm rim, at most 55% (`0.55 · lit · p`);
- the panel glint keeps sweeping the six panels (r6 §2.3), now warm-white, at most `0.06 + 0.14 · p`. It must never wash a panel out.

This should fall out of the coloured key light plus the existing specular. Do not edit the satellite's materials to get it.

**On the orbiting things:** the same key light and fill light them (§8.6).

**The returned day:** the r5 "warm 10%" rule is replaced by p = 1.

---

## 6. The planet, alive (spec §23.4): changes

The planet shows its **night side** facing the camera, with the sun just behind the limb.

| Part | Spec |
|---|---|
| Disc | night radial: `#04070e` (inside) → `#08111f` → `#0d1a30` at the limb |
| Sunlit crescent | a radial wash from the sun, clipped to the disc: `rgba(255,214,160, 0.35 + 0.4p)` → `rgba(90,150,210, 0.05 + 0.22p)` at 30% → 0, radius R · (0.18 + 0.5p). It widens as the day nears. |
| Atmosphere limb | a conic gradient centred on the sun's angle: `#fff0d7` at the sun, `#ffd696` / `#ffc88c` within ±0.35·s, cyan `#6ed2ff` at ±1.3·s, blue `#3264dc` at ±3.2·s, fading out beyond, where s = 0.05 + 0.06p turns. Drawn three times: a haze (width 0.03R, blur 10 px), a glow (width 0.008R, blur 2 px), and a 1.2 px line. |
| City lights | **prominent now:** about 46 clusters of 4–18 lights in the outer 18% of the visible disc. Warm `#ffd696` cores with a `#ffc478` glow. Each flickers by ±35%. They fade out where it is already day (within (0.12 + 0.25p)·R of the sun). They ride the surface rotation. |
| Aurora | new: about 120 thin radial strands along the limb, from the bottom-edge end to 62% of the way towards the sun. Height 0.03–0.065R above the limb, `#5cffb5` → `#78c8ff` → `#aa78ff` fading. Alpha ≤ 0.10, weaker as p rises (× (1 − 0.5p)). Slow shimmer (phase speed 0.35 rad/s). |
| The sun | a sprite behind the planet: a core glow 0.08R (cream-white) and a halo 0.26R (gold), occluded by the disc until it rises. **Flare** in front: 8 rays of length R · (0.22 + 0.4p) · (0.6 + 0.4·vis), a thin horizontal streak, and two faint ghosts on the line towards the frame centre. Intensity (0.25 + 0.75·vis) · (0.55 + 0.45p), with vis = smoothstep(−0.02, 0.06, sunElevation / R). |
| Sky | base gradient: top `#060914` → `#0b1024`, bottom `#081428` → `#13203a`, mixed by p. Warm haze around the sun (screen blend): alpha 0.10 + 0.32p, `#ffd6a0` → `#d6826e` (×0.35) → `#785aaa` (×0.12) → 0, radius (0.55 + 0.35p) × max(w, h). A final light wash: alpha 0.05 + 0.16p, radius 1.1 × max(w, h). |

---

## 7. The contrail: kept as built

- **Do not change** `Trail.tsx`: not its geometry, place, colour, width taper, head or memory glints, and not its interactions (`rewinding` and the memory taps).
- The only things that reach it are scene-wide: the warm haze and the light wash (§6, Sky) sit over the whole frame.
- Orbiting things start clear of it (§8.3). Later they may pass across it, in front of it, the same way they pass in front of the stars.
- 7.0 §7 (the wake) and 7.0 step 0's trail items are withdrawn.

---

## 8. Orbiting things (new: `lib/orbiters.ts`, `components/three/Orbiters.tsx`)

### 8.1 What, and how many

| Type | Set | Desktop | Phone | Apoapsis distance (planet radii) | Starts in view |
|---|---|---|---|---|---|
| `cubesat` (tiny satellite) | craft | 6 | 5 | 1.30–2.00 | yes |
| `station` | craft | 1 | 1 | 1.40–1.80 | yes |
| `rock` (rock and ice) | rocks | 18 | 12 | 1.25–2.70 | no (uniform phase) |
| `moonlet` | moon | 1 | 1 | 1.95–2.50 | yes |
| `crane` (paper crane) | paper | 1 | 1 | 1.45–2.30 | yes |
| `plane` (paper plane) | paper | 2 | 1 | 1.35–2.40 | yes |
| **Total** | | **29** | **21** | | |

Keep the mix as a config object (`ORB_MIX`) in `lib/orbiters.ts`. Every set is on in the product. The mockup's toggles are for review only. The paper set is the playful one; it can be switched off in config without touching anything else.

### 8.2 The orbits

The camera sits close to each orbital plane, so every orbit is seen as a long, thin ellipse with the planet's centre at one focus. The orbits are real Kepler orbits in 3D; nothing is faked.

```ts
// lib/orbiters.ts (pure: no three.js, no DOM)
export const ORB_BASE_S = 330;  // the period of an orbit with a semi-major axis of 1 planet radius
export const PERI_MIN = 1.06;   // the periapsis never dips below the atmosphere (planet radii)

export type Orbiter = {
  type: "cubesat" | "station" | "rock" | "moonlet" | "crane" | "plane";
  set: "craft" | "rocks" | "moon" | "paper";
  apo: number;     // apoapsis distance from the planet centre, in planet radii
  e: number;       // eccentricity
  a: number;       // semi-major axis = apo / (1 + e)
  beta: number;    // direction of the apoapsis in the screen plane, radians (screen y down)
  thin: number;    // 0.06–0.40: how open the ellipse looks (the plane's tilt off the line of sight)
  ph: number;      // mean anomaly at t = 0
  dir: 1 | -1;     // which way round
  size: number;    // 0.85–1.20
  rs: number;      // rock size, 0–1
  spin: number;    // −0.25…0.25 rad/s
  sp: number;      // a phase for blinks, glints and spin
  shape: number[]; // 7 radial factors 0.65–1.15 (rocks)
};

export const period = (o: Orbiter) => ORB_BASE_S * o.a ** 1.5; // seconds

/** Planet-local position, planet radius = 1. X right, Y down (as on screen), Z towards the camera. */
export function orbiterPos(o: Orbiter, t: number): [number, number, number] {
  const M = o.ph + o.dir * 2 * Math.PI * t / period(o);
  let E = M;
  for (let i = 0; i < 6; i++) E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E)); // Kepler
  const u = o.a * (o.e - Math.cos(E));                     // along the apoapsis direction (+apo at E = π)
  const w = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);  // across, in the orbital plane
  const bx = Math.cos(o.beta), by = Math.sin(o.beta), nx = -by, ny = bx;
  return [bx * u + nx * w * o.thin, by * u + ny * w * o.thin, w * Math.sqrt(1 - o.thin * o.thin)];
}
```

- **Eccentricity:** `e = eMax · U(0.6, 1)`, where `eMax = (apo − PERI_MIN) / (apo + PERI_MIN)`. The periapsis is therefore always ≥ 1.06: nothing passes through the planet. Because the orbits are eccentric, each object is slowest at its apoapsis, out in the sky we see, and quickest past the planet.
- **Period:** `T = 330 · a^1.5` s, which comes to about 7–14 minutes. On screen that means a median of about 5 px/s and at most about 11 px/s on a 1440-wide desktop; about 3 px/s, at most 6 px/s, on a 390-wide phone.
- **Clock:** `t` is the seconds since the orbit view first opened in this visit. It keeps running while sheets are open and while the camera is away (§8.7), so nothing jumps. The mockup's ×6 preview multiplies the clock's *rate*, never `t` itself.
- **Seed:** use the build's existing per-card seed from the slug, or the FNV-1a hash of the slug if there is none. Any seeded 32-bit PRNG works; the mockup uses an LCG (`s = s·1664525 + 1013904223`) seeded with `seed·7919 + 13`. The same card always shows the same set; different cards show different ones.

### 8.3 Placement (`makeOrbiters(seed, frame)`)

`frame` describes the hub view in screen pixels:
- the viewport `w × h` and `phone`;
- the planet's screen disc (centre and radius);
- the satellite's span (the line through both wing tips) and its half-edge `kSat`;
- the contrail's polyline;
- the caption box.

`framing.ts` exports it from `hubPose`.

For each orbiter, in `ORB_MIX` order:

1. **Pick the apoapsis on screen.** Try up to 80 random points in the placement box (§4). Accept the first one that meets all of these:
   - its distance from the planet's centre, in radii, is inside the type's range (§8.1);
   - it is not under the caption box;
   - it is farther than `1.6 · kSat` from the satellite's span.

   If no point is found, skip the object; at most one may be missing.
2. Set `apo` to that distance, `beta` to its angle, then draw `e`, `thin`, `ph`, `dir`, `size`, `rs`, `spin`, `sp` and `shape` from the PRNG.
3. **Types that start in view** (all but rocks) re-roll `ph`, up to 60 times, until at `t = 0` the object meets all of these:
   - it is visible (step 4's rule);
   - it is farther than `1.6 · kSat` from the satellite's span;
   - it is at least 6% of the width from the contrail.

   Rocks keep a uniform phase, so the sky looks the same at minute 10 as at second 1.
4. **Visible**, for placement and for verify: inside x 3–97% and y 4–82% (above the bottom bar), and not (Z < 0 and inside the planet's disc).

### 8.4 From the plane to the scene

Each orbiter is placed on screen, then given a depth for ordering. This keeps the look independent of how far the build's camera is from the planet.

- **Screen position:** `planetScreenCentre + (X, Y) · planetScreenRadius`. Turn it into a world position on the hub camera's ray through that pixel. Use the **hub pose** camera, not the live camera, so that camera moves (the Propel zoom) carry the orbiting things with the rest of the world.
- **Depth along that ray, by layer.** Because the point stays on its ray, the depth changes only what covers what:

| Layer | Condition | Depth | Effect |
|---|---|---|---|
| far leg | Z < 0 | the planet centre's depth | the planet's own depth hides it wherever it is over the disc |
| near leg | 0 ≤ Z < 0.6 · apo | just in front of the planet's nearest point | in front of the planet, behind the satellite |
| nearest | Z ≥ 0.6 · apo | just in front of the satellite | passes in front of the satellite |

- **Size:** from the on-screen targets in §8.5, converted to world units at that depth: `worldPerPx = 2 · depth · tan(fov / 2) / viewportHeightPx`. Multiply by `(1 + 0.35 · Z / apo)` so the near leg reads larger and the far leg smaller.

### 8.5 The look

**Scale.** All sizes are in screen pixels times `k`:
- desktop: `k = 1.3 · clamp(w / 1000, 0.9, 1.45) · size · (1 + 0.35 · Z / apo)`;
- phone: `k = 1.15 · size · (1 + 0.35 · Z / apo)`.

At 1440 wide, a cubesat's body is about 11 px and its full span about 36 px; at 390 wide, about 7 px and 22 px. The satellite stays by far the largest thing on screen.

| Type | Shape | Colours | Motion and lights |
|---|---|---|---|
| **cubesat** | a 6k body square; two 5.5k × 3.2k panels on 1.2k booms; a centre line on each panel | body `#1e2332`, edges `#dce4f0`; panels `#263e68` with a `#00aeef` line at 45%; edges `#afc4d8` | tumbles at `spin` rad/s in the screen plane. **Nav light** r 1.1 px at a body corner: on for 0.22 s every 2.2 s, red `#ff6e6e` or green `#6effaa` (by `sp`), otherwise `#78829a` at 40%. **Glint** when a panel faces the sun: `pow(max(0, sin(2·angle − sunAngle)), 40) · (0.4 + 0.6p)` |
| **station** | a 30k truss; 8 panels 2.4k × 8.8k, above and below, at x = ±8k and ±13k; modules 9k × 3.2k and 2.4k × 8k; a 3k × 1.4k radiator | truss `#cdd6e6`; panels `#1b2740`, edges `#9fb4c9`; modules `#d9dee6`; radiator white at 80% | tilted −0.35 rad, swaying ±0.06 rad (0.03 rad/s). **Glint** `pow(max(0, sin(0.21t + sp)), 60) · (0.5 + 0.5p)`, about once every 30 s. A red blink at the truss end: 0.2 s every 3 s |
| **rock** | a 7-point polygon (radii from `shape`), squashed to 0.8 tall, radius `(2.2 + 2.8 · rs²)·k`; in 3D an icosahedron with jittered vertices | lit side `#f0e4ce` → `#84828c` → shadow `#2c2f3a`, oriented towards the sun | tumbles at 0.6 × `spin`. **Ice glint** `pow(max(0, sin(0.9t + 3sp)), 80) · 0.7` |
| **moonlet** | a 7k-radius sphere with three soft craters | `#f0eade` → `#969496` → `#242630`, lit from the sun | none |
| **crane** | paper triangles (below), scale 1.3k | paper `#ece8e0`, warming towards `#ffe2ba` by 0.6p (sunlight on paper); fold `#beb8b0` | faces along its screen velocity, flipped so it stays upright when flying left, bobbing ±0.12 rad (0.5 rad/s). A warm glow 10 · 1.3k at 0.12p |
| **plane** | a paper dart (below), scale 1.1k | `#f3f1ec`, right half `#cdcbc6`, keel line `#aaaab0` | faces along its screen velocity |

**Halo.** Every craft and rock gets a faint halo so it reads against the sky: radius 9k for a cubesat, 22k for the station and 2.6 × the radius for a rock, in pale blue-white at 7%. In 3D this is one additive sprite per object.

**Paper shapes,** in units of the scale above (x forward, y down):

```text
crane  body  (−2,0) (3,−1.6) (7,0) (3,1.4)
       wing  (0,−0.4) (2.5,−8) (6,−0.6)          fold (1.5,−0.4) (4.5,−6.5) (6,−0.6)
       neck  (6,0) (10,−6) (11,−6.2) (7.5,−0.2)  head (10,−6) (12.2,−5.4) (11,−6.2)
       tail  (−2,0) (−6.5,−5) (−5.5,−5.4) (0,−0.6)
plane  dart  (7,0) (−5,−3.6) (−3,0) (−5,3.6)     right half (7,0) (−5,3.6) (−3.6,0)
```

**Screen velocity** is the direction from `orbiterPos(o, t)` to `orbiterPos(o, t + 1.5)`.

### 8.6 Light and depth

- **Lit by the scene:** the key light and fill from §5 light the craft, rocks and moonlet, so the sunward side is bright and warms with the dawn. Use `MeshStandardMaterial`, with no new light rig.
- **Overall level:** `0.72 + 0.28p`. The far leg (Z < 0) sits a little deeper in the haze, at × 0.85.
- **The disc hides the far leg** (§8.4). Nothing is ever drawn over the planet unless it is on the near leg.

### 8.7 When, and how

- **Shown in** the orbit view and everything shown in it: `orbit`, the crossroads, `departing`, `launching`, `boarding` and the returned hub. They keep moving behind sheets and their scrim.
- **Faded out** (400 ms) when the camera leaves the hub: the comet chart and close-up, and the trail's walk or `rewinding`. **Faded back in** (600 ms) on return. The clock keeps running throughout.
- **Not shown** in landing, reading or the closing screen.
- **Calm:** the median on-screen speed is about 5 px/s and the most is 12 px/s at 1440 wide. Spins stay ≤ 0.25 rad/s. There are no trails, streaks or sounds.
- **No interaction:** orbiting things are not raycast targets (`raycast = () => null`). They never block a tap on the satellite, the comet, the contrail or the reply star.
- **Reduced motion:** positions are frozen at `t = 0`, where every craft is in view. There is no spin, sway or bob, the nav lights stay steady and dim, and there are no glints.

### 8.8 Performance

- At most 29 objects: one `InstancedMesh` per type, plus one instanced sprite batch for the halos, glints and nav lights. That is ≤ 8 draw calls.
- The Kepler solve is 6 Newton steps per object per frame.
- No shadows and no post-processing.
- Budget: under 0.3 ms a frame on a recent iPhone.

---

## 9. Signal pulses (new: `components/three/SignalPulses.tsx`)

- **Origin and targets:** from the mast light. Two targets alternate, half a period apart: the planet's lights near the sunrise, and the comet.
- **Shape:** each pulse is two thin arcs, ±0.22 rad wide and 6% apart. They expand to 90% of the distance over the first 75% of `PULSE_PERIOD = 4.8 s`, with alpha 0.32 · sin(πp).
- **Colour:** `#bdf0ff`. Once a reply is sent or words are on the comet, every other pulse towards the comet is warm `#f3d7a4` (a warm mark, §2).
- **When:** only in `orbit` and the crossroads. Not during the chart, the trail or any sheet. Off with reduced motion.

---

## 10. The comet and the promise (spec §8.9, r6 §4.1)

- **Path:** the aphelion as seen moves to (0.76, 0.07) on desktop (§4), so the comet and its tail stay clear of the satellite's upper wing at its build position.
- **Tail:**
  - It points away from the **sun's actual position** (it used to point away from the planet).
  - Length on screen is `(40 + 180 · near²) px` on desktop and × 0.75 in portrait, where `near = 1 − (r − 4.2) / 52`.
  - The dust tail widens to 0.2 × its length and bends sideways by up to 0.32 × its length. The ion tail is straight and 1.1 × as long. The warm strand is unchanged.
  - *If the build shows no tail, fix that in step 0.*
- **The dotted path ahead** (r6) is longer: the next 14% of the orbit parameter (was 6%), fading to nothing. It turns warm once words are on the comet.
- **The promise caption** (new, `OrbitOverlay`), top-right as in §4. It is right-aligned and has three lines:
  1. `comet.promise`: 14px/24px, weight 500, `--starlight`;
  2. `{returnLabel} · {returnRelative}`, e.g. `次の冬 · 約3か月後`: 12px/20px, `--lunar`;
  3. only with words aboard: `あなたの言葉も、のっています`: 12px/20px, warm `#f3e6cf`.

  On the day, lines 1–2 read `約束の彗星が、戻ってきました。` (warm) / `この冬 · 今日`. This **replaces the words-aboard chip** (r5 §8.9).
- **The reply star** sits 46 px (desktop) / 34 px (portrait) beyond the comet, towards its aphelion, so it reads as "arrived first".

---

## 11. Joyful moments (spec §10.3, new arrival beat)

None of these adds a reducer state. They are visual flourishes owned by the components named.

| Moment | When | What happens | Owner |
|---|---|---|---|
| **Propel** | `orbit` is reached from `deploying` or `homing`, and the first time the hub opens per visit | over `PROPEL_MS = 2400`: the camera eases from 1.06× to 1× (ease-out). The satellite nudges **6 px (desktop) / 4 px (portrait)** towards the upper right, along (1, −0.26), and back, with a thruster glow behind it (a warm core plus an ion halo, 1.5 cube units back). The sun flare swells by +0.35. No star streaks, and nothing changes on the contrail. | `CameraRig` (zoom), `MessageCube` (nudge, thruster) |
| **Launch bloom** | `launching` (spec §10.3) | the rocket's path is as r6 §4.3, overtaking the comet. At 62% of `LAUNCH_MS` (now **3400**, was 3000) a bloom opens where it overtakes: a soft white flash, then 44 short sparks (gold `#ffe2aa`, white `#dff5ff`, `#f3c98b`, `#7fd4f5`) expanding to 90 px (desktop) / 60 px, drifting down 14 px, gone in about 1.3 s. Then the reply star settles. | `RocketLaunch` |
| **Boarding** | `boarding` (r5 §8.7) | unchanged path; on arrival a warm bloom at the comet (60 px, fading over 0.5 s), then the warm strand | `CapsuleBoarding` |

Reduced motion: each becomes a 300 ms crossfade to its end state.

---

## 12. Sound (spec §12.2): brighter

| Cue | Was | Now |
|---|---|---|
| `ambient` | two detuned sines at 55 Hz and 82.4 Hz (a bare fifth: hollow, "lonely space") plus low-passed noise | **an open, bright chord**: a soft major add9 pad, e.g. C3 · G3 · E4 · D5, slowly detuned. A sparse **music-box arpeggio** (pentatonic, one note every 3–7 s at random, long reverb). The low-pass cutoff opens with the dawn (600 Hz → 1400 Hz as p goes 0.2 → 1). Master −26 dB. |
| `dawn` | – | on Propel: a rising shimmer (filtered noise with a bell overtone), 1.6 s |
| `bloom` | – | at the launch bloom: a soft cluster of three bell tones, falling slightly |
| `launch`, `depart`, `board`, `returned`, `faceLand`, `memory` | as specified | unchanged |

The orbiting things make no sound.

---

## 13. Copy and UI (spec §21, r5 §8.9)

| Key | Was | Now |
|---|---|---|
| orbit.back | `手紙に戻る` | **`手紙を読みかえす`**, which matches the satellite's hover label |
| orbit.replyDone | `返事は届きました` (disabled, greyed) | **`返事、届いています`** with a check icon, styled *done*: warm border `rgba(243,201,139,.55)`, warm text `#f3e6cf`. It is still not a second send: `aria-disabled="true"`, and a tap focuses the reply star. |
| orbit.aboardChip | `あなたの言葉は、彗星の上 · {returnLabel}` | removed: line 3 of the promise caption (§10) |
| reply.overtook | toast at the top | same copy `返事は、彗星より先に届きました。`, placed just above the bottom bar (desktop: 136 px from the bottom; portrait: 216 px) |
| orbit.hint | `星をタップしてみてください。` at 72 px | unchanged copy; placed under the promise caption |

---

## 14. Migration steps (the build already exists)

0. **Parity, without touching the kept items.**
   - If 7.0 steps 4 or 5 have landed, revert these to the pre-r7 build: the satellite's position, the world parallax, and the wake (its geometry and streaming particles).
   - Fix what the build is missing against r6: the planet arc in the bottom-right (missing or too faint) and the comet's tail (it reads as a pale oval).
   - **Leave the contrail alone**: 7.0's "single colour" and "sits apart" items are withdrawn.
   - Record the satellite's screen position and the contrail's geometry as verify snapshots (§15).
1. **`lib/dawn.ts`** plus its verify table (§15). Thread `Dawn` through `ClientCard` (computed on the server like `returnLabel`) or compute it on the client from `comet.leftOn/returnsOn`. No visual change yet.
2. **Sky and sun:** the sky gradient and warm haze, the sun sprite and flare (`SunFlare.tsx`), `keyLight` from the sun (§5). Check that the satellite gets only light, with no material edits.
3. **Planet:** the night side, crescent, conic limb, prominent city lights, aurora (§6).
4. **Sky band and comet framing:** the Milky Way band in `NebulaBackdrop`, the optional Tanabata stars, and the comet's new aphelion in `framing.ts` (§4). `hubPose` for the satellite does not change.
5. **Orbiting things:**
   - first `lib/orbiters.ts` and its verify checks (§15), with no visuals;
   - then the `frame` export from `framing.ts`;
   - then `Orbiters.tsx` (§8).
6. **Comet and caption:** the tail from the sun, the caption top-right (remove the chip), the reply star placement (§10).
7. **Moments and pulses:** Propel (small, §11), the launch bloom, the boarding bloom, `SignalPulses` (§9).
8. **Sound and copy:** §12, §13. Then run the acceptance checks in §16 on a phone and on desktop.

---

## 15. Verify (spec §17): add

**`dawn`:**
- The §3 table: f = 0, 0.25, 0.5, 0.75, 0.9, 1 → 0.20, 0.24, 0.37, 0.62, 0.83, 1.00 (±0.01).
- Monotonic in f; `returned` → 1; `kept` → 0.7.
- `sunElevation` crosses 0 at p ≈ 0.47.

**`keyLight`:**
- Continuous in t and p.
- At p = 0.2 the colour is within 25% of the blue-hour colour; at p = 1 within 5% of golden.
- The fill is never 0.

**Kept as built (snapshots from step 0):**
- `hubPose` puts the satellite's body centre at the recorded screen position (±1 px) at every framing size below.
- The contrail's control points, widths and colours equal the recorded ones.

**Orbiters** (pure; the screen rules use §4's planet disc). The mockup's numbers over 40 seeds are given as a guide.

| Check | Rule | Mockup (40 seeds) |
|---|---|---|
| Deterministic | the same seed gives a deep-equal set; 40 different seeds give 40 different sets | – |
| Counts | desktop 29 (6 / 1 / 18 / 1 / 1 / 2), phone 21 (5 / 1 / 12 / 1 / 1 / 1); at most one missing | 29 and 21 every time |
| Periapsis | `a · (1 − e) ≥ 1.06` for every orbiter | minimum 1.060 |
| Apoapsis | inside the type's range and the placement box; not under the caption; farther than `1.6 · kSat` from the satellite's span | – |
| Start | every non-rock is visible at `t = 0`, clear of the satellite's span and ≥ 6% of the width from the contrail | 0 misses |
| Steady state (2 h, every 10 s) | desktop: median visible ≥ 10, 10th percentile ≥ 6. Phone: median ≥ 6, 10th percentile ≥ 3 | desktop: median 10–12, p10 6–9. Phone: median 6–8, p10 3–6 |
| Speed | at most 12 px/s on screen at 1440 × 810; at most 7 px/s at 390 × 844 | 11.1 and 5.9 |
| Continuity | over 0.1 s, no orbiter moves more than 2 px; changing the clock rate never moves anything | – |

**Framing** (390×844, 430×932, 1280×699, 1440×810, 1512×945):
- The caption's box never intersects the satellite's hull.
- The comet and its full tail never intersect the satellite's hull for f ∈ [0.06, 1], with the new aphelion.
- The sun is inside the frame (with flare) at p = 1.
- No city light lies outside the disc.

**Spacing:** the caption and the toast positions are on the 8-point grid (`verify-spacing`).

**Reduced motion:** dawn still follows f, but there is no drift, pulse, flare animation, spin, blink or orbital motion.

---

## 16. Acceptance (spec §18): add

- [ ] Move `?now=` from the parting day to the reunion day. The sunrise visibly climbs: blue hour with a gold line at first, the sun clearing the horizon in the last half, a full warm sunrise on the day.
- [ ] **The satellite and the contrail look and move exactly as they do today**, apart from the light on them. Check side by side with a pre-r7 screenshot.
- [ ] Small things orbit the planet. At any moment several are visible, usually including two to four craft or paper things.
- [ ] They slow and turn out in the sky and fall back past the planet, in front of it on one side and hidden behind it on the other. Nothing darts.
- [ ] Two different cards show different sets.
- [ ] The planet has warm city lights, a gold-to-cyan limb and a faint aurora.
- [ ] The comet always shows its tail, pointing away from the sun, and never crosses the satellite.
- [ ] The promise caption is readable over every state and never overlaps the satellite.
- [ ] Arriving in orbit gives a short, small propel beat. A reply blooms like a small firework as it passes the comet. Done states look warm, not greyed out.
- [ ] Sound: the ambient is an open, bright chord, not a low drone.
- [ ] **The human check:** show the orbit view, without explanation, to three people who haven't seen it, and ask for one word. None should say "lonely", "sad" or "empty". Record the words in `docs/orbit.md`.
- [ ] Still 30+ FPS on a recent iPhone. The flare, crescent, aurora and orbiters are cheap sprites, instanced meshes or shader terms, not post-processing passes.

---

## 17. Timing constants (spec §22): add or change

| Constant | Value | Where |
|---|---|---|
| `dawn` curve | p = 0.2 + 0.8 · f^2.2 (returned 1, kept 0.7) | dawn |
| `PROPEL_MS` | 2400; nudge **6 px / 4 px**; zoom 1.06 → 1; flare +0.35 | CameraRig, MessageCube |
| `LAUNCH_MS` | **3400** (was 3000); bloom at 0.62 | RocketLaunch |
| `PULSE_PERIOD` | 4.8 s, targets half a period apart | SignalPulses |
| satellite drift and roll | **as built** (mockup: ±3 px / 30 s, ±2 px / 23 s, roll ±0.8° / 40 s) | MessageCube, CameraRig |
| sky: far stars, twinkle, dust | **as built** (7.0's parallax withdrawn) | Starfield, DustMotes |
| nebula sway | ±0.8%, periods 60 s and 71 s | NebulaBackdrop |
| aurora shimmer | 0.35 rad/s | Planet |
| `ORB_BASE_S` | 330 s (T = 330 · a^1.5, about 7–14 min) | orbiters |
| `PERI_MIN` | 1.06 planet radii | orbiters |
| orbiters fade | out 400 ms, in 600 ms | Orbiters |
| nav blinks | cubesat 0.22 s every 2.2 s; station 0.2 s every 3 s | Orbiters |
| spin, sway, bob | spin ≤ 0.25 rad/s (rocks × 0.6); station ±0.06 rad at 0.03 rad/s; crane ±0.12 rad at 0.5 rad/s | Orbiters |
| reply toast | 4 s, above the bar | OrbitOverlay |

---

## 18. Files (spec §16): add or change

```text
lib/
  dawn.ts                 NEW     dawn(f, status) → { p, sunElevation, warmth }
  sceneLight.ts           EXTEND  keyLight from the sun position and dawn (§5)
  orbiters.ts             NEW     ORB_MIX, makeOrbiters(seed, frame), orbiterPos(o, t), period(o), isVisible (§8); pure
components/three/
  Orbiters.tsx            NEW     instanced orbiting things, screen-anchored, depth by layer (§8.4–8.8)
  SunFlare.tsx            NEW     sun sprite behind the limb + flare in front (§6)
  SignalPulses.tsx        NEW     §9
  Planet.tsx, shaders/planet.ts   EXTEND  night side, crescent, conic limb, city lights, aurora (§6)
  NebulaBackdrop.tsx      EXTEND  Milky Way band, sky gradient by dawn, warm haze uniform, sway
  Starfield.tsx           EXTEND  optional Vega/Altair only (no parallax)
  Comet.tsx               CHANGE  tail away from the sun; length rule (§10)
  RocketLaunch.tsx        EXTEND  bloom (§11)
  CapsuleBoarding.tsx     EXTEND  warm bloom on arrival
  CameraRig.tsx           CHANGE  Propel zoom only; hub pose unchanged
  MessageCube.tsx         EXTEND  Propel nudge + thruster glow (no change to the satellite's look, place or drift)
  framing.ts              CHANGE  comet aphelion (§4); export the orbit frame for makeOrbiters (§8.3)
  Trail.tsx, DustMotes.tsx        UNCHANGED
components/card/
  OrbitOverlay.tsx        CHANGE  promise caption top-right, chip removed, done-state pill, toast position
lib/sound.ts              CHANGE  ambient chord + arpeggio, `dawn` and `bloom` cues (§12)
scripts/verify-orbiters.ts        NEW     §15 orbiter checks
docs/specs/mockups/orbit-dawn.html      REPLACE the 7.1 mockup (reference only; not shipped)
```

Docs: update these.
- `docs/orbit.md`: why dawn, why company in orbit, what stays as built, and the human check results.
- `docs/verification.md`.
