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

One environment variable belongs beside them: **`MAIL_DEV_SINK=1`** delivers
every email to `.mail/` instead of to Resend, so the reply rocket and the
comet can be tested end to end with no mail account. See below.

`?at=` accepts: `landing`, `face-1` … `face-6`, `closing`, `inside`, `orbit`,
`departure`, `chart`, `crossroads`, `trail`, `reply`, `trajectory`.

Without these, reaching the trail means six scrolls, a deployment and a
rewind — every time. Use them for everything except the run described under
*The one pass that has to be done properly*.

### The reply and the comet are invisible until mail is configured

This is the first thing to check when a button you are looking for is not
there, and it costs people an afternoon the first time.

Neither feature is a flag you turn on. The card offers each one **only if the
server could actually deliver it** (§14.7), so with no mail configured the
`返事を打ち上げる` pill simply is not in the bar and the comet sheet offers
nothing to write — which is correct behaviour, and indistinguishable from a
bug if you do not know the rule.

| Offered | Only when | Decided in |
|---|---|---|
| `replyAvailable` — the reply rocket | the card has a `reply`, **and** `mailReady(slug)` | `lib/clientCard.ts` |
| `capsule` — words on the comet | `comet.invite !== false`, **and** `mailReady(slug)`, **and** `cometReady()`, **and** the comet is still `away` | `lib/clientCard.ts` |

```ts
mailReady(slug)  // RESEND_API_KEY && MAIL_FROM && (CARD_NOTIFY_TO_<SLUG> || NOTIFY_TO)
cometReady()     // COMET_SECRET
```

`.env.local` ships with `MAIL_FROM`, `NOTIFY_TO` and `COMET_SECRET` set and
**`RESEND_API_KEY` deliberately absent** — it is the one value nobody can
generate for you. So out of the box both features are off. Paste a key from
the Resend dashboard, restart `next dev`, and both appear.

Two things that will waste your time otherwise:

- **Restart the server.** These are read on the server per request, but Next
  loads `.env.local` once at boot.
- **A shell that exports any of these wins.** Next does not override a
  variable that is already in the environment, so `.env.local` is ignored for
  that key. `unset RESEND_API_KEY` and start again from a clean shell. The
  editor's Setup chip is the fastest way to see what the server actually has.

#### The mail sink: no account at all

```console
$ MAIL_DEV_SINK=1 npm run dev
```

The rocket's flight and the comet's boarding are dispatched only on a 200 from
the route — deliberately, because the animation is a confirmation and not a
guess (§10.2). The honest consequence used to be that the two most elaborate
moments in the card were the two nobody could look at without a mail provider
behind them.

`MAIL_DEV_SINK=1` swaps the last hop and nothing else. The routes, the
gating, the templates, the rate limit, the honeypot and the sealed token all
run exactly as they will in production; only `sendMail` writes a file instead
of making a request. So what you are testing is the real thing with a
different postbox — and both features appear without `RESEND_API_KEY`,
`MAIL_FROM` or `NOTIFY_TO` set at all.

Each message lands in **`.mail/`** as plain text, named so they sort in the
order they were sent, and the path is printed in the terminal running the dev
server:

```
[mail sink] /…/.mail/2026-09-26T10-25-10-324Z--2026年のあなたへ-に返事が届きました.txt
```

Read them. It is the same text the sender will get, headers and all, which is
half the point of sending a test message — the line breaks, the comet link,
and the warning about not deleting the email.

`.mail/` is git-ignored. The sink is off unless asked for and refuses to exist
outside development, so it cannot reach production and quietly swallow the
messages the card exists to deliver.

Two things it does **not** cover. `COMET_SECRET` is still required — the token
has to be real, or the link in the email could not be opened on the day; use
`/editor` → Setup → Generate. And a sunk message never touches Resend, so a
verified domain, the account's test-mode restrictions and your provider's
own rendering still have to be checked for real before launch.

#### With a dummy key instead

A **dummy** `RESEND_API_KEY` and no sink is the other useful setup: both
features appear, both forms work right up to the send, and the send then
fails. It is the cheapest way to check the failure states, and they are the
ones nobody remembers to look at.

#### With a real key

While a Resend account is in test mode it will only deliver to the address
that owns the key, so `NOTIFY_TO` has to be that address or every send comes
back 502. An unverified `MAIL_FROM` domain fails the same way;
`onboarding@resend.dev` is Resend's own sender and works without verifying
one.

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
| The closing screen, a second time | the line and the signature draw at about 55% of the first time, and the two invitations arrive sooner to match |
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

**"Exactly as it was left" means the cube's attitude too.** Deploy, dock, and
look at the cube behind the closing line: it must be square-on to you, the same
face you were reading, not still sitting at the satellite's three-quarter angle.
This used to fail — the attitude was written as a step towards the deployed
pose, and a step cannot be wound back.

**Then deploy a second time.** The second trip out and the second trip home
both run at about 55% of the first — around 2 seconds instead of 3.6 — and so
does the sound under them. Watch that it is the *same* animation compressed:
two booms, six hinges landing one at a time, a thruster, a rise. If the panels
arrive together rather than in sequence, `REPLAY_SCALE` has gone too low.

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
| Rocks | one drifts past every half-minute or so, well behind the satellite, tumbling slowly. Never in front of it, never near it |
| Shooting stars | one every ~14 s, crossing the upper sky in about a second: bright head, tail tapering to nothing. Also on the landing screen and the trail — but never over a face, never inside the cube, never on the closing screen |
| Hover the satellite | `中をのぞく` fades in on it. Moving onto the button keeps it there; moving away hides it |
| Tap the comet | still works. The label's box is near it, and must never take the tap |

Sit in the hub for two or three minutes without touching anything. That is the
only way to judge the asteroids: the thing being tested is a *rhythm*, and any
single thirty-second window is as likely to be empty as not. What would be
wrong is a rock crossing in front of the satellite, one arriving close enough
to read as a near miss, or anything regular enough to be counted.

### The sky's age

The background is made from how long ago the card was sent, so the fastest way
to see it is `?now=`. Open the same card three times:

| | Should be |
|---|---|
| `?now=` the card's own `writtenAt` | dense, close gas with warmth in it — the card as sent |
| a year later | noticeably thinner and bluer, more stars showing through |
| five years later | thinner again, but only a little: the curve is asymptotic and the card never finishes |

Two things to check rather than admire. Consecutive days must be
indistinguishable — compare `?now=` on two adjacent dates and look for any
visible step. And the sky must never look *fresher* as the date moves forward.


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

**A full trail is worth building once.** The limit is 20 memories, and at the
limit they sit 2.9 world units apart against a 2.4-unit panel — comfortable,
but the tightest the card ever gets. Fill a card to 20 in the editor and walk
the whole thing: no two photographs should ever be in frame edge to edge, the
hops should still feel even, and the row of progress dots along the top should
fit without being clipped at either end. The arithmetic is checked
([verification §28](./verification.md)); what it cannot tell you is whether
twenty memories still feels like a journey rather than a list.

### The comet

The comet's **position is the countdown**. Far out and faint for most of the
wait, then swinging home fast in the last tenth with a growing tail.

Fastest way in: **`?at=chart`**. That plays the departure and lands on the
chart with the sheet open. Tapping `彗星` in the bar gets there too, and after
a deployment the card goes there on its own.

If the sheet offers only `軌道へもどる`, mail is not configured — see *The
reply and the comet are invisible until mail is configured* above.

| Step | Expected |
|---|---|
| Tap the comet, or `彗星` | the camera closes on it, holds, then pulls back to the chart |
| The chart | the ellipse, with the promise and its date as a caption above it — never inside the sheet |
| The sheet | the seal stated first: `みおの言葉がのっています。また会う日に、ひらきます。` |
| `言葉をのせる` | the sheet becomes a form: a name, and up to 200 characters |
| `もどる` | back to the question, with nothing lost |
| `彗星にのせる` | the words run up the orbit line to the comet, and it says `あなたの言葉は、彗星の上` |
| Afterwards | `言葉をのせました。` in warm ink, and `彗星の行方を見るリンクをコピー` — offered, never stored on their behalf |
| Return later | `あなたの言葉も、のっています。` — the same sheet, past tense dropped |
| `?now=2026-12-25` | the comet has arrived: `約束の彗星が、戻ってきました。` and the sender's words open |
| Open the link from the email | the words, readable, only on or after the return date |

The invite is **two steps on purpose** (mockup M13a, then M13b). Check that
`もどる` really does keep what was typed, and that closing the sheet from the
form does not leave the card believing anything was sent.

Try the link **before** the date. It must refuse. That is the entire promise of
the object.

### The trajectory (`?at=trajectory`)

The sky can only say *which* light is the comet. This says **when**, and it is
the third way on from the crossroads.

| Step | Expected |
|---|---|
| `彗星の軌道を見る` at the crossroads | the drawing, captioned with the return date |
| The ellipse | dashed, with the planet at a **focus** — not the centre |
| The three labels | `あなたの星` on the planet, `いま、ここ` on the comet, `また、ここで。` at the tick where it comes home |
| Once it has arrived | `いま、ここ` becomes `帰ってきました` |
| With their words aboard | the whole drawing is warm rather than ion-blue |

The dot is placed by the same `orbitDiagram` the small chart in the sender's
page uses, which is placed by the same `orbitPoint` the 3D comet flies. If the
dot in the picture and the speck in the sky ever disagree, one of those three
has been given its own copy of the maths.

### The reply rocket

Fastest way in: **`?at=reply`**, which opens the panel directly. Otherwise
`返事を打ち上げる` in the bar, or `ロケットで、返事を` at the crossroads.

No `返事を打ち上げる` pill in the bar means mail is not configured, or the
card has no `reply` block — see above.

`返事を打ち上げる` → up to 140 characters → the rocket rises, becomes a star,
and the star stays in the sky for the rest of the session.

The panel must say **what is being launched and where it goes** before the
button is pressed: `あなたの言葉をのせたロケットが、彗星を追い越して…に届きます。`
above the fields, and `彗星より先に、すぐに…へ。` under them. The button is
`ロケットを打ち上げる`, not a bare `打ち上げる`. There are two ways to send
something from this card and the only difference between them is speed, so a
verb with no object leaves the reader guessing which one they just chose.

The panel sits **high** rather than at the bottom, unlike every other one: the
planet's lit limb comes up into the bottom-right corner, and on a phone the
keyboard takes the rest. Worth checking on a real phone with the keyboard up.

To see the **failure** state without breaking anything, use a dummy
`RESEND_API_KEY`: the message must survive, no launch may happen, and
`うまく届きませんでした。もう一度お試しください。` appears *above* the button,
in place of `すぐに、みおに届きます。` — never below it, where it would be read
only after pressing send a second time.

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

`npm run verify` checks, among 26 sections: every face landing square-on, type
size and line counts at five viewports, the hub composition at four viewports
against revision 6 §3.1, the deployment's timing windows and self-clearance, a
57-transition walk of the state machine, the gate's normalisation and
precedence, the comet's seal and 32 ways of tampering with it, the email
templates as strings, that no passing rock can reach the satellite from any
seed, that the sky only ever ages, and the 8-point grid across every
stylesheet. See
[verification](./verification.md).

It does **not** check: that anything looks good, that any email is deliverable,
or that the whole thing holds together as one experience.

## When something is wrong

Capture, in this order: the URL including every query parameter, the viewport
size and orientation, whether reduced motion is on, the browser console, and —
for anything involving email — the terminal running `next dev`, where a failed
send prints the provider's own words.
