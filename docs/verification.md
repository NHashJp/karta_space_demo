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

## Bugs this has caught

| Bug | How it presented |
|---|---|
| `<Html transform>` scale off by 40× | text was a ~30px speck; found by reading drei's source, confirmed by the framing numbers |
| Camera framed the cube centre, not the face plane | cube filled 86% of the viewport instead of 55% |
| Fixed-pixel text panel | would have rendered at **9px on an iPhone** |
| `fitFontSize` rounding up | cost a character per line, added a whole line, overflowed the face |
| Face text revealed outside `reading` | card content drawn behind the title screen |
| Damping never reaching zero | materials would settle permanently at 99.9% opacity |

## Limits

This suite checks maths, not pixels. It cannot tell you whether the nebula
looks good, whether the rotation feels nice, or whether the type is beautiful —
only that the numbers underneath are right. Real-device QA (spec §31, phase 7)
is still a human job.

It also checks content, not delivery: it says nothing about the password gate,
the cookie, or the editor's write path, none of which are pure functions. Those
are covered by the reasoning in
[access and security](./access-and-security.md) and by running the thing.
