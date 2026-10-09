# The orbit

Source: `components/three/` (`CubeScene`, `OrbitScene`, `Planet`, `SunFlare`,
`DawnSky`, `Comet`, `Trail`, `Orbiters`, …), `framing.ts`, `lib/dawn.ts`,
`lib/cometOrbit.ts`, `lib/trailCurve.ts`, `lib/orbiters.ts`

After the closing screen the letter becomes a satellite holding station above
あなたの星, the receiver's planet, with the sun coming up over its edge. The look
is the revision 7.1 [mockup](./specs/mockups/orbit-dawn.html). The design rule:
**the build is the reference for the satellite and the contrail** — they are
pinned by a pixel snapshot in the checks.

## Composed from the screen

Everything in the hub is placed by solving for where it should land as a
**fraction of the viewport** and projecting back into the world, not by choosing
world coordinates — which is why the composition survives a phone. Portrait and
landscape are separate compositions (`hubTargets`): on a phone the satellite
spans 0.74 of the width, on a desktop 0.36; the planet is an arc in the
bottom-right covering 7–15% of the frame; the comet lives in the top-right; the
contrail leaves from the upper-left. The camera is solved from the satellite's
target position and span (`hubPose`).

## The dawn is the countdown

`lib/dawn.ts` turns the comet's progress `f` into one number,
`p = 0.2 + 0.8·f^2.2`. Everything follows it: the sun's height over the limb,
the key light's colour, the sky's warmth, the planet's crescent, the brightness
of things in orbit, the ambient chord. It is never night (`p ≥ 0.2`), and most
of the change lands in the last quarter of the wait, as the comet's own motion
does. It is a function of the date, so reduced motion still shows the right sky.

## The planet and the sun

- **The planet is a disc facing the camera** (`shaders/planet.ts`). It is staged
  large and close to the lens, where a real sphere's perspective outline would
  not match the circle everything else is placed on; the shader reconstructs the
  sphere from where each fragment lands, so its outline is exactly that circle.
- **It is lit from a point on its own limb** (`planetSunDisc`), not by N·L, which
  would light the whole visible arc. The night side stays near-black; the sunlit
  crescent is *mixed* in, widening with `p`; city lights are pixel-sized points
  in clusters near the limb that fade where it is already day.
- **The limb** is a camera-facing ring (`shaders/atmosphere.ts`): a haze, a glow
  and a one-pixel line with a conic gradient — cream at the sun, gold, cyan, deep
  blue — plus a trace of aurora on the night side. It writes decoded screen
  colours so the gradient survives the sRGB encoding.
- **The sun** (`SunFlare`) is a warm glow *behind* the planet (cut off by the
  limb) and a white core, halo and eight-ray flare *in front*, strengthening as
  the disc clears the horizon.
- **The sky haze** (`DawnSky`) is drawn far back and depth-tested, so the planet
  covers it.
- While the satellite is mid-deployment the planet draws first and stops
  writing depth, so the full-size wings stay in front of it on a phone.

## The comet

Its **position is the countdown**: real Kepler motion (e = 0.86) keeps it far
and faint for most of the wait and swings it home fast at the end, its tail
growing. Its tails point away from the sun.

In the hub it rides an **ellipse** (`hubCometAt`): the long axis runs from its
homecoming point beside the planet to the far point top-right; how far along
comes from the display-compressed orbit, the loop's width from the true orbit.
It leaves along the right-hand side and comes home along the left. Anything that
aims at the comet — the rocket, the boarding words, the intro, the signal
pulses — uses `cometAt`, never its own copy of the maths.

**The first-launch intro** (`CometIntro`, `CometPreview`, `lib/cometPreview.ts`)
plays one timeline in both the DOM and the scene:

1. *announce* — あと **X** 日 over the sender's own promise;
2. *draw* — the way home as a dashed gold line;
3. *run* — the real comet flown home while the number counts down and the
   scene's own dawn rises to the reunion morning, so the sky at zero is the sky
   the card will show on the day (warm light and meteor shower included);
4. *arrive*, then everything rewinds to today and the 言葉をのせる sheet opens.

It plays once per cycle, can be skipped, and can be watched again from the sheet
once the reader's words are aboard. See [architecture](./architecture.md#the-state-machine).

**The sheet** asks in two steps — "would you?", then the form — and states the
seal first. `TrajectoryPanel` draws the whole orbit, with the planet at a focus,
to answer *when* it comes back.

## Sending

Two ways, differing only in speed, both seen travelling towards the comet:

- **The rocket** (`RocketLaunch`) enters from beyond the far edge of the screen,
  crosses the frame, pauses beside the satellite, overtakes the comet with a
  small bloom of sparks, and settles as a star. The reply panel closes as it
  launches.
- **Words on the comet** (`CapsuleBoarding`) run up to the comet and land on it.

Both play only after the server accepted the message.

## The trail of memories

Memories hang off the contrail, newest first; going forward goes further back in
time, and either end returns to orbit.

- **Staged, not placed.** `stagedTrail` projects the curve's two screen targets
  back into the world so it leaves from the upper-left clear of the satellite;
  the ribbon, the panels and the camera all read the same curve
  (`useStagedTrail`).
- **Spaced by distance travelled**, not by curve parameter, so every hop is the
  same length. At the limit of 20 the gap is 1.2 panel widths.
- **Flown beside, not down.** The camera stands 17° off the curve's tangent, and
  the ribbon fades within 2.6 units of the lens, so it never fills the frame.
  The way back retraces the curve, paced by arc length, blending into the
  pull-out with a smoothstep so it never stops halfway.
- **It lasts to the oldest memory**, ages in colour — ion-cool by the newest,
  violet, ember, amber by the oldest (`trailEra`), with the slow drift playing
  over it — and **bends** in long one-sided S-curves past the first few memories
  (`meander`), sized to keep the camera 1.2 units clear of the ribbon.
  `TrailSky` tints the background with the same era as the camera travels.
- The ribbon is a gaussian cross-section that fades in at the satellite and out
  past the last memory; outside the trail view it sways gently.

## Company in the sky

- **Orbiters** (`lib/orbiters.ts`): about thirty small satellites, a station,
  rocks and a moonlet on real Kepler orbits seen nearly edge-on — they hang and
  turn far out and fall away past the planet. Apoapses are chosen on screen
  first; periods of 7–14 minutes so nothing darts; always *behind* the planet
  and the satellite, passing behind the limb as moons do; seeded per card;
  drawn in three meshes.
- **Rocks** cross the deep field about every 30 s (Poisson), tumbling, built
  around a guaranteed miss distance from the satellite.
- **Shooting stars** (`lib/shootingStars.ts`): short streaks appearing in the
  upper-left sky and fading over ~1.5 s — about one every 4 s in the hub, every
  14 s elsewhere, never over text. One in eight is a larger, slower **fireball**.
  On the reunion day they hold still while the meteor shower plays.
- **Speed streaks** sweep past the lens; their length and opacity *are* the
  speed, so a still scene is still.

## The sky

Procedural, no textures. The **nebula** is domain-warped fractal noise on a
90-unit sphere, with dark dust lanes, filaments and bright knots, densest on a
diagonal that leaves the lower third calm; a **starfield** of 1500 points plus
eight bright stars; three **wandering lights**; near **dust motes** for
parallax. Motion is built from sines whose periods share no common multiple, so
nothing reads as a scroll.

**The sky ages with the letter** (`lib/skyAge.ts`): from `writtenAt` (or the
comet's `leftOn`) the gas thins and cools on a half-life of six months and never
finishes, so a letter opened a year on is read against a sky further from home.

A vignette and film grain sit over the canvas as DOM (`AmbientOverlay`).

## The chrome

- **Glass** for every sheet and panel (one recipe); **pills** for the bar and
  the corner controls, with a fill so they stay legible over the lit limb.
- **Top right**: `?` (in the hub — *KARTA_SPACE について*, the core idea and five
  values) beside the sound control; under them the caption — the promise, the
  countdown large in sunrise gold, the date.
- **The bar**: follow the trail, launch a reply, the comet, back to the letter.
  It hides while a panel is open.
- **Into the cube from orbit**: the label on the satellite (中をのぞく), shown on
  hover, on keyboard focus, or after 20 s of stillness; its hit box is the body
  only, so it never covers the clickable comet. On a touch screen it takes
  **two taps**: the first shows and arms it ("もう一度タップ" / "Tap again"), the
  second goes in; touching elsewhere or waiting `TOUCH_ARM_MS` (5 s) disarms it.

## Ready before the button

The orbit's pieces are mounted, hidden, as soon as the closing screen is up, and
`Precompile` builds their shaders once while nothing is moving. Pressing
軌道へ送り出す only has to show them. The reunion-day meteor shower is the
exception: it plays once, and must not play unseen.

## Performance and reduced motion

Target ~60 fps on desktop, 30+ on phones: `dpr` capped at 1.75, nebula drops
an octave below 700 px wide, 1500 stars, no post-processing, and the thirty
orbiters drawn in three meshes rather than thirty. `prefers-reduced-motion` freezes shader time and
drift, removes streaks, shooting stars and the idle motion, and shortens the
camera and rotations — everything stays legible and reachable.
