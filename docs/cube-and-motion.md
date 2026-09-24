# Cube and motion

Source: `components/three/rotationPresets.ts`, `components/three/MessageCube.tsx`,
`components/three/CameraRig.tsx`

## Face layout

The cube is 2 world units across. Faces are numbered in reading order and
mapped to sides per spec §9:

```
1 Front (+Z)    2 Right (+X)    3 Back (−Z)
4 Left (−X)     5 Top (+Y)      6 Bottom (−Y)
```

Content order is fixed and never randomised. Only the animation path is.

Each face has one **canonical orientation** — the cube rotation that brings
that face square-on to the camera with its text upright:

```ts
FACE_ORIENTATIONS = [
  identity,              // 1 Front
  quat(Y, −π/2),         // 2 Right
  quat(Y,  π),           // 3 Back
  quat(Y,  π/2),         // 4 Left
  quat(X,  π/2),         // 5 Top
  quat(X, −π/2),         // 6 Bottom
]
```

Uprightness on the top and bottom faces is not an accident but it is also not
obvious. A plane placed on the +Y side is rotated `−π/2` about X, which sends
its local up vector to the cube's local `−Z`; the cube's own `+π/2` X rotation
then sends that to world `+Y`. The two cancel. The same holds, mirrored, for
the bottom face. [Verification](./verification.md) checks all six numerically
rather than relying on that paragraph being right.

## The landing guarantee

This is the central trick of the whole project.

The requirement (spec §10) is that transitions look different each time, but
always end with the next face exactly square-on and its text exactly upright.
A random quaternion cannot do that. Interpolating and hoping is worse.

So a transition is the **shortest path between two canonical orientations**,
with a decorative offset layered on top:

```
orientation(t) = slerp(from, to, ease(t)) · decoration(t)
```

and `decoration` is built so that it is *the identity rotation at both ends*:

| Component | Shape over `t` | Value at `t = 1` |
|---|---|---|
| `spin*` | `angle · ease(t)`, where angle is ±2π | 2π — a whole turn, i.e. identity |
| `tilt*` | `angle · sin(π·t)` | `sin(π) = 0` — identity |

A whole turn is indistinguishable from no turn. A tilt that swells to its peak
mid-flight and returns to zero has also gone nowhere. So however elaborate the
path, `decoration(1)` is identity and the cube lands on `to` exactly — not
approximately.

The frame loop then copies `to` in verbatim on the final frame, so floating
point cannot accumulate across a session either.

Measured landing error across every preset and every pair of faces: **0°**.

## Presets

Six of them, plus a reduced-motion variant:

| Name | Spin | Tilt | Duration |
|---|---|---|---|
| `clockwise-sweep` | +2π about Y | 0.22 X | 1100ms |
| `counter-sweep` | −2π about Y | −0.20 X | 1100ms |
| `vertical-roll` | +2π about X | 0.26 Y | 1050ms |
| `diagonal-drift` | none | 0.30 X, 0.30 Y, 0.12 Z | 820ms |
| `banked-turn` | +2π about Y | 0.10 X, 0.28 Z | 1200ms |
| `short-arc` | none | 0.16 X, −0.20 Y | 700ms |
| `reduced` | none | none | 320ms |

`pickPreset(previous)` filters out the last one used, so the same animation
never runs twice in a row. Durations sit inside the spec's 700–1200ms window.
Easing is `easeInOutQuint`, which gives a soft arrival.

### On the "360–540°" budget

The spec bounds *decorative* rotation, not total rotation. A Front→Back move is
180° of necessary travel before any decoration. The verification suite measures
the actual path travelled and subtracts the shortest path between the two
orientations, so what it reports is decoration alone: 19–378° across all
presets and all face pairs.

This distinction caused a false failure the first time it was checked — the
original assertion measured total path and flagged two presets at ~550°, which
was correct arithmetic against the wrong quantity.

## Reading state

When a transition completes the cube stops. What continues is an extremely
subtle drift — about 1° of rotation and 0.03 units of float — applied to an
**outer group**, never to the cube's own quaternion. That matters: the face
orientation stays exactly canonical while the whole assembly breathes. Under
`prefers-reduced-motion` the drift amplitude is zero.

## Camera dolly

`CameraRig` is the sole owner of `camera.position.z`. Nothing else writes it.

- reading distance: computed responsively, see [framing](./framing-and-text.md)
- waiting distance: reading + `ZOOM_DISTANCE` (10 units)
- in: 1400ms, out: 1000ms, reduced-motion: 300ms, eased with `easeInOutQuint`

Two cases it distinguishes, which is easy to get wrong:

- **Phase change** (`near` flipped) — animate between distances.
- **Resize** (`near` unchanged, target moved) — retarget and snap. Without this
  split, resizing the window during the landing screen would start a slow
  1.4-second drift for no reason.

On first paint it sets the camera straight to its target instead of animating,
so the page does not open mid-dolly.

## Dimming

On the closing screen the whole scene recedes so the drawn message can be read:
cube materials to ~12% of their base opacity, point lights and glows to ~18%,
nebula intensity from 0.9 to 0.34.

`MessageCube` does this by traversing its group each frame and scaling every
material's opacity against a base captured once in a `WeakMap`. That avoids
threading a dim factor through every material as a prop.

One wrinkle worth knowing about: `THREE.MathUtils.damp` approaches its target
asymptotically and never arrives. Without a snap, materials would settle
permanently at 99.9% opacity on the way back. The loop therefore zeroes the
tail below 0.002 and runs one final pass at full opacity.

## The deployment (v0.2)

The cube turns over, unfolds four solar panels, lights a thruster and rises
into orbit. It is the moment the whole of v0.2 is built around, and it is one
animation with four **overlapping** parts:

```
0                 0.25      0.55  0.65            1
|--- turn --------|
        |--- panels ------|
                          |thrust|
                       |--- rise ------------------|
```

The overlaps are the point. Four strictly sequential steps read as a list of
four things happening; bleeding into each other, they read as one machine doing
one thing. `lib/deployment.ts` holds the windows and is pure, so verify can
assert the shape rather than anyone having to watch it: that the phases overlap
as specified, that the thruster fires exactly once, that the ends are exact,
and that every part is monotonic in `t`.

That last one is what makes **docking** safe. Undeploying is not a second
animation — it is the same timeline with `t` running down instead of up. If one
part of it went forwards while the rest went back, the cube would come home in
a shape it was never in on the way out.

### Continuity, and why a threshold cannot check it

The obvious check — "no two samples differ by more than X" — cannot tell a
*fast* curve from a *discontinuous* one, and the thruster is deliberately the
fastest part of this: it rises and falls inside a window a tenth of the
timeline wide, so it fails any bound the other three pass.

What separates the two is how the worst step behaves as the sampling gets
finer. A continuous curve halves when you double the resolution; a jump does
not move at all. So verify samples at two resolutions and asserts the finer one
is proportionally smaller.

### Who owns it

The cube. `MessageCube` runs the clock and dispatches `deployEnd`, and nothing
else may: `CameraRig` reads the same `DEPLOY_MS`, but if the camera announced
the end the two could disagree by a frame at a low frame rate, and the panels
would still be moving when the orbit UI appeared.

Progress is published through a **ref** rather than state. The carrier that
flies the cube to its ellipse and the ring that fades in under it both read it
every frame, and none of those 60 reads a second should be a React render. The
only thing that goes through state is the panel mount, which crosses a
threshold once per deployment.

### The arrays, and why the spec's mechanism was replaced

§8.2 describes four plates hinged flat against the cube's side faces, swinging
up into a cross. It is a tidy idea, and it does not read as a satellite: the
plates are the same size as the body and never leave it, so the result looks
like a box that opened rather than a spacecraft that deployed.

Real arrays are **carried away from the bus on a boom** and are much larger
than it, and that proportion is most of what makes the silhouette recognisable:

```
┌───┐
│bus│──┬──[ segment 1 ][ segment 2 ]
└───┘  └── the boom, and the joint the array pivots on
```

Two wings rather than four, because port-and-starboard is the shape everyone
already knows and two large arrays read better at 30 px on a phone than four
small ones. They deploy in the order the real ones do — boom telescopes out,
folded array swings off the joint, outer segment unfolds from the inner — with
each starting before the last has finished, so it reads as one mechanism. The
second wing lags the first by a beat, which is the difference between two
mechanisms and one object mirrored.

Once open they tilt a few degrees toward the sun, and keep adjusting as it
moves. An array that ignores where the light comes from is a decoration.

**The wingspan is load-bearing.** A deployed tip reaches 1.43 units from the
bus at satellite scale, and the orbit's clearance over the planet is 1.85 —
sized against it. `wingReach()` and `orbitClearance()` both live in modules
verify can read, and it asserts the first is comfortably inside the second:
the bus clearing the planet is not enough once the arrays are out, and a tip
sweeping through the planet twice a lap is the same bug moved to the wingtips.

The shape itself lives in `lib/satelliteGeometry.ts`, not in the component that
draws it, because three different things have to agree about where a panel is:
`SolarWings` draws it, the framing checks measure its projected silhouette, and
verify asserts that no panel passes through the body or through another panel
at any point in the deployment. A shape that only exists inside a component
cannot be checked — and a wing that clips through the bus for four frames is
exactly the kind of thing nobody sees until it is in front of someone.

### The display attitude, and measuring the thing you drew

Once deployed the satellite holds a three-quarter view: yaw −35°, pitch −20°,
roll +36.5°. The first two are the pose; the **roll is what puts the wing axis
on the composition's −50° diagonal**, and without it the wings run at about
−13°, very nearly horizontal. The yaw is negative so the +X wing leans *towards
the camera*, which is what revision 6 §3.1 asks for in so many words: the near
wing is the upper-right one and the larger one. Yawed the other way the picture
still reads, but the wing drawn big is the one going away, and the satellite
looks like it is receding rather than keeping station.

Two traps here, both of which were live for a while:

**A check must go through the same rotation as the drawing.** `MessageCube`
turned the cube by three angles while `satelliteHull` rotated about Y alone by
`WING_AXIS_DEG`, so every composition check reported a tidy −50° while the
wings were drawn nearly horizontal. The checks were measuring a construct that
could not disagree with itself. There is now one `displayDirection`, and the
cube, the hull and the tip-to-tip measurement all go through it.

**Euler order is not the order you say it in.** Yaw, then pitch, then roll is
`"ZXY"` in three.js, because it applies the axes right to left. `"YXZ"` — which
is what the sequence reads like — is about twenty degrees out: small enough to
look deliberate, large enough to put the wings somewhere the checks never
looked. `DISPLAY_EULER_ORDER` is a named constant so verify can assert that a
three quaternion built from those angles agrees with `displayDirection` to
within 1e-9.

### The glint comes free

`shaders/panelCells.ts` draws the cells rather than texturing them, and gives
them a hard specular (exponent 68) — glass over silicon is nearly black until
the sun's angle lines up, and then it flares. Because the sun *moves* on its
own (§23.3), that flare sweeps across the six panels in turn every couple of
minutes without anyone animating it.
