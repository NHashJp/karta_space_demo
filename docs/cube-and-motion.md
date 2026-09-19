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
