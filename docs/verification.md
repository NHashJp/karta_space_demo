# Verification

```console
$ npm run verify
```

## Why this exists

This project has an unusual amount of geometry and typography maths whose
correctness is invisible in code review and awkward to eyeball in a browser.
"Does the cube land exactly square-on?" and "is the text legible on a phone?"
are not questions you can answer by reading a diff, and a shader mistake does
not throw — it silently blanks the scene.

So the checkable parts are pure functions in files with no React in them, and
`scripts/verify-rotation.mts` imports them directly in Node. No browser, no
test framework, no mocking.

**Every bug listed below was found by this suite, not by looking at the page.**

## What it checks

### 1. Face orientations

For each of the six faces, applies the canonical cube orientation and the
face's own placement, then checks the resulting normal points at the camera and
the face's up vector points at world up.

```
face 1: normal·camera=1.000000 up·worldUp=1.000000
…
face 6: normal·camera=1.000000 up·worldUp=1.000000
```

### 2. Landing exactness

For every preset × every ordered pair of faces, evaluates the orientation at
`t = 0` and `t = 1` and measures the angle to the intended endpoints.

```
worst landing error: 0.00e+0°
worst start error:   0.00e+0°
```

### 3. Decorative rotation budget

Integrates the actual path travelled over 600 steps, subtracts the shortest
path between the two orientations, and asserts the remainder is within the
spec's 540° ceiling. Reports 19–378° across all presets.

> The first version of this check measured *total* path and failed two presets
> at ~550°. Correct arithmetic, wrong quantity — a Front→Back move includes
> 180° of necessary travel before any decoration.

### 4. Camera framing and type size

Across five representative viewports, computes camera distance, what fraction
of the viewport the face fills, the fitted font size, characters per line, and
the cube's clearance from the frame edge.

```
desktop 1512x945   z=5.39 face=55%H/34%W text=20.0px 19ch x 6L clearance=2.06
iPhone 390x844     z=7.98 face=35%H/75%W text=14.6px 15ch x 8L clearance=1.50
iPad 834x1112      z=5.29 face=56%H/75%W text=20.6px 23ch x 5L clearance=1.57
```

Asserts: type ≥14px, ≥12 characters per line, the longest message fits the
face, the cube cannot clip while spinning, and the face fills the spec's range
for that orientation.

The same loop then does it again from *inside* the cube, where a phone has only
0.60 world units of view: the secret panel must fit that view, the line must
set at ≥15px and must fit its panel. Three geometric invariants are checked
once: the camera sits within the walls, the secret plane is inside the far
wall, and the two clear the camera's near plane.

```
desktop 1512x945   inside: view=2.07u panel=0.71u line=34px for 11 chars
iPhone 390x844     inside: view=0.60u panel=0.50u line=24.74px for 11 chars
```

### 5. Configured content

Runs over **every card** in `config/cards.config.ts`, so adding a card adds its
own checks.

The rules are not written here. They live in `lib/cardRules.ts` and are the
same object the registry enforces at import time and the editor shows as you
type — slug shape and uniqueness, six faces, non-empty title and closing,
80–250 characters a message (spec §7), alt text, images under the card's own
`/cards/<slug>/` folder. See
[content and cards](./content-and-cards.md#one-definition-of-a-valid-card).

The one difference is severity. Those rules separate **errors** (would break
the build) from **warnings** (against the spec, but harmless to the
machinery), and the editor saves through a warning so that a card can be
drafted. This suite fails on both, because it is the gate you run before
deploying, not while writing.

On top of the shared rules it checks the two things they cannot know:

- an image face's file is **really on disk** at that path;
- a message **physically fits** a cube face — measured through `measureFace` at
  the phone panel size, ≥14px and no overflow.

Section 4 sizes type against the longest message across all cards, so one
over-long paragraph on any card is caught.

### 6. Experience flow

Walks a complete journey through the [state machine](./experience-flow.md) —
57 transitions: open, all six faces forward, close, scroll back in, walk
backwards to face 1, replay, then round again and into the cube and back out.
Asserts at every step that **face text is revealed only in `reading`**, that
input is ignored in all six animated phases, and that you cannot navigate
before face 1.

The inside of the cube gets the same treatment as face text, because it is the
same class of mistake: the secret line must be attached in `inside` and in no
other state, `reveal` must do nothing from any of the other eight states, and
the camera phase must read `inside` while descending and `far` the moment the
climb back out starts.

The two ceremony counts (`closings`, `deployments`) are walked rather than
asserted on a hand-built state, because what they have to get right is
*routes*: `completed` is arrived at from the end of the letter, from coming
back out of the cube and from docking, and each of the three has to count. A
refused event must count nothing, or a single stray gesture makes the next
play brisk.

The replay factor itself gets bounds rather than a value, since the number is
a judgement and the constraints are not: the shortened unfold must still be
long enough for the six hinges, the hinges must stay far enough apart to be
heard and seen as six, and the camera must still land inside the *shortened*
deployment — the spec's "camera duration ≤ cube deploy duration" rule, applied
to the case that could actually break it.

## Shaders

Separately, the GLSL is parsed with three's `#include` chunks resolved and its
injected prefix simulated, using `@shaderfrog/glsl-parser`. This catches
syntax errors and unknown chunk names, which would otherwise show up as a
blank scene with a console message that is easy to miss.

The parser is not a project dependency — it is installed in a scratch directory
when needed.

## v0.2 sections

The suite grew from six sections to twenty-four, plus a second script. Rather
than listing each, here is what each group is *for*:

| Sections | What they protect |
|---|---|
| 1–5 | the cube's geometry, framing and content limits (v0.1) |
| 6 | the v0.1 journey, transition for transition — the regression baseline |
| 7 | fuzzy dates, the orbit clock, the comet's orbit, the trail's colours, the payload's seal |
| 8 | the gate: normalisation, hashing, precedence, cookie invalidation |
| 9 | orbit, the trail, panels, both one-way animations, all 15 preview targets |
| 10 | the moving sun, and where the camera may and may not breathe |
| 11 | the hub composition at every viewport: satellite, planet, comet, trail |
| 12 | the satellite through a full year, and the landing line |
| 13 | memories, and that photographs go through the gated route |
| 14 | the comet's position as a countdown |
| 15 | the three email templates, and that no env value reaches a body |
| 16 | what the receiver may send, and what is stripped from it |
| 17 | the seal: round-trip, and every way it must fail |
| 18 | the reminder's date logic and its idempotency key |
| 19 | that a save would write the header the file already has |
| 20 | the deployment's four overlapping windows |
| 20 | the satellite leaving as one object, rather than in pieces |
| 21 | the trail drifting without coming off its own curve |
| 22 | that looking into the satellite lands where 中をのぞく lands |
| 23 | the closing line wrapping rather than shrinking to nothing |
| 24 | both ways of sending going towards the comet |
| 25 | the sky ageing in one direction, slowly, and never finishing |
| 26 | that no passing rock can reach the satellite, or the camera |
| 27 | that the satellite's label never covers the clickable comet |
| 28 | that a full trail still has room between its photographs |
| 29 | that a card's pictures follow it when its slug changes |
| 30 | that every shooting star actually crosses the frame |
| 9, 9b | the dawn curve, and the light it produces (rev 7.1) |
| 31 | the two things rev 7.1 promises not to move: the satellite and the contrail |
| 32 | that coming back from the trail is one continuous move |
| `verify-spacing` | the 8-point grid, across CSS and inline styles |
| `verify-orbiters` | the company in orbit, over two simulated hours (rev 7.1) |

Sections 20–28 are all **rev 6**, and they share a shape worth noticing: each
one asserts something that is only visible in motion, by checking the number
underneath it instead. A fade that leaves parts behind, a trail that wanders
off, a route that ends in the wrong place, a line too small to read, a rocket
flying at the camera — none of those can be caught by a typecheck, and all of
them are arithmetic before they are pixels.

Section 11 is the one that has caught the most. It projects the satellite's
actual hull, the planet, the comet and the trail into each of four viewports
and measures them against revision 6 §3.1's numbers — body centre, tip to tip,
wing axis, frame margin, how much of the frame the planet may cover, which
quadrant the comet passes through, and how far the flight path down the trail
stays from the ribbon. Every one of those is a number in the spec, so every one
of them can be wrong in a way a screenshot would not settle.

## Two checks worth explaining

**Continuity cannot be a threshold.** "No two samples differ by more than X"
cannot tell a *fast* curve from a *discontinuous* one — the deployment's
thruster is deliberately the fastest part of that timeline and fails any bound
the other three pass. What separates them is how the worst step behaves as
sampling gets finer: a continuous curve halves when you double the resolution,
a jump does not move. So the deployment is sampled at two resolutions.

**A seal is checked by searching, not by asserting a flag.** The sender's comet
message is not asserted "hidden" — the entire `JSON.stringify` of the payload
is searched for it, before and after the return date. A message behind a
boolean is not sealed. The same technique proves no environment value reaches
an email body: each is set to a sentinel string, and the rendered templates are
searched.

## Bugs this has caught

| Bug | How it presented |
|---|---|
| `<Html transform>` scale off by 40× | text was a ~30px speck; found by reading drei's source, confirmed by the framing numbers |
| Camera framed the cube centre, not the face plane | cube filled 86% of the viewport instead of 55% |
| Fixed-pixel text panel | would have rendered at **9px on an iPhone** |
| `fitFontSize` rounding up | cost a character per line, added a whole line, overflowed the face |
| Face text revealed outside `reading` | card content drawn behind the title screen |
| Damping never reaching zero | materials would settle permanently at 99.9% opacity |
| scrypt output is a prefix under truncation | a shortened hash still verified, on far fewer bits |
| `L` left in the generated alphabet | §14.9 excludes it; removing it left 31 letters and a biased modulo |
| Camera elevation broke the orbit projection | −18% margin where 8% was required |
| Bounding-box framing of a 4-unit-deep scene | 31% margin, so the composition sat a third too small on every screen |
| The hull rotated about Y, the cube about three axes | wings drawn near-horizontal while the check happily reported −50°: it was measuring a construct, not the hull |
| Camera distance divided by the *world* span | the wing axis runs back into the screen, so the satellite drew a tenth of the frame too small |
| The trail left unstaged at the world origin | rev 6 puts the satellite on that origin: the contrail came out of the middle of the spacecraft |
| Newlines stripped from reply messages | a paragraph break was impossible; a newline in a *name* was header injection |
| Comet key length checked in only one place | a short key threw from inside node's cipher instead of being refused |
| The camera flew down the middle of the ribbon | 0.197u from the lens, pointed along its length — an additive white wedge over the whole frame |
| Memories spaced evenly in `u`, not in distance | hops of 5u and 50u on one card; the comment claimed even effort and the check measured `u` |
| The satellite left drawn on the trail | at the first memory it sat 2u in front of the lens with the panel 5u behind it |
| `COMET_VIEW_DEPTH` a stale constant | 3.4 where the comet is staged at 14.1, so every "minimum pixels" the comet computed was a quarter of what it asked for |
| `tailLength` returning 0 at a cutoff | a step, not a fade — the tail was still a third of a unit long when it vanished between frames |
| The comet's clearance measured as a point | a coma three times the width of the gap it passes through sails past a centre-distance check |
| `SpeedStreaks` seeded on a stride of 3 with an offset of 7 | `i*3+7` is `(i+2)*3+1`: every streak's speed was another streak's direction |
| The deployed attitude written as a step, not a position | docking left the cube at its satellite angle: the closing line and the signature were drawn under a body that was no longer square-on |
| A tumble underneath a `slerp(DISPLAY, 1)` | overwritten every frame by the line above it — a degree of drift a frame, wiped a frame later, for as long as anyone had been reading the comment |

## Limits

This suite checks maths, not pixels. It cannot tell you whether the nebula
looks good, whether the rotation feels nice, or whether the type is beautiful —
only that the numbers underneath are right.

Nor does it touch anything that leaves the machine: no email is sent, no
network call is made, no browser is opened. The templates are checked as
*strings* and the seal as a round-trip, which says nothing about whether your
provider will accept the message.

So it is necessary and not sufficient. [Testing](./testing.md) is the other
half, and it is a human job.

It checks content and logic, not delivery. It says nothing about whether an
email actually arrives, whether a deployed card is reachable, or whether the
editor's write path works — none of which are pure functions. Those were
exercised by hand against a running server during each phase (the routes'
status codes, the media route's guards, the seal over real HTTP), and the
editor's own **live check** is the standing version of that for deployments.

## 20. The satellite leaves as one object

The satellite is not one material. The cube's glass sits at 0.34 opacity, its
wires and the solar array's grid at 0.94, the booms and the mast at 1. For a
long time the stow scaled all of them by one multiplier, which preserves those
ratios all the way down:

| | base | at 15% of the fade |
|---|---|---|
| Cube glass | 0.34 | 0.051 |
| Panel grid | 0.94 | 0.141 |
| Booms, mast, outlines | 1.00 | 0.150 |

The cube is imperceptible around 0.05. The metalwork bolted to it is still at
0.15 — three times as opaque — so on the way to the trail the wings were seen
outliving the thing they hang off.

**Dimming multiplies; stowing caps.** On the closing screen the satellite is
still an object, just further back, and brighter parts should stay brighter.
On the way out it is leaving, and everything has to leave together. A ceiling
changes nothing early, because every material is below it; as it comes down it
takes the brightest parts first, and from the faintest material downwards they
are all at the same alpha.

This has been reported twice — once because the materials were not
`transparent` at all, and once because lightening the cube widened the gap,
which is a change nobody would think to re-test the stow against. Hence a
check. It asserts the spread between the brightest and faintest part collapses
to exactly 1, that they reach zero together, and — so it cannot quietly pass
against a multiplier again — that a multiplier *would* have failed it.

## 21. The trail drifts, without coming off its own curve

The curve itself is the card's identity, seeded from the slug, with the
memories pinned at fixed places along it. The drift displaces what is *drawn*
from the curve rather than changing it, which is what lets the trail be alive
without the memories moving.

Three properties are checked: it is still where the satellite holds it and
freer further out; it stays bounded over a long sitting, because an offset
that accumulated would walk the trail out of the scene while someone read the
card; and it moves slowly enough between frames to read as drift rather than
jitter.

## 22. Looking into the satellite lands where 中をのぞく lands

Two ways in, one destination. From the closing screen the reader presses
中をのぞく; from orbit they press the label on the satellite, because the
satellite *is* the cube. If those ever stop arriving at the same state, the
card has grown a second inside.

`reveal` only transitions from `completed`, so the orbit route is two moves
chained — fold the satellite up, then go in — and it deliberately does **not**
stop at the closing screen on the way past, nor land there on the way out. The
check walks the whole round trip and asserts it never touches `completed`,
that it returns to orbit, and that the closing screen's own detour still comes
back to the closing screen.

## 23. The closing line wraps rather than shrinking

`StrokeText` fits one line to the width it is given, so the size on screen is
very nearly the width divided by the number of characters. A thirty-nine
character farewell lands at 9px on a phone — visibly handwriting, unreadably
so. Wrapping to a second line nearly doubles that, because the size is set by
the longer of the two.

The break goes at 。 or 、, never mid-phrase, and among those at the one that
leaves the longest line shortest — the longest line is what sets the size. A
line with no punctuation is left alone, because a wrong break reads worse than
small text does. All of that is asserted, including that the pieces still add
up to the whole line.

## 24. Both ways of sending go towards the comet

Direction carries meaning here, so it is asserted rather than watched.

The card offers two ways to send something and the only difference between
them is speed — so both have to be *seen* going the same way, out into the
depth of the scene where the comet is. Neither did:

| | Was | Now |
|---|---|---|
| The reply rocket | +2.06 in z, i.e. **towards the lens**, settling 9.4 units from the comet on a heading of its own | recedes, and settles 1.8 units past the comet on the comet's heading |
| The capsule of words | ran up the comet's **true** ellipse and stopped 7.6 units short of where the comet is drawn | lands on it, 0.000 |

The capsule's miss had a specific cause worth remembering: the comet is not
drawn on its true orbit. The hub places it along a composition path so that it
lands top-right of the frame (`cometAt`), and anything aiming at the comet has
to aim there. Three components worked this out separately and two got it
wrong, so there is now one function and the other two call it.

The check runs at both reference shapes, and asserts four things per shape:
the reply recedes in z, it ends further from the camera than it started, it
passes the comet rather than stopping short of it or sailing off, and its
heading is within 0.9 of the comet's own.

## 25. The sky ages with the letter

The background is made out of how long ago the card was sent, which makes it
the one part of the scene a reader can compare against their own memory of it.
Three properties, each a thing someone would actually notice:

| | Checked as |
|---|---|
| It only ever ages | every output, day by day over twenty years: gas and warmth never rise, stars never fall |
| It never finishes | the curve stays strictly under its ceiling at twenty years |
| It cannot be caught moving | one day's step is at most 0.35% of the whole journey |
| It is worth doing at all | a season apart moves the gas by more than 0.1 — a negative control against a curve so gentle nobody could see it |

Plus where the date comes from: `writtenAt` beats the comet's `leftOn`, a card
with no date at all is a fresh sky rather than an error, and a card dated in
the *future* — a post-dated letter, or a reader whose clock is wrong — reads as
sent today rather than as a sky running backwards.

## 26. Passing rocks never touch the satellite

The one hard requirement of the asteroid field. A rock through the satellite is
not a glitch a reader forgives: it is the object the whole card is about, being
hit.

The clearance is guaranteed by construction rather than by rejection sampling.
Each path is built *around* its own closest-approach point, placed at an exact
distance from the satellite in the plane perpendicular to the travel direction,
so the miss distance is an input and not an outcome. The check's job is to
confirm that the construction is honest and that the margin is really there, so
it does four separate things over 16,000 paths from 40 cards:

| | Result |
|---|---|
| The stated miss distance is the real one | recomputed independently from the line, agrees to 1e-9 |
| Nothing comes closer than the floor | 4.5 units |
| The **real deployed hull** is never touched | 2.1 units clear, after taking off the rock's own radius |
| Nothing flies between the reader and the satellite | 7.8 units clear of the closest camera, at the widest of five viewports |

Measuring against `satelliteHull()` rather than against the constant is the
point of the third row: a satellite that grows cannot quietly eat the margin.

The timetable is checked too — a mean gap of 30 s, gaps varied enough not to be
a metronome, and a pool deep enough to hold every pass that is due. That last
one earned its keep immediately. Sized against a single card's timetable the
pool came out at four; swept across sixty, the twenty-ninth wanted six. A pass
with nowhere to land is silently not drawn, which is exactly the kind of thing
nobody would ever notice was happening.

## 27. The satellite's label never covers the comet

The label on the satellite is the only route from the hub into the cube, and it
appears on hover. To be hovered its box has to accept pointer events — and a
box that accepts pointer events also **swallows clicks inside it**.

The comet is the one thing in the scene that is clickable, and the hub's own
tip, 「星をタップしてみてください」, is an invitation to tap it. It is drawn along a
composition path rather than its true orbit, and that path passes close to the
satellite at some aspect ratios. Sized to the satellite's full tip-to-tip span,
the label's box and the comet **overlap outright on a tablet**, and clear by
eleven pixels on a phone.

So the box is capped at `LABEL_SHARE` — half the span, which still covers the
body and the inner booms, the part anyone actually points at. This check is
what that cap is for: it sweeps the comet's whole orbit at five viewports and
asserts it never enters the box, and clears it by at least one 48px touch
target. The worst case is 90px, on a phone, early in the orbit.

Sweeping the orbit is the point. Where the comet is drawn depends on how far
round it has got, so a clearance that held on the day the card was sent would
fail silently months later, on someone else's screen.

With the cap removed the check fails 2 of 2 — the margin is real, not a rule
that is true whatever the numbers are.

## 28. A full trail still has room on it

The trail's length is fixed — z = −4 to z = −70, whatever is on it — and
memories are spaced along it by distance travelled. So every memory added
brings all of them closer together, and `MEMORY_MAX` is not a preference but
a measurement: the count at which two adjacent photographs would touch.

| memories | gap | against the 2.4u panel |
|---|---|---|
| 12 | 5.17u | 2.15× — the old limit |
| 20 | 2.87u | **1.20× — the limit now** |
| 22 | 2.60u | 1.08× |
| 24 | 2.38u | 0.99× — they touch |

Two different claims, and only one of them can be proved:

**The shortest trail is known, not hunted.** Every card's trail is a different
shape, seeded from its slug, and the shortest is the one memories sit closest
on. `straightestTrail` is the curve with no wander at all; wander only ever
adds length, so no seed can beat it. The check confirms that against 800 real
seeds, so the bound and the generator cannot drift apart unnoticed.

**The tightest single gap has to be searched for.** This is the part that
caught me out. It is *not* the same question as the shortest trail: spacing is
even only to within a few per cent, so a longer trail with worse evenness can
pinch tighter than the shortest one does. Worse, the answer depends on which
slugs you try — two populations of a few thousand reported 1.19 and 1.24 panel
widths, and a first attempt using 24 arbitrary seeds missed the tight cases
altogether and reported a gap 4% wider than the real one. The floor is set at
1.15, below both populations and far enough above 1.0 to fail long before
anything overlaps.

It also checks the progress dots, which are one row, centred, and do not wrap:
20 of them is 232px against the 288px a 320px screen leaves. An overflowing
row is clipped at both ends, so the reader silently loses the dots telling
them where they are.

Raising the limit without the trail being able to hold it fails the build:
22 fails on daylight, 24 on overlap, 28 on the dots as well.

## 29. A card's pictures follow it when the slug changes

A card's media is filed under its slug, and the slug is written into every
media path. So renaming a card — or starting one by copying the sample, which
is how most real cards begin — left every photograph pointing at the old
card's folder.

The two kinds failed differently, and that is the whole reason this survived
so long: a **cube face** still loaded, because `/public` is served flat and
the file really was at that URL, while a **memory photograph** 404'd, because
it goes through `/c/<slug>/media/` and that route resolves inside the card's
own folder. The trail drew empty frames and reported nothing, by design —
a memory that cannot load must never block the journey.

The route is not the bug and has not changed; one card's reader must not be
able to reach another card's private pictures. The check is on the rename
carrying the files with it:

- every stray path is repointed into this card's folder, faces and memories
- nothing is left naming the old card
- filenames survive — this moves pictures between folders, it does not rename
- it is idempotent: a card already in order comes back untouched, by identity

And the regression itself, rebuilt through the real `toClientCard`: the broken
shape is the URL `/c/<slug>/media/private/cards/<other>/memory-01.png`, which
the media route resolves under `private/cards/<slug>/` and cannot find. The
check asserts that shape existed before and is gone after.

## 30. Shooting stars cross the frame, on every screen

A shooting star is a thing you see, so the only property that really matters
is that it is seen. Their paths are in half-height units rather than world
coordinates precisely so that this is checkable: 7,200 paths, across six
screen shapes from a 0.46 phone to a 2.37 ultrawide, and every one of them
crosses the visible frame.

Also checked:

- **None of them begins on frame.** One that blinks into existence inside the
  picture reads as a glitch rather than as something passing through.
- **They are over in about a second** — 0.9 to 1.7 s.
- **A star begins and ends invisible**, and is brightest in flight. Not
  bit-exact zero: the fall-off divides 0.45 by 0.45 and lands a floating-point
  hair under one, leaving 1e-32 of alpha. The assertion is "invisible", which
  is the honest claim.
- **The gaps are Poisson, not a metronome** — mean 14 s, and never all equal.
- **The quiet outlasts the meteor shower.** The shower's own duration is read
  out of `MeteorShower.tsx` rather than copied, so lengthening the shower past
  the hold fails the build instead of quietly letting an ordinary streak cross
  the one day that was supposed to be special. With the hold cut to 3 s the
  check fails, so the margin is real.


## 31. The dawn is a countdown, the sky keeps its company, and two things do not move

Revision 7.1 added two scripts' worth of checks and one new script. They cover
the two things in r7 that a screenshot cannot settle.

### The dawn (section 9)

`lib/dawn.ts` is a single curve, and the whole revision hangs off it, so it is
checked against §3's table directly: f = 0, 0.25, 0.5, 0.75, 0.9, 1 must give
p = 0.20, 0.24, 0.37, 0.62, 0.83, 1.00 to within 0.01. Plus: it only ever
rises; it never goes below 0.2, so the sky is never night; a returned comet is
1 and a kept one is 0.7; and the sun's disc clears the horizon at p ≈ 0.47 in
both orientations.

That last one is the check that makes the exponent load-bearing rather than
decorative. With the curve linear, the sun would clear the limb around the
halfway mark of the wait and the final month would look like the first. At
`f^2.2` it clears in the last half, which is why a visit in the final fortnight
looks different from the one before it.

### The light (section 9b)

The key light is now the dawn, so what is asserted is the two ends and the
continuity between them: at blue hour the colour is within 25% of `#9fb8ff`,
on the day within 5% of `#ffe2b8`, the day is at least 1.6× as bright, and
stepping p across a thousand samples never moves the colour by more than 1%.

The **fill is never zero**, at any p, and always points exactly opposite the
key. That is the check standing in for a whole class of bug: a low, bright sun
with no fill turns the satellite's shadow side black, and a black satellite in
a warm sky is precisely the "one dark object" reading r7 exists to remove.

The three screens r7 leaves alone — landing, reading, closing — still get r5's
light, and the old assertions about it are unchanged. `keyLight` without a
`Dawn` *is* r5's function.

### The company (`verify-orbiters`)

Mostly about **time**, because a still frame says nothing about whether the sky
is still populated ten minutes later.

- **Two simulated hours**, sampled every ten seconds, across twelve seeds:
  the median number of visible objects must be at least 10 on a desktop and 6
  on a phone, and the tenth percentile at least 6 and 3. Without this, a set
  that looks generous on arrival can quietly empty out while someone reads a
  sheet.
- **Nothing darts.** The fastest on-screen speed, over twenty minutes of
  motion per seed, and the worst move in a tenth of a second.
- **Nothing passes through the planet**: every periapsis is at least 1.06
  radii, which is a property of the eccentricity draw rather than something
  clamped afterwards.
- **Nothing dwells on the satellite or under the caption**, checked at the
  apoapsis — the point each object spends most of its period near.
- **Every craft is in clear view at t = 0**, so the sky is never empty on
  arrival, and rocks are *not* checked that way, because their uniform phase is
  what keeps minute ten looking like second one.
- **Both sides of the planet occur** over twenty minutes. Without that the
  planet would never occlude anything and §8.4's whole reading — things
  passing behind the world on one side and in front of it on the other —
  would be gone while every other check still passed.
- **Nothing is ever put in front of the satellite**, over two hours per seed
  at both viewports. The check reports the closest approach as well as the
  count, and it is 0.00 half-edges — orbiters really do drift right across
  the satellite's span, so the rule is doing work rather than being
  vacuously true. Paired with it: the depth that rule resolves to is past the
  **whole** hull, not just its near face, because the hull is a long thin
  thing on a diagonal and an orbiter tucked between its front and back would
  flicker rather than read as depth. That second half is the one that can
  silently stop being true — the satellite's scale and the camera's distance
  are both solved from the composition.
- **The same seed gives the same set, and forty seeds give forty sets.**

One number in §15 is deliberately not taken literally. The speed limit of
12 px/s was measured in a mockup that draws the planet at 0.495 of the width;
this build draws it at 0.55, and an orbiter's screen speed is proportional to
the planet's screen radius, because the orbit is measured in planet radii. The
limit is scaled by that ratio rather than the period being changed — the
document's constants win over the mockup, and this is the one figure in §15
that is derived from the mockup's own composition.

### What these two added to section 11

The framing checks grew three assertions, all of which failed when first
written, and all for the same underlying reason — the planet was being drawn
at `hubPlanet + PLANET_CENTRE` rather than at `hubPlanet`:

- the comet's **whole tail**, sampled along its length, never reaches the
  satellite's hull. r7 points the tails away from the *sun*, which comes up
  behind the limb at the bottom right, so they now sweep up and to the left —
  which is where the satellite is;
- the sun, flare and all, is inside the frame on the day;
- the comet comes home **outside the planet's limb** and close to it, measured
  against the disc rather than against two hand-picked fractions. The old
  assertion went on passing while the comet came home behind the planet.

### Pinning what must not change (section 31)

Revision 7.1 is otherwise a licence to rework the whole orbit view, and it is
explicit that two things in it are finished: the satellite's place on screen
and its small movement, and the contrail. For those, *the build is the
reference*, even where it differs from revisions 5 and 6.

So section 31 is a **snapshot**, not a derivation: the satellite's body centre
and the contrail's whole polyline, in pixels, at the five framing sizes,
recorded at §14 step 0 and asserted to within a pixel. It is the only check in
the suite whose correct response to a failure is to ask whether the change
should have happened, rather than to update the numbers.

It was checked against a real change rather than assumed to work: nudging the
landscape composition's body centre from 0.47 to 0.48 fails it by 12.8 to 15.1
pixels across the three landscape framings. (Moving `HUB_SATELLITE` itself does
*not* fail it, and should not: `hubPose` solves the camera from that constant,
so the satellite's screen position is invariant under it. What the snapshot
pins is the composition as rendered, which is what the document is talking
about.)


## 32. Coming back from the trail is one move

The longest camera move in the product, and the only one that changes kind
half way through: it walks back along the trail's curve and then pulls out to
the orbit pose. That is exactly the move most likely to read as two moves
stuck together, and for a long time it was one — each half had its own
ease-in-out, so the camera stopped dead at the join and set off again.

Neither a screenshot nor a typecheck can show that. The path can: §32 samples
`retracePose` at 400 steps, differentiates it twice, and asserts two things
about the interior.

- **It never stalls** — the slowest step is more than a tenth of the fastest.
  The two-ease version scores 0% here, at both viewports, because the camera
  genuinely reaches zero velocity twice.
- **It never kicks** — no step differs from the one before it by more than 5%
  of the fastest. This is the check that the walk is paced by *arc length*:
  stepping the curve parameter at a constant rate instead puts a 10% jolt in
  as the camera crosses a control point, because the control points are not
  evenly spaced.

Both were confirmed against the old implementation rather than assumed:
restoring it fails the stall check at 0% and the kick check at 14.4% on a
phone and 7.9% on a desktop.

The check is only possible because the *shape* of the move was moved out of
`CameraRig` into `framing.ts`. What stayed in the rig is how long it takes.
