# Testing

How to exercise every feature by hand, and what each one is supposed to do.

`npm run verify` proves the maths. It sends no email, opens no browser and
renders no pixel, so it cannot tell you whether the scene looks right or
whether your mail provider will accept a message. This document is the other
half, and it is a human job.

## Before you start

```console
$ npm run verify      # must pass before testing anything visual
$ npm run dev         # http://localhost:3000
```

Two cards ship in `config/cards.config.ts`, and they are deliberately different
shapes:

| Card | What it exercises |
|---|---|
| `/c/2026-newyear-7k2m` | everything — comet, reply, five memories, a secret line |
| `/c/thanks-sample-3f9q` | text only, no orbit: the v0.1 journey, unchanged |

The second card is not filler. **A card with no orbit must end exactly where
v0.1 ended**, and if a change to the satellite ever breaks the plain card, that
is the card that shows it.

Both are behind `CARD_PASSWORD` in `.env.local` (`hoshizora` as shipped).

### The three query parameters that make this practical

Development only — all three are inert in production, and verify checks that.

| Parameter | Does | Example |
|---|---|---|
| `?at=` | jumps straight to a state | `?at=trail` |
| `?now=` | moves the clock | `?now=2026-12-25` |
| `?visit=` | pretends this is a first / repeat / already-written visit | `?visit=sent` |

`?at=` accepts: `landing`, `face-1` … `face-6`, `closing`, `inside`, `orbit`,
`departure`, `chart`, `crossroads`, `trail`, `reply`.

Without these, reaching the trail means six scrolls, a deployment and a
rewind — every time. Use them for everything except the run described under
*The one pass that has to be done properly*.

## What each feature is supposed to do

### The gate

| Step | Expected |
|---|---|
| Open `/c/2026-newyear-7k2m` with no cookie | a password field, **and nothing of the card** |
| View source on that page | no title, no message text, no image paths |
| Type `HOSHIZORA`, `hoshizora `, `ほしぞら` | all accepted — case, spaces, hyphens and kana width are normalised away |
| Type it wrong eleven times | refused — ten attempts per slug per IP, per ten minutes |
| Wrong slug | the same page as a wrong password, never "no such card" |

The content-withholding one is the important one: the page is a server
component that returns the gate *instead of* the card, not the card with a
cover over it.

### The card: landing → six faces → closing

| Step | Expected |
|---|---|
| Landing | title, subtitle, one button. The trail is faintly visible behind it |
| Open | camera dollies in, face 1 squares up, text fades in **after** it lands |
| Scroll / swipe / arrow keys | one gesture = one face. A fast flick still moves exactly one |
| Every face | the cube lands perfectly square-on, text upright, never clipped at the frame edge |
| During a turn | input is ignored; text is not readable mid-rotation |
| Past face 6 | camera pulls back to the closing screen |
| Scroll back in | returns to face 6, not face 1 |
| At face 1, scroll back | nothing. There is no face 0 |

Text must never be legible outside `reading`. If you can read a paragraph on
the landing or closing screen, that is a bug regardless of how it looks.

### The inside of the cube

From the closing screen: `この立方体には、内側があります。` → `中をのぞく`. The
camera passes *through a wall*, and one line is written inside.

It must be attached only once the camera has arrived — not readable on the way
in — and the same control brings you back out. Reachable directly at
`?at=inside`. The second card has a secret line too, so this works on a card
with no orbit.

### The deployment

`この手紙には、続きがあります。` → `軌道へ送り出す`.

The cube turns, two booms telescope out of its ±X faces, and three panels per
wing unfold like an accordion — root to tip, the near wing a beat behind the
far one — then a thruster flashes and it rises. About 3.6 seconds.

| Watch for | Should be |
|---|---|
| A panel passing through the body, or through another panel | never, at any point in the timeline |
| The wings appearing before the booms | never — they grow out of the face centres |
| Six soft clicks | one per panel as it locks |
| Docking (`手紙に戻る`) | the same timeline backwards, landing exactly on the closing screen as it was left |

**Jump straight to `?at=orbit` and check the cube actually became a satellite.**
This used to fail: the transformation only ran while the deployment was
animating, so arriving by jump left a cube in orbit.

### The hub

The composition is specified to the number, so it can be judged rather than
felt. On a phone in portrait:

- the satellite's body sits at about 44% across, 55% down;
- its wings run lower-left to upper-right on a −50° diagonal, tip to tip about
  four fifths of the screen width;
- the near wing is the upper-right one **and the larger one**;
- the planet is an arc in the bottom-right, covering a tenth of the frame;
- the comet passes in the top-right, well clear of the satellite;
- the contrail leaves from the upper-left.

| Watch for | Should be |
|---|---|
| The satellite | holding its place, with a slow drift — it does not circle the planet on screen |
| Speed | streaks sweeping past the lens. The scene should not feel parked |
| The planet | rotating, lit from one side, never covering the satellite |
| Rotate the device | the composition re-solves; nothing falls off the edge |

### The trail of memories

`航跡をたどる` from the orbit bar, or `?at=trail`.

| Step | Expected |
|---|---|
| Entering | the camera leaves orbit and joins the trail at the **newest** memory |
| Scrolling forward | further *back* in time, each memory the same distance of travel as the last |
| The ribbon | sweeping past to one side, never through the lens, never a white wash |
| Each memory | square in frame, its caption below, the frame tinted the trail's own colour at that point |
| Leaving | the camera **retraces the curve** back to the near end, faster than the way out, then pulls up to orbit |
| At either end | still a way out. Nobody may be stranded |

The two failures to look for: a white wedge across the frame (the camera inside
the ribbon), and hops of wildly different lengths (spacing by curve parameter
rather than by distance). Both have happened.

### The comet

The comet's **position is the countdown**. Far out and faint for most of the
wait, then swinging home fast in the last tenth with a growing tail.

| Step | Expected |
|---|---|
| Tap the comet, or `彗星` | the camera closes on it, holds, then pulls back to the chart |
| The chart | the full ellipse, the date, and how many days remain |
| `彗星に託す` | a form: a name, and up to 200 characters |
| Send | the words run up the orbit line to the comet, and it says `あなたの言葉は、彗星の上` |
| Afterwards | `彗星の行方を見るリンクをコピー` — offered, never stored on their behalf |
| `?now=2026-12-25` | the comet has arrived: `この彗星は、約束を果たしました。` |
| Open the link from the email | the words, readable, only on or after the return date |

Try the link **before** the date. It must refuse. That is the entire promise of
the object.

### The reply rocket

`返事を打ち上げる` → up to 140 characters → the rocket rises, becomes a star,
and the star stays in the sky for the rest of the session.

Check the email arrives with line breaks intact. A newline in the *message* is
a paragraph; a newline in the *name* would be header injection, and the two are
cleaned separately.

### Reduced motion

Turn on "reduce motion" in the OS. The scene should stay **fully legible and
stop moving**: the sun freezes, stars stop drifting, the camera stops breathing,
speed streaks do not draw at all, and the dolly shortens to 300 ms. Nothing
should become unreachable.

### The editor

`/editor`, development only — every route refuses in production.

| Step | Expected |
|---|---|
| Setup chip | a tick per variable, secrets as ticks only, the two mail **addresses** shown in full |
| Generate | writes a secret to `.env.local` only if absent, and never returns it |
| Edit and save | rewrites `config/cards.config.ts` whole, header included |
| An invalid card | errors block the save; warnings do not |

If the Setup panel disagrees with `.env.local`, the shell that started the
server is exporting that variable — Next does not override what is already in
the environment.

## The one pass that has to be done properly

Once per release, on a real phone, with no query parameters: open the card from
the URL, pass the gate, read all six faces, go inside, deploy, look at the hub,
walk the whole trail and come back, send a comet, send a reply, and dock.

Everything above can be checked in pieces. This is the only way to find out
whether it is *one thing* — and that is the entire product.

## What is already covered, and need not be re-tested by hand

`npm run verify` checks, among 21 sections: every face landing square-on, type
size and line counts at five viewports, the hub composition at four viewports
against revision 6 §3.1, the deployment's timing windows and self-clearance, a
57-transition walk of the state machine, the gate's normalisation and
precedence, the comet's seal and 32 ways of tampering with it, the email
templates as strings, and the 8-point grid across every stylesheet. See
[verification](./verification.md).

It does **not** check: that anything looks good, that any email is deliverable,
or that the whole thing holds together as one experience.

## When something is wrong

Capture, in this order: the URL including every query parameter, the viewport
size and orientation, whether reduced motion is on, the browser console, and —
for anything involving email — the terminal running `next dev`, where a failed
send prints the provider's own words.
