# Scene and shaders

Source: `components/three/SpaceEnvironment.tsx`, `NebulaBackdrop.tsx`,
`Starfield.tsx`, `WanderingLights.tsx`, `components/three/shaders/`

Everything in the background is procedural. There are no environment maps or
background textures to download.

```
SpaceEnvironment
├── NebulaBackdrop    shader sphere, radius 90, BackSide  (L0 gas, L1 filaments)
├── Starfield         1500 points, custom shader, shell radius 28–86  (L2, L3)
├── BrightStars       8 points with diffraction spikes, shell radius 46  (L3)
├── lights            ambient + the moving key light + a cool fill
├── WanderingLights   3 point lights, each with an additive glow plane  (L4)
└── DustMotes         12–24 points in a 6-unit box that travels with the camera (L5)
```

Above the canvas, as DOM: `AmbientOverlay` — a vignette and a film grain (L7).

## Why there is a near layer at all

The stars are 30 units away and the nebula is further. Before v0.2 nothing in
the scene had ever been *near*, and the consequence was subtle but constant:
when the camera dollied, the world appeared to turn rather than the camera
appearing to move, because every layer moved by the same negligible amount.

`DustMotes` fixes that with a dozen specks about two units out. They parallax
hard against all that distance, and the sense of space between the viewer and
the sky arrives with them. They drift up and left at 0.05 units/s — under the
12 px/s ceiling of the motion budget — and **wrap** rather than respawn, since
a mote that pops out of existence is the one thing anyone would notice.

The same logic drives the nebula's filament layer: it flows at 0.7× the gas's
speed on its own vector, and two layers moving at different rates is parallax.
Two layers moving together are one layer.

## Not scrolling in one direction

The first version drifted the nebula along a fixed vector and rotated the stars
at a constant rate about Y. Both read as a *scroll* — mechanical, and once you
notice the direction you cannot stop noticing it.

The fix, applied in three places, is the same idea each time: build motion from
**sines whose periods share no common multiple**. The sum never repeats, so the
direction keeps wandering and the eye finds no pattern to lock onto.

```glsl
vec3 flowField(float t) {
  return vec3(
    sin(t * 0.0170) * 1.00 + sin(t * 0.0431 + 1.73) * 0.42,
    cos(t * 0.0234) * 0.86 + sin(t * 0.0117 + 2.91) * 0.51,
    sin(t * 0.0139 + 0.62) * 0.94 + cos(t * 0.0367 + 4.18) * 0.38
  );
}
```

Those are periods of roughly 59s against 23s, 43s against 85s, 72s against 27s.

- **Nebula** — the flow vector offsets the noise sampling position.
- **Starfield** — three slow sines on three axes instead of one constant rate.
- **Wandering lights** — each axis is a slow sweep plus a faster wobble, so a
  light never retraces its path.

## Nebula

A large sphere rendered `BackSide`, with fractal value noise in the fragment
shader. Two things give it character:

**Domain warping.** The sampling position is displaced by a second noise field
before the main lookup. This is what turns even fog into wisps, filaments and
hollows:

```glsl
vec3 warp = vec3(fbmLow(p + …), fbmLow(p + …), fbmLow(p + …)) - 0.5;
float base = fbm(p + warp * 1.75);
```

**A temperature field.** A third, much slower noise decides where the dust
glows cold (ion blue) versus warm (ember), so the palette keeps shifting
without announcing itself. A slow `breath` term modulates overall brightness.

Empty regions are deepened with `pow(clouds, 1.35)`, which makes the bright
filaments read as further away.

### The hash

The noise hash is deliberately **not** the usual `fract(sin(dot(p, …)))`. Value
noise costs 8 hashes per lookup, and the warped version needs about 12 lookups
per pixel — that would be ~96 `sin` calls per pixel. It uses a multiply-fract
hash instead:

```glsl
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
```

## Depth comes from what is in front, not what is behind

The v0.2 nebula adds three things (spec v0.2 §23.2), and they are not equally
important:

1. **Dark dust lanes** — ridged noise that *absorbs* up to 70% of the light
   where the gas is dense. This is most of the depth. Bright gas with nothing
   in front of it is a bright surface, however well shaded.
2. **Filaments** on their own flow vector (above).
3. **Bright knots**, 3–6 of them in the densest gas, each with a wide faint
   halo, so the eye has somewhere to land.

Plus a **composition bias**: the densest gas lies along a diagonal band, which
deliberately leaves the lower third calm — that is where the planet rises and
where every control sits.

Ridged noise (`1 - |2n - 1|`, squared) is the shape of both the lanes and the
filaments. It turns the smooth blobs of value noise into creases; one of them
subtracts light and the other adds it.

## The sun

One key light, shared by everything: the planet's terminator, the glint that
sweeps the satellite's panels, the rim on its atmosphere. It **moves** — a few
degrees over a minute or two — which is what makes the scene read as a place
rather than a picture.

Its direction lives in `lib/sceneLight.ts` rather than in any component, for
one reason: several things have to agree about where the sun is, and a shader
and a `directionalLight` that disagree by ten degrees look broken in a way that
is very hard to name. Being pure, it is also checked:

```
azimuth   = −38° + 9°·sin(2πt/96 + s1) + 3°·sin(2πt/37 + s2)
elevation =  42° + 5°·sin(2πt/71 + s3)
intensity = 1.0 + 0.06·sin(2πt/23)
```

`npm run verify` section 10 asserts what matters about it: it never jumps
(under 0.2° per 0.1 s — a jump in the sun is a jump in every shadow at once),
it stays inside the arc the composition was framed for, the direction is always
a unit vector, the returned-day warm shift is at most 10%, and under reduced
motion it is constant but still lit.

The seed shifts only the phases, never the arc: two cards are lit from slightly
different points in the same sweep, so they do not look identical side by side
without either of them looking wrong.

## Starfield

1500 points in a spherical shell, positioned with `cbrt` so density is even
through the volume rather than bunched at the inner radius.

Per-star attributes: colour (mostly white, some blue-hot, a few warm), size,
twinkle phase and twinkle speed. Sizes follow `pow(random(), 2.6)` — a steep
curve, so a handful of stars are bright and most are faint. That distribution
is what makes a field of points read as a sky rather than as scattered dots.

The fragment shader gives each star a tight core with a soft halo
(`pow(smoothstep(0.5, 0.0, d), 3.5)`), so it reads as *shining* rather than as
a disc. Additive blending, no depth write.

Generation is seeded, so the sky is identical on every load.

## Shooting stars

The classic thing: a bright head with a tail tapering behind it, crossing a
corner of the frame in about a second, every fourteen seconds or so. It asks
for nothing and means nothing, and that is the point — the hub is otherwise
full of objects that *mean* something (the comet is a countdown, the trail is
a memory, the satellite is the letter), and a sky made only of meaningful
objects stops reading as a sky.

### It must not become the meteor shower

`MeteorShower` already exists and is a different thing: five slow warm streaks,
**once**, on the day something comes back. Its own note says why — "once is
the whole design; a shower that repeated would become weather, and the day
would stop being a day." Ambient shooting stars would take that away by making
the rare thing ordinary, so they are kept apart deliberately:

| | Shooting star | Meteor shower |
|---|---|---|
| when | every ~14 s, always | once, on the day |
| how many | one | five together |
| speed | fast, ~1.2 s | slow, 4.2 s |
| colour | white, faintly cool | warm `#ffe9c9` |

and the sky **holds still for five seconds** while the shower plays, so an
ordinary one never crosses it.

That hold was wrong the first time and is worth recording. It was built as an
offset on the *timetable* — hold the first star back by five seconds — which
reads correctly and protects nothing, because the shower plays when the
satellite reaches orbit and that can be minutes after the card was opened. By
then the delay is long over. It is now measured from the moment the component
sees the shower, which is the moment that actually matters.

### The path is in frame units, not world units

A shooting star is a thing you *see*, not a thing that is somewhere. What
matters is that it crosses the frame — and the frame is a very different shape
on a phone than on an ultrawide. In world coordinates, a path tuned on a
laptop misses a portrait screen altogether, because the visible width at that
distance is a third as wide.

So a path is defined in **half-heights**: y of ±1 is the top and bottom of the
frame, x of ±`aspect` the sides. Angles are true in those units, so a 30°
diagonal is a 30° diagonal everywhere, and the component converts to world
space through the camera's own frustum at the star's depth. It also makes
"does it actually cross the frame" something `npm run verify` can answer for
7,200 paths across six screen shapes, rather than something you find out on
someone else's phone.

They enter from off-frame — through the top, mostly, or the upper part of a
side — and are aimed back across the middle rather than straight out of the
nearest edge. The lower third is left alone: that is where the planet rises
and every control sits.

### One quad, and why that is enough

Everything happens in **camera space**. The star is positioned relative to the
camera and travels in the camera's own x–y plane, which buys two things at
once: it keeps its place in the frame as the camera drifts, the way something
forty units away should, and a plane lying in that same x–y plane is already
facing the lens. No billboarding, no per-frame `lookAt` — just a roll about
the view axis to point it along the flight.

The shader does the rest. The gaussian across the streak is scaled by how far
along it you are, so the tail narrows to nothing instead of ending in a blunt
edge; a high power of the lengthwise coordinate keeps the white core to the
last few per cent; and the alpha sums a broad term and a sharp one, which is
what gives the little flare at the head that the eye reads as speed.

## Wandering lights

Three, which is a deliberate ceiling — more became distracting rather than
atmospheric. Each is:

- a `pointLight`, so the cube picks up coloured reflections as it passes;
- an additive glow plane behind it, so the light itself is visible as haze.

The glow is a plane rather than a sprite because **the camera never rotates** —
it only moves along Z and looks at the origin — so a plane in the XY plane
always faces it. No billboarding needed.

Colours are ion blue, nebula purple, and a dim teal at roughly half the
strength of the other two.

## Colour space

These are plain `ShaderMaterial`s, not `RawShaderMaterial`s. That matters: three
injects its fragment prefix — including the `linearToOutputTexel` function —
only when the material is *not* raw. So the shaders can end with

```glsl
#include <colorspace_fragment>
```

and get the renderer's own output conversion. Without it, colours are written
linearly, displayed as sRGB, and come out muddy and over-saturated.

`THREE.Color` converts hex to linear working space on the way in, so uniform
colours and output conversion agree.

## A comet is a density, not a shape

The comet was first drawn as an additively blended sphere for the coma and a
flat strip for each tail. Both are *shapes*, and that is the problem: a sphere
of constant colour has a silhouette, and the eye finds a silhouette instantly —
it read as a bead of glass rather than gas coming off a rock. A strip has two
hard edges running its whole length, which is the one thing a tail never has.

`shaders/comet.ts` makes both falloffs instead.

- The coma is a **core plus a much wider skirt** (`exp(-r²·11)` and
  `exp(-r·2.6)`), whiter at the centre than at the edge, faded to nothing
  before the quad's own boundary so the billboard never shows a border of its
  own at any brightness. It brightens as the comet comes home, so the object
  that is a speck at aphelion is the brightest thing in the corner by the end.

  Its *size* cannot simply be raised, which is worth knowing before anyone
  tries. On a phone the satellite spans four fifths of the width and the comet
  passes between its upper wing tip and the right edge of the frame — a gap of
  about 90px with the comet's centre in the middle of it. So the floor (which
  governs aphelion, where the comet is genuinely hard to find) is generous and
  the ceiling (perihelion, where it is close and trailing something enormous)
  gives way. Verify checks that the glow clears the hull and stays in frame,
  because a centre-distance check lets a coma three times the width of the gap
  sail straight through it.
- The tails fade **across their width as well as along their length**, and are
  widened in *view* space, so they turn to face the camera and can never be
  caught edge-on and vanish. Only the spine is built on the CPU — including the
  dust tail's lag, which is a real direction in the world and grows with the
  square of the distance travelled.

## The contrail: a ribbon that has to look like gas

The trail is a camera-width ribbon along the card's own curve, and three
separate things were each making it read as a painted stripe rather than as
something burning off. All three are rev 6.

**It never moved.** The colours drifted, but drift has no direction. The
geometry is built once and never rebuilt, so the ribbon itself was fixed in
space. `trailSway` now displaces what is *drawn* from the curve — three sines
with periods sharing no common multiple, offset along `u` so it undulates
rather than sliding about rigidly. It is still where the satellite holds it
and freer further out, because a trail tethered at one end is what the eye
expects. The curve is untouched: it is the card's identity, and the memories
hang at fixed places on it.

The glints get the identical displacement at their own `u`, so a memory's
light never comes off the ribbon under it. And the drift is **off in the trail
view**, where the camera flies to fixed points on the curve and the panels are
pinned to it — a trail that drifted down there would slide out from under
both.

**Its edges were hard.** The cross-section was a squared smoothstep, which
holds most of its value out to about two-thirds of the half-width and then
falls away — putting a visible rim there. It is now a gaussian, which spends
most of the width on the falloff. The practical difference is where the
`alpha < 0.002` discard fires: it used to cut at 87% of the half-width, well
inside the ribbon, and now cuts at 97%, where the profile is genuinely
nothing. The subtraction in that formula is doing real work — `exp(-K)` at the
boundary is small but not zero, and a small non-zero alpha at the last vertex
is exactly a hard edge.

**One of its ends was cut off.** The far end tapered to nothing; the near one
sat at full brightness and stopped where the geometry started, so the widest,
brightest part of the ribbon ended in a flat cap drawn straight across it. It
now comes in from nothing over the first eighth of the length, so the trail
arrives at a point the way the far end already leaves at one.

Each of those changes carries a scale factor chosen so the trail is no
brighter or dimmer than it was — 0.948 on the cross-section, 1.119 on the
length. The point was the shape of the edges, not the exposure.

## Speed is drawn, not simulated

`SpeedStreaks` is short line segments sweeping past the lens, where the
**length of each streak is the speed**. That is the whole trick, and it is why
it cannot be done with round points.

It exists because a satellite that holds its place on screen is the right
picture and the wrong sensation — the station-keeping drift and the turning sky
are both true and both far too slow to read as motion. Two rules keep it
honest: its opacity *is* the speed, so a still scene is a still scene and
nothing sparkles behind a paragraph; and on the trail the rate is measured from
how far the camera actually moved last frame, which is the one way a streak
field can never disagree with the motion it is describing.

## Performance budget

Spec §27 asks for ~60fps on desktop and 30+ on ordinary phones. A full-screen
fractal noise shader is the only thing here that can threaten that.

| Measure | Value |
|---|---|
| Canvas `dpr` | capped at 1.75 |
| Nebula octaves | 4, dropping to 3 below 700px wide |
| Star count | 1500 |
| Speed streaks | 150 line segments, hub and trail only |
| Point lights | 3, plus 2 directionals and an ambient |
| Post-processing | none |

The `dpr` cap is close to free here, because the paragraph text is DOM rendered
by the browser at native resolution — canvas resolution does not affect how
sharp the Japanese type looks.

Low detail is selected with a `#define` and a `key` on the material, so the
change actually recompiles the shader rather than setting an ignored flag.

## Reduced motion

`prefers-reduced-motion` freezes shader time, stops the star drift, halts the
wandering lights, removes the cube's idle drift, and shortens the camera dolly
to 300ms and cube rotations to 320ms. The scene remains fully legible; it just
stops moving.

## Verifying shaders

A GLSL mistake does not throw — it silently blanks the scene. So
`scripts/` aside, the shaders are parsed with three's `#include` chunks
resolved before being trusted. See [verification](./verification.md#shaders).

## The camera breathes, except where you are reading

At rest — `landing`, `completed`, `orbit` — the camera dollies ±0.7% and rolls
±0.22° over 26 seconds. It is under the threshold at which anyone notices it
happening, and it is the difference between a place and a photograph of one.

It is **off** in `reading`, `remembering` and `inside`. Text that drifts while
your eyes are on it is far worse than a still scene, and this is the one rule
here that is not a matter of taste. Note that `acceptsInput` is the wrong test
for it — two of those three states accept input — so `breathesAtRest` is its
own predicate, and verify checks every state against it.

## The screen layer

`AmbientOverlay` is two CSS layers over the canvas: a vignette (transparent to
`rgba(2,3,6,.55)` from 55% out) and a film grain — one 160px tile at 6%
opacity, stepped in eight 150 ms jumps rather than slid, because a smoothly
sliding noise texture reads as a moving surface instead of as grain.

Both are DOM rather than a post-processing pass. A full-screen render target is
a real cost on a phone already drawing a nebula, a planet and two comets, and
this is two layers. The grain tile is the only static texture in the product;
`public/grain.png` is generated once, and good noise is not worth a shader.
