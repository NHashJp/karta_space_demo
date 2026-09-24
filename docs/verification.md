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

## Shaders

Separately, the GLSL is parsed with three's `#include` chunks resolved and its
injected prefix simulated, using `@shaderfrog/glsl-parser`. This catches
syntax errors and unknown chunk names, which would otherwise show up as a
blank scene with a console message that is easy to miss.

The parser is not a project dependency — it is installed in a scratch directory
when needed.

## v0.2 sections

The suite grew from six sections to twenty-one, plus a second script. Rather
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
| `verify-spacing` | the 8-point grid, across CSS and inline styles |

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
| The hull rotated about Y, the cube about three axes | wings drawn near-horizontal while the check reported −50°: it measured a construct, not the hull |
| Camera distance divided by the *world* span | the wing axis leans into the screen, so the satellite drew a tenth of the frame too small |
| The trail left unstaged at the world origin | rev 6 puts the satellite on that origin: the contrail came out of the middle of the spacecraft |
| The camera flew down the middle of the ribbon | 0.197u from the lens, pointed along its length — an additive white wedge over the whole frame |
| Memories spaced evenly in `u`, not in distance | hops of 5u and 50u on one card; the comment claimed even effort and the check measured `u` |

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
