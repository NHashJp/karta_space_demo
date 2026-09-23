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

## Performance budget

Spec §27 asks for ~60fps on desktop and 30+ on ordinary phones. A full-screen
fractal noise shader is the only thing here that can threaten that.

| Measure | Value |
|---|---|
| Canvas `dpr` | capped at 1.75 |
| Nebula octaves | 4, dropping to 3 below 700px wide |
| Star count | 1500 |
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
