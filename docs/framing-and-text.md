# Framing and text

Source: `components/three/framing.ts`, `components/three/TextFace.tsx`,
`components/three/CubeScene.tsx`

All of the maths here lives in `framing.ts`, which imports nothing from React
and is therefore checkable from a script. Two bugs in this area shipped and
were caught by that suite; both are described below because they are easy to
reintroduce.

## The 40-pixel rule

Japanese paragraph text is real DOM attached to the cube face, via drei's
`<Html transform>` (spec §12 prefers this over baking text into a texture:
sharper type, correct line breaking, real accessibility).

The one thing you must know about that component:

> **`<Html transform>` maps 40 CSS pixels to 1 world unit at `scale={1}`.**

It comes from `1 / ((distanceFactor || 10) / 400)` in drei's source, applied to
the object matrix. So:

```
world units = pixelWidth × scale / 40
scale       = 40 × worldUnits / pixelWidth
```

Getting this wrong is not subtle. Sizing it as though 1px were 1 unit made a
400px panel render at **0.046 world units** — a ~30px speck in the middle of
the cube. The factor was off by exactly 40.

The panel spans `PANEL_WORLD = 1.84` units of the 2-unit face.

## Camera distance

`cameraDistance(width, height)` returns how far back the camera sits.

The subtlety: the face you read is **not** at the cube's centre. It is at
`z = +1`, one unit nearer the camera. Framing the centre instead of the face
plane made the cube render at ~86% of viewport height instead of the intended
55% — close enough to look like you were peering into the box.

```
portrait?  governed by width,  target 75% of it   (spec §15: 65–80%)
landscape? governed by height, target 55% of it   (spec §15: 45–65%)

visibleAtFace = 2 / fill
toFace        = (visibleAtFace / 2) / tan(halfAngle)
distance      = max(1 + toFace, SWEPT_RADIUS / sin(min(halfV, halfH)))
```

That second term is a floor, not a preference. `SWEPT_RADIUS = 1.5` is the
half-extent the cube sweeps through while spinning; the floor guarantees it
never clips the edge of the frame mid-rotation. On a narrow phone this floor is
what actually decides the distance.

| Viewport | z | Face fills | Clearance |
|---|---|---|---|
| desktop 1512×945 | 5.39 | 55% of height | 2.06 |
| laptop 1280×800 | 5.39 | 55% of height | 2.06 |
| iPhone 390×844 | 7.98 | 75% of width | 1.50 |
| iPad 834×1112 | 5.29 | 75% of width | 1.57 |

## Panel sizing

A fixed-pixel panel does not work, because the same panel occupies a very
different fraction of the screen on a phone than on a desktop. Sized at 520px,
text rendered at 20px on a desktop and **9px on an iPhone**.

The fix is to author the panel at *its own on-screen width*, so the CSS-to-screen
scale stays near 1:1 and a 17px font is genuinely ~17px everywhere:

```
renderedPx  = (PANEL_WORLD / visibleHeightAtFace) × viewportHeight
textPanelPx = clamp(renderedPx, 260, 560)
```

The clamp matters at both ends. Below 260px the panel would be too cramped to
wrap sensibly; above 560px a very large window would stretch lines out rather
than scale the type up, so past that point the panel scales instead.

## Fitting type to a face

A cube face on a 390px phone is about 293px wide. It cannot hold 150 Japanese
characters at 17px — that is arithmetic, not a styling choice. Spec §7 says
over-long content should be rejected during preparation rather than scrolled
inside a face, so font size is **solved** from the message length.

Japanese glyphs are close to em-square, so a paragraph of `N` characters at
size `f` in a box of width `w` occupies roughly `ceil(N·f/w)` lines of
`f·lineHeight` each. Setting that equal to the box height and solving:

```
f ≈ sqrt(w² / (N × lineHeight))
```

That is only a starting point, because lines round up to whole lines. So
`fitFontSize` steps down in 0.25px increments until the *measured* wrapped
layout actually fits, clamped to 12.5–20px.

`N` is a **visual length**, not a character count (`visualLength` in
`lib/i18n.ts`): a kana or kanji counts 1, a Latin letter 0.55, a space 0.3.
Every rule here was written for Japanese, where a character is about an em
wide; an English paragraph counted by its letters would be fitted as though it
were twice as long as it sets, and drawn at half the size. The same measure
sizes the line faces, the secret line, the closing line (which also breaks
after an English comma or full stop) and the length limits in `cardRules`.

### The rounding bug

`fitFontSize` originally rounded its result. Rounding **up** — 15.947 to 15.95
— reduced characters-per-line from 14 to 13, which added a whole line and put
the paragraph back over the edge of the face. It floors now, and the comment in
the source says why so it does not get "tidied" back.

Current configuration on a 390px phone:

```
107 chars -> 8 lines @ 14.65px
102 chars -> 7 lines @ 14.78px
 97 chars -> 7 lines @ 15.94px
```

`overflow: hidden` on the panel is the hard backstop, in case a real browser's
metrics diverge from the model.

## Reading from inside the cube

A card with a `secret` puts the camera *inside* the cube, at
`INSIDE_DISTANCE = 0.62`, looking at the far wall at `SECRET_PLANE_Z = -0.94`.
Everything above assumes a camera 5 to 8 units away; from 1.56 units, with the
same 45° field of view, the numbers are brutal:

| Viewport | View width at the far wall |
|---|---|
| desktop 1512×945 | 2.07u |
| iPad 834×1112 | 0.97u |
| iPhone 390×844 | **0.60u** |

Six tenths of a world unit is the entire readable width on a phone. That is why
the secret is capped at 28 characters (`SECRET_MAX`) and why it gets its own
sizing rule rather than reusing the face panel: `secretPanel()` derives the
panel from the *inside* distance, and `fitLinePx()` sizes a single line to that
width, clamped to 15–34px. It is the same 40-pixel rule underneath — only the
camera has moved.

The panel's world width is clamped to the visible width, so the line cannot
spill past the frame even where the pixel clamp would have widened it. The
[verification suite](./verification.md) checks all three — panel inside the
view, line at least 15px, line fitting its panel — at every viewport, and also
that the camera sits within the walls and clears its own near plane.

## Images

Image faces are ordinary three.js textures, not DOM (spec §12). `cover` fitting
is computed from the image's own aspect ratio against a square face, applied
through `map-repeat` and `map-offset`. `contain` instead shrinks the plane to
86% of the face.

Image materials are declared `transparent` up front even though they are
opaque, so that [dimming](./cube-and-motion.md#dimming) can change their
opacity without triggering a shader recompile mid-animation.

## The orbit view (v0.2)

`orbitPose(width, height)` frames two things at once: the whole of the
satellite's tilted ellipse, and the planet's silhouette.

The obvious implementation — take the composition's bounding box, size the
frame to it — is wrong here, and wrong in a way worth recording. The
composition is over four units deep: the planet's near pole is 3.2 units closer
to the camera than the far side of the orbit, and the frame is correspondingly
smaller there. Sizing for the widest extent *and* the nearest depth at the same
time pushes the camera back far enough to satisfy both at a point where neither
actually occurs, and the result was a 31% margin where 8% was required — a
composition a third smaller than it needed to be, on every screen.

So the distance is solved **per sample point**: for each point on the ellipse
and on the planet's limb, the distance at which that point would sit exactly on
the margin, and the answer is the furthest of them. That lands on a 10.7%
margin at every viewport, tight against §17's 8% floor with room for tuning.

The camera looks straight down −z through `ORBIT_TARGET`, which sits above the
planet's centre rather than at it. That is what puts the planet low in the
frame and leaves the sky to the satellite, the comets and the trail. Tilting
the camera as well was tried and removed: it bought nothing the target offset
did not already buy, and made the framing maths much harder to reason about.

## Memory panels on the trail

`memoryViewDistance(width, height)` is the same idea as `cameraDistance`, for
the same reason: a fixed stand-off distance makes a memory fill a phone's
narrow frame and get lost in a wide one. Portrait is governed by width (72% of
it), landscape by height (55%), which is where §17 asks a memory to land —
exactly the share of the frame a cube face fills.

The camera backs off along the **curve's own tangent** rather than along +z.
That is the difference between travelling a path and looking at a line from
outside it, and it costs nothing: `lib/trailCurve.ts` is pure and both the
camera and the ribbon read the same curve from it, so they cannot disagree
about where the trail is. A camera that stops half a unit off the ribbon is
invisible in a screenshot and obvious in motion.
