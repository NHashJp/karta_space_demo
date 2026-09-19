# Scene and shaders

Source: `components/three/SpaceEnvironment.tsx`, `NebulaBackdrop.tsx`,
`Starfield.tsx`, `WanderingLights.tsx`, `components/three/shaders/`

Everything in the background is procedural. There are no environment maps or
background textures to download.

```
SpaceEnvironment
├── NebulaBackdrop    shader sphere, radius 90, BackSide
├── Starfield         1500 points, custom shader, shell radius 28–86
├── lights            ambient + key + a cool fill
└── WanderingLights   3 point lights, each with an additive glow plane
```

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
