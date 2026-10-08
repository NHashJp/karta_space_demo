# The cube

Source: `components/three/rotationPresets.ts`, `MessageCube.tsx`,
`CameraRig.tsx`, `TextFace.tsx`, `framing.ts`, `lib/deployment.ts`,
`lib/satelliteGeometry.ts`

## Faces and the landing guarantee

The cube is 2 world units across. Faces 1–6 are front, right, back, left, top,
bottom, and each has one canonical orientation (`FACE_ORIENTATIONS`) that brings
it square-on with its text upright. Content order is fixed; only the motion
varies.

A transition is the shortest path between two canonical orientations with a
decoration on top that is the identity at both ends:

```
orientation(t) = slerp(from, to, ease(t)) · decoration(t)
spins:  angle · ease(t), angle = ±2π   → a whole turn at t = 1
tilts:  angle · sin(πt)                → zero at t = 1
```

So however showy the path, the cube lands exactly on the next face — measured
error 0° — and the last frame copies the target in verbatim so nothing drifts
over a session. Six presets (`clockwise-sweep`, `counter-sweep`,
`vertical-roll`, `diagonal-drift`, `banked-turn`, `short-arc`), 700–1200 ms,
`easeInOutQuint`, never the same twice in a row; reduced motion gets a plain
320 ms turn. Decoration (path travelled minus the shortest path) stays under
the spec's 540°.

At rest the cube drifts about 1° on an **outer** group, so its own orientation
stays exactly canonical.

## Camera

`CameraRig` is the only thing that moves the camera. It travels between poses —
far (landing, closing), near (reading), inside, orbit, chart, trail — on
`easeInOutQuint` (in 1400 ms, out 1000 ms, reduced motion 300 ms). A resize
retargets and snaps rather than starting a slow drift. At rest on the landing,
closing and orbit screens it breathes ±0.7% over 26 s; never where text is read.

On the closing screen the scene dims (cube to ~12%, lights ~18%, nebula 0.9 →
0.34) by scaling each material against a base opacity captured once; the damp
is snapped at its tail so nothing settles at 99.9%.

## Framing and type

All maths is in `framing.ts`, pure and checked at five viewports.

- **The 40-pixel rule.** drei's `<Html transform>` maps 40 CSS px to one world
  unit at `scale = 1`, so `scale = 40 × worldUnits / pixelWidth`. Face text is
  real DOM on the face (sharp, correctly broken, accessible) in a panel 1.84
  units wide.
- **Camera distance** frames the face plane (`z = +1`), not the cube centre:
  portrait by width (75%), landscape by height (55%), never closer than the
  spinning cube's 1.5-unit sweep allows.
- **The panel is authored at its own on-screen width**, clamped to 260–560 px, so
  a 17 px font is about 17 px everywhere.
- **Type is solved from the message**: `f ≈ √(w² / (N × lineHeight))`, then
  stepped down 0.25 px until the measured layout fits, clamped 12.5–20 px and
  floored, never rounded (rounding up costs a line). `N` is the visual length
  ([cards](./cards.md#languages)). Line faces are sized to land as one beat.
- **Images** are textures: `cover` via repeat/offset, `contain` at 86% of the
  face; their materials are created transparent so dimming never recompiles a
  shader.

### Reading from inside the cube

The camera sits at `INSIDE_DISTANCE = 0.62` looking at the far wall
(`z = −0.94`). A phone sees only **0.60 world units** there, so the secret line
has its own sizing (`secretPanel`, `fitLinePx`, 15–34 px) and a 28-character
limit. Its offer on the closing screen arrives last of all (`SECRET_AFTER_MS`
after the orbit offer).

## The deployment

The cube turns, pushes a boom out of each side, unfolds three panels per wing,
fires a thruster and rises — 3.6 s, as four **overlapping** windows
(`lib/deployment.ts`: turn 0–0.25, panels 0.15–0.75, thruster 0.7–0.8, rise
0.6–1), because overlaps read as one machine and a sequence as a list.

- **Docking is the same timeline backwards.** Every part is monotonic in `t`,
  and the attitude is an interpolation between two fixed ends
  (`FACE_ORIENTATIONS[activeFace]` → the display pose), so the closing screen
  comes back exactly as it was left.
- **The second trip is shorter**: `REPLAY_SCALE` 0.55 compresses the timeline and
  its sound together; the shape in `t` is unchanged.
- **`MessageCube` owns it** and dispatches `deployEnd`; progress is published as
  a ref so the carrier, the planet and the camera read it without re-rendering.
- **The satellite** (`lib/satelliteGeometry.ts`) is two large boom-mounted wings,
  as real spacecraft carry them, held in a three-quarter view (yaw −35°, pitch
  −20°, roll +36.5°, Euler order `"ZXY"`) that puts the wings on the
  composition's −50° diagonal. The checks measure the same `displayDirection` the
  drawing uses, and assert no panel ever passes through the body or another
  panel.
- **The panels catch the light**: a driven glint sweeps the six panels on a
  nine-second cycle (`shaders/panelCells.ts`).
- **It leaves as one object.** Dimming multiplies opacities; stowing for the
  trail *caps* them (`lib/satelliteFade.ts`), so the metalwork never outlives
  the cube it is bolted to.
