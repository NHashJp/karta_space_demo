# The orbit

Source: `lib/experienceState.ts`, `lib/deployment.ts`, `lib/cometOrbit.ts`,
`lib/trailCurve.ts`, `components/three/`, `components/card/`

## What v0.2 is for

v0.1 was a letter you could read. It ended, well, at the end.

v0.2 asks a different question: *what happens after the last face?* The answer
is not more content. It is that the letter turns out to be **an object that
keeps going** — it unfolds into a satellite, takes up an orbit, and carries
things that will come back on dates you can know in advance. The point is not
the feature list. It is that when the receiver closes the card, the story has a
future in it.

## The journey

```
landing → six faces → closing screen
                         │
                         │  この手紙には、続きがあります。
                         ↓
                      deploying ── the cube becomes a satellite
                         ↓
                       orbit ─────────────────────────────┐
                    ╱    │    ╲                           │
              satellite  trail  comets                    │ 手紙に戻る
                    ╲    │    ╱                           │
                         └────────────────────────────────┘
```

Every branch is optional. A card with none of them ends exactly where v0.1
ended, and the state machine proves it: with `hasOrbit` false the new events
are no-ops and the v0.1 journey still walks the same 57 transitions.

## Why each thing is the thing it is

### The cube becomes a satellite, rather than opening a menu

The closing screen could have grown three buttons. Instead the object you have
been reading *turns into* the thing that carries the rest — panels out, thruster
lit, up onto an orbit — because that is the one moment that says "this
continues" without a word of explanation. It is the most expensive animation in
the product and the most load-bearing.

Docking plays the same timeline backwards, which is what guarantees the closing
screen comes back exactly as it was left. See
[cube and motion](./cube-and-motion.md).

### The trail runs backwards in time

Memories are read newest first, receding into the distance. Forwards is
*further back*, which is the opposite of a gallery and the point of a contrail:
you are following where something has been.

Either end returns to orbit rather than stopping dead. Nobody should be
stranded at the far end of someone else's memories with no way out but the
browser's back button.

**Every move along the trail follows the curve**, and so does the way back. The
camera never interpolates between two memories in a straight line through
space: `poseOnTrail(u)` walks the curve parameter, so the path it takes is the
trail's own shape. Leaving the trail *retraces* it — the camera runs `u` back
down to the near end over the first 72% of the move, then pulls out to orbit —
and it does so much faster than the way out, about 320 ms per memory against
1100 going forward. Cutting straight home would throw away the one thing the
reader has just learned about this card: what its trail looks like.

The colours drift — two to four of the palette blending along its length, any
one point taking 20–40 seconds to become another colour. It should never be
*caught* changing. Each card's trail has its own colours and its own bend, both
seeded from the slug.

### How many memories fit, and why that is a measurement

Twenty (`MEMORY_MAX`), up from the spec's twelve.

The number is not a taste. The curve's length is fixed and memories are spaced
along it by distance travelled, so each one added brings all of them closer
together: 5.2 world units apart at twelve, 2.9 at twenty, and 2.4 at
twenty-four — which is the panel's own width, the point at which two adjacent
photographs touch edge to edge. Twenty leaves a fifth of a panel of daylight
between them, which is the least that still reads as separate moments rather
than as a strip.

A deliberate departure from §5.1's `1–12`, recorded rather than quietly made,
and the one that makes it safe is [verification §28](./verification.md): the
gap is measured against the panel at the limit, on the shortest trail the
seeding can produce and on the tightest-spaced shapes a search can find. Raise
it again without the trail being able to hold it and the build says so.

### The trail is staged, not placed

`trailControlPoints` gives a curve that knows nothing about the screen: it
starts at the world origin and recedes. Revision 6 parks the satellite at that
same origin, so drawn as-is the first stretch of the contrail came out of the
middle of the spacecraft — a real bug, and a very visible one on a phone.

`stagedTrail(seed, width, height)` puts that curve where §4.5 wants it: leaving
from the upper-left, clear of the satellite, receding to the top of the frame.
It does that by projecting **both** screen targets back into the world at their
own depths and using the line between them as the spine, keeping the card's own
wander as an offset around it. Picking an angle instead does not work: a line
that simply recedes converges on the centre of the frame, and the centre of the
frame is where the satellite is.

Everything that touches the trail asks `useStagedTrail` for it — the ribbon,
the memory panels hanging off it, and the camera that drives it — rather than
one of them building it and handing it to the others. It is pure in the seed
and the viewport, so they cannot disagree, and none of them can be left holding
a curve from before the last rotation.

### The trail is flown beside, not down

The camera used to back straight off along the curve's own tangent, which put
it *on* the ribbon: the centreline passed two tenths of a unit from the lens,
with the camera pointed down its length. Additively blended, a strip that close
stacks into a white wedge across the whole frame, and the memory behind it is a
wireframe in fog. Every segment was individually correct; the sum was not.

`trailPose` flies seventeen degrees off the axis — to one side and a little
above. The ribbon then sweeps past the corner of the frame and away to the
vanishing point, which is both legible and the thing that says *you are moving
along something*. It costs 4% of the panel's width to foreshortening. The
ribbon also fades within 2.6 units of the lens, so no camera position can bring
that failure back.

Memories are spaced by **distance travelled**, not by curve parameter. The
curve's z is quadratic, so even steps of `u` put the first two memories five
world units apart and the last two fifty — one scroll barely moved you and the
next threw you a third of the way down the trail. The old code spaced `u`
evenly and its comment claimed even effort; the comment was aspirational.

### Speed is drawn, not simulated

A satellite that holds its place on screen is the right picture and the wrong
sensation: nothing in the frame moves, so nothing says the thing is travelling.
The station-keeping drift and the turning sky are both true and both far too
slow to read as motion.

`SpeedStreaks` is the cue — short streaks sweeping past the lens, where the
*length of the streak is the speed*. It appears only in the hub and on the
trail, never where a letter is being read, and its opacity is the speed itself,
so a still scene is a still scene. On the trail the rate is measured from how
far the camera actually moved last frame, which is the one way a streak field
can never disagree with the motion it describes.

### The satellite is a promise, not a calendar entry

One date, one line, and then: *{from} will be in touch.*

There is deliberately no "add to calendar" button and no reminder to the
receiver. A card that put a date in someone's calendar would be asking **them**
to keep the promise. This tells them it is being kept for them — and the daily
job emails the *sender* on the day, so it actually is.

### The time capsule is a comet

A sealed message needs to say two things at once: *you cannot read this yet*,
and *you will be able to, on a date you can know*. A padlock says only the
first. A message into deep space never comes back at all.

A comet does both, and its **position is the countdown**. Real Kepler motion
spends most of the wait far out and faint, then swings home in the last tenth
with a growing tail — so for months it is a speck you have to look for, and in
the final weeks it is unmistakably coming back. Nobody has to read a number to
feel that the day is near.

Both people can send one. The sender's is ion-blue, set in the config, and
already on its way when the card is first opened. The receiver's is warm,
released from the orbit view, and goes to the sender as a link. See
[messaging](./messaging.md) for what that link is and what it costs.

### The reply meets the letter

The rocket pauses beside the satellite for a moment before going on. That pause
is the animation: without it, something is being fired into space; with it, the
reply visibly meets the letter that prompted it.

It plays **only after the server has accepted the message**. The animation is a
confirmation, never a guess — if the send fails there is nothing to confirm,
and the panel says so instead.

## Composition (revision 6, and what revision 7.1 changes)

| Object | Where |
|---|---|
| The cube | a small tilted ellipse, 2.9 × 2.1, near the middle of the frame, one lap every 48 s |
| Orbit ring | one hairline at 18% — without it the cube is a wandering speck |
| Planet 「あなたの星」 | radius 2.9, down in the lower-right and deliberately cropped, turning once every two minutes |
| Trail | a curve from just behind the ring out to z ≈ −70 |
| The comet | wherever its dates put it, on an orbit tilted 22° off the cube's |

**This departs from the spec's §8.9, on purpose.** There the planet is centred
and low and the cube rings it — which put the planet in the middle of the frame
and, because the orbit's semi-minor axis (2.6) barely cleared the planet's
radius (2.2), sent the cube *through* the planet's disc twice a lap.

So the two are separated. The **cube is the subject**: it travels a small
ellipse near the middle, where the eye already is. The planet is scenery —
larger, further away, in the corner, turning visibly. They move alongside each
other rather than one around the other.

Two consequences worth recording:

- `orbitSamples()` frames **the cube's orbit only**. Framing the planet as well
  pushed the camera from 15 units back to 41 on a phone, which made the subject
  a speck. The planet is instead *placed* so this frame crops it: its upper-left
  arc rises into the lower-right corner, which is how a planet you are near
  actually looks. Verify checks its near limb is still in frame, and that it
  stays below and right of the camera, so "planet in the corner" cannot quietly
  become "no planet".
- `orbitClearance()` is a checked number, currently **2.76 units**. The two
  objects shared a centre once and the result was a cube falling into a planet;
  a positive clearance is what stops that coming back.

The planet turns once every two minutes rather than §22's twenty. Twenty
minutes is right for a planet you are standing on and wrong for one you look at
for ninety seconds — at that rate nothing visibly moves.

## Dawn, and company (revision 7.1)

Revision 6 got the composition right and the feeling wrong. One dark object,
holding still, in a cold empty sky, after something had ended: every line of
it correct and the whole of it reading as *after*. A card whose entire subject
is two people looking forward to meeting again cannot look like that.

Revision 7.1 fixes it with **light** and **company**, and — this is the part
worth copying — by changing almost nothing that already worked. The satellite
keeps its design, its place on screen and its small drift. The contrail keeps
its geometry, colour and head. For those two, **the build is the reference**,
even where it differs from the earlier documents. What changed is the light
falling on them, and what else is up there with them.

### The countdown is the sunrise

`lib/dawn.ts` turns the comet's progress into one number, `p`, from 0.2 to 1,
and everything in the scene is a function of it: the key light's colour and
intensity, the sky's gradient, the warm haze, the width of the planet's
crescent, the height of the sun, the brightness of the orbiting things, and
the cutoff of the ambient chord.

Two properties make it a countdown rather than decoration.

- **It is never night.** `p ≥ 0.2` from the first visit, so nobody ever opens
  the card to revision 6's cold sky.
- **It accelerates.** `p = 0.2 + 0.8·f^2.2` puts most of the change into the
  last quarter of the wait — which is exactly what the comet's own Kepler
  motion does. Two visits in the first month look nearly identical; two visits
  in the final fortnight do not.

It is a function of a *date*, not of motion, so reduced motion still computes
it in full. The sky a reader opens is the sky of the day they open it.

### The limb is the planet

The most dramatic thing in the orbit view is a line about two pixels wide.

§6 draws the planet's air three times over — a haze 0.03R wide, a tight glow,
and a 1.2 px line — with a **conic gradient** about the sunrise: cream-white
where the sun is coming up, through gold, into cyan, out to the deep blue of
atmosphere seen at a shallow angle. That one arc is what makes a mostly-black
disc read as a world rather than as a hole in the sky, and it is what the eye
goes to first.

Revision 6 drew the air as a fresnel shell — a slightly larger sphere, back
faces, additive. That can produce one soft band of one colour and nothing
else: the gradient would have to be recovered from a surface normal near the
silhouette, where that normal is least reliable, and a shell 14% thicker than
the planet cannot draw a line a pixel wide at any viewport.

So the air is a **ring facing the camera**, in the disc's own plane, in planet
radii. The conic gradient is then a bearing from the centre, which is exactly
how §6 writes it; the three passes are three Gaussians on one radius; and the
aurora can stand off the limb on the night side, where it actually is. It is
drawn at the planet's depth with depth testing on, so the satellite still
passes in front of it.

### The panels catch the light

Revision 6 gave the solar arrays a specular glint and expected the sun's own
drift to sweep it across them every couple of minutes. It never fired once.
The satellite holds station, the sun's wobble is ±3°, and a `pow(·, 68)` lobe
is a few degrees wide — the angles essentially never line up, so the arrays
were dark glass for the whole visit.

So r7 §5's sweep is **driven**. A narrow pulse crosses the six panels in turn
on a nine-second cycle: each flashes for about a third of a second, and there
are four seconds of quiet before it comes round again. It is capped at
`0.06 + 0.14 · p` and added rather than substituted, so the cell grid is
still there underneath — §5 is explicit that it must never wash a panel out.

Each panel needs its own place in the queue, so the six share every uniform
holder except `uIndex`, and that index is the panel's position *across* the
satellite rather than the order the wings are built in: light sweeps across a
thing, and the outer panel of the left wing is the leftmost of the six, not
the third.

It is the only thing in the hub that is briefly, deliberately bright, and it
is what stops the satellite reading as a dead object. Hardware in sunlight
catches the light; a thing that never catches the light is a thing that is
not there.

### The planet is lit from a point on its own limb

The usual way to light a sphere is N·L against a sun direction, and it cannot
draw this picture. The sun sits *on the visible limb*, and the arc of this
planet the composition shows is the same arc the sun is on — so hemisphere
lighting lights all of it, and you get a daylit ball, which is the image r7
exists to replace. §6 does not describe hemisphere lighting. It describes a
radial wash from a point on the limb, widening as the sun rises.

So `planetSunDisc` returns a **position on the disc**, in planet radii, and
the shader works in the disc's own screen space: the night radial, the
crescent wash, the city lights that fade where it is already day. The
coastlines are still under it, dark, to put the cities on.

The crescent is **composited, not added**, and that one word is the whole
look. Adding it lifts the entire visible arc towards grey — because the sun
sits on the limb, almost all of the planet you can see is inside the wash —
and the result is a pale ball. Mixing towards the wash colour instead leaves
the night side at the night colour and lights only the sliver at the
sunrise, which is the high-contrast reading the scene is composed for.

This is the same move the rest of the composition already made — see *the
scene is composed backwards from the screen* — applied to shading.

### Company, on real orbits

`lib/orbiters.ts` puts thirty small things around あなたの星: tiny satellites
blinking, a station catching the sun, tumbling rocks and a far moonlet. Three
decisions carry the effect.

§8.1 also lists a **paper set** — a paper crane and two paper planes — and it
is not in the build. r7 calls it "the playful one" and makes it switchable
precisely because it is a different kind of object from everything else up
here: the rest are spacecraft and rocks, on orbits, in vacuum, and origami is
a thing from the other world entirely. Next to the satellite, which *is* the
letter, it read as decoration rather than as company — which is the one thing
R30 is trying not to be. Dropped rather than switched off, so there is no
dead shape code waiting to be re-enabled by accident.

**The orbits are real Kepler ellipses**, seen nearly edge-on. That means every
object *slows and turns* out in the sky where you can see it and *falls away
fast* past the planet. A thing moving at constant speed across a frame reads
as a sprite on a path; a thing that hangs, turns over and drops reads as being
in orbit. It is the only reason the module solves Kepler's equation instead of
interpolating an ellipse.

**The apoapsis is picked on screen first**, and the orbit is solved through
it. An orbit chosen in space puts its slow, legible part wherever the geometry
happens to — usually outside the frame.

**Nothing darts.** Periods are 7 to 14 minutes, so the median speed on screen
is about 5 px/s. You cannot watch one of these move; you can look away and
look back and find it somewhere else, which is the pace of a sky.

Each card's set is seeded from its slug, so two cards are visibly different
skies and one card is the same sky every time.

Depth does one job and only one. Each object is placed on the hub camera's ray
through its pixel and pushed along that ray to a depth — so the depth never
changes *where* it appears or how big it is, only *what covers it*. No sorting
code, no render-order tricks.

**Nothing passes in front of the planet or the satellite.** §8.4 allowed both:
the near leg of each orbit crossed in front of the planet, and the closest
orbits crossed the satellite as well. Both fail for the same reason. A cubesat
eleven pixels across, or a rock of five, drifting over a planet that fills a
corner of the frame or a satellite that spans a third of it does not read as
*nearer* — it reads as a small thing stuck to the glass, because nothing else
in the picture supports that scale. The foreground is the letter and the world
it circles; the company is always beyond them.

What replaces it is better anyway. Things now pass behind the planet's limb
and out the other side, which is what moons do, and the planet is the one
occluder left out in the sky — so it is the thing that makes the orbits read
as orbits rather than as a flat field of drifting specks.

It costs **one** depth rather than three, and that falls out of the
composition rather than being arranged. The planet is staged much closer to
the lens than the satellite is — on a desktop it occupies depths 0.5 to 4.9
and the satellite 5.2 to 7.7 — so a single depth past the back of the
satellite's hull is past the planet as well, and the depth buffer does the
rest. Past the *back* of the hull, not its near face: the hull is a long thin
thing on a diagonal, and an orbiter tucked between its front and back would
be hidden in some places and not others as it drifted, which reads as
flickering rather than as depth.

It also costs objects. Hiding everything over the planet's disc rather than
half of it thinned the visible sky from a median of eleven to nine, under the
density §15 measures for — so the mix gained a cubesat and three rocks to make
it back up. What that check is really protecting is how full the sky looks,
not how many things are in it, so the right answer to taking visibility away
was to put objects back.

All thirty are drawn in **three meshes**, rebuilt on the CPU each
frame — about nine hundred vertices, which is nothing — rather than in three
hundred little ones, which would cost more draw calls than the rest of the
scene put together.

### Portrait is its own composition

r6 drew the satellite at 0.81 of the width, tip to tip, on a phone. That is
inside every margin the checks ask for and still too much: the hull spanned
16% to 79% of the width, its panel corners a finger's width from both edges,
and everything else in the scene — the planet, the comet, the things in orbit
— had to fit in what was left.

It is 0.74 now. The satellite is still unmistakably the subject and there is
sky around it for the rest of the view to be in. Landscape is untouched;
this is a portrait decision, made looking at the two side by side at phone
size. The kept-as-built check (§31 in the verify suite) caught the change,
which is exactly what it is for — the right response was to decide it rather
than to discover it later.

### Coming back from the trail is one move

The return from a memory to the hub is the longest camera move in the product
— up to three seconds — and the only one that changes kind half way through:
it walks back along the trail's curve, then pulls out to the orbit pose. Four
separate things made it read as a lurch rather than a journey.

**It stopped in the middle.** Each half had its own ease-in-out, so the camera
decelerated to a complete standstill at 72% of the way home and then
accelerated out of it. (The branch also ignored the eased parameter the rig
had already computed, so the move had no overall easing either.) The two
motions overlap now: the walk runs the full length of the move and the
pull-out blends in over the tail with a smoothstep — zero slope at both ends,
so the second motion arrives without a corner and the first never has to stop
for it.

**It kicked as it crossed the curve.** The trail is a uniform Catmull-Rom over
control points that are not evenly spaced — its depth progression is
quadratic, so at the far end one step of `u` is nearly ten times the length of
one at the near end. Walking `u` at a constant rate therefore surges and slows.
`memoryU` already spaced the memories by distance for exactly this reason;
`evenU` now does the same for the journey between them. It changes nothing
about what any `u` *means*, so the memories and the ribbon are where they
were — only the pacing in between.

**Three things appeared out of nowhere.** The camera phase becomes `orbit` the
*moment* the reader asks to come back, not when they arrive — so anything
mounted on that phase popped into existence while the camera was still down on
the curve. The trail's sway snapped from nothing to full in one frame, and the
sun and the signal pulses blinked on. The sway ramps over about a second now,
and the sun and the pulses fade like the orbiting things already did.

The shape of the move lives in `retracePose` in `framing.ts` rather than inside
the rig, so the verify suite can sample it: §32 walks the path at 400 steps and
asserts the camera never stalls and never kicks. Reverting either fix fails it
— the two-ease version scores 0% on the stall check at both viewports.

### The bar is one row

Four pills on two rows was a phone decision that had leaked onto every screen:
the row was capped narrower than the viewport so that it would break at the
same place on every handset rather than at whatever width the labels happened
to reach. That cap is right on a phone and wrong everywhere else — on a
desktop it turned a single quiet strip under the scene into a two-storey block
of chrome in the bottom of the frame. The cap now applies below 600 px only.

### What revision 7.1 found already broken

Two defects that §14's step 0 asks to fix before anything is added, both of
which had survived because every check measured the *intention* rather than
the thing on screen.

- **The planet was drawn in the wrong place.** `OrbitScene` positioned it at
  `hubPlanet(w, h)` and `Planet` then positioned itself at `PLANET_CENTRE` as
  well, so it was drawn at the sum: about 40% further out and a third of the
  size the composition asks for. Nothing caught it, because the framing checks
  all projected `hubPlanet` — where the planet is *meant* to be. Revision 7.1
  is what made it matter: the sun, the crescent, the city lights, the aurora,
  the signal pulses and every orbiting thing are placed from the planet's
  screen disc.
- **The comet read as a pale oval.** Its head was floored at about forty
  pixels so it could be found among fifteen hundred stars, and §10's tail is
  forty-nine pixels long for most of the year — so the tail spent eleven
  months inside the head. There is now always a tail, and a tail is a far
  better way to find a comet than a bigger blob, so the head went back to
  about a third of the tail's length.

Moving the planet to where it belongs also pushed the comet's homecoming
*inside* the disc, so the comet came home by disappearing behind the world it
was returning to — and the check that was supposed to catch that was written
as two hand-picked fractions, which no longer meant "beside the planet". It is
now measured against the disc itself.

### The human check

§16 asks for one: show the orbit view to three people who have not seen it,
without explanation, and ask for one word. None should say "lonely", "sad" or
"empty".

> Not yet run. Record the three words here when it is.

## The satellite leaves as one object

Its materials have very different opacities — the cube's glass at 0.34, the
wires and the array's grid at 0.94, the booms and the mast at 1 — and when it
stows for the trail they all have to go at once.

**Dimming multiplies; stowing caps.** On the closing screen the satellite is
still an object, just further back, so the brighter parts should stay
brighter. On the way out it is leaving. Scaled by one multiplier the ratios
survive to the bottom, and at the point where the cube has faded past noticing
the metalwork is still three times as opaque — which looks exactly like the
wings outliving the thing they are bolted to. A ceiling collapses the
difference instead. `lib/satelliteFade.ts` has the rule and verify §20 holds
it.

Two separate bugs produced that same symptom, a month apart: first the booms,
mast and panel outlines were not `transparent` at all, so the fade could not
reach them; then lightening the cube for the mockups widened the gap between
the faintest material and the rest. The second is the instructive one — it was
a change to a colour, and nobody re-tests a fade after changing a colour.

## The chrome, from the mockups (M5, M12–M14, M8, M9)

The orbit view's interface is built from two shapes and nothing else.

**Glass.** One recipe — `--glass`, `--glass-edge`, `--glass-shadow`,
`--glass-blur` — for every sheet and panel: the comet sheet, the crossroads,
the reply form. They are the same object seen in different places, and the eye
notices immediately when the blur or the border disagree between them. Each
one opens with a small letter-spaced label and a ✕, and no rule under it —
except the form panels, which carry a hairline so the prompt does not read as
the first field's label.

**Pills.** The bar, the sound toggle and the social icons are all a 48px pill
or circle with `--chrome-fill` behind them and an 8px blur. The fill is not
decoration: the planet's lit limb comes up into the bottom-right corner, and a
transparent control disappears into the bright half of the frame.

Three placement rules fall out of the composition rather than out of taste:

- **Panels sit at the bottom**, because the sky is the top two-thirds and a
  centred box lands on the subject of the screen it belongs to. A panel with a
  *form* in it sits high instead (`place="high"`), clear of the planet and of
  the keyboard.
- **The bar wraps to two rows**, capped at 358px so four pills break in the
  same place on every phone rather than at whatever width the labels reach.
- **The chrome hides while something is being asked.** `:has(.panel-layer)`
  fades the bar, the tip and the aboard chip out. The glass is translucent by
  design, and four pills reading through a sheet that is itself offering two
  choices turns one question into six.

### Three ways into the cube

The label on the satellite — `中をのぞく`, or `手紙を読みかえす` when nothing is
written inside — is the only route from the hub into the cube. It appears when
the reader **hovers the satellite**, when they **tab to it**, or after **twenty
seconds of stillness**.

**Hover was written but never worked.** The rule was `.orbit-ui:hover`, and
`.orbit-ui` is the full-screen overlay with `pointer-events: none` on it, so it
could never match a hover on any screen — the label was unreachable with a
pointer, and the twenty-second hint was in practice the only way in. Hovering
now works because the label's own box takes pointer events and is the thing
being hovered, which is also the better reading of it: it names the object
under the cursor rather than appearing because the cursor is somewhere on the
page.

**The box is the satellite's body, not its span** — half of tip to tip
(`hubLabel`, `LABEL_SHARE`). A box that accepts hover also swallows clicks
inside it, and the comet is the one thing in the scene that *is* clickable. At
full span the two overlap on a tablet. See
[verification §27](./verification.md).

**Hover is off while a panel or a sheet is up**, and the rule is written not to
match rather than relying on the rule that hides the label — `body:has(...)` is
weaker than a `:hover` and would simply lose.

**Twenty seconds of stillness** (`ORBIT_IDLE_HINT_MS`, `useIdle`) is the third
way, and the only one a phone has. It goes away again on the next movement,
scroll or keystroke. Three things about it are deliberate:

- **Twenty seconds, not five.** Early stillness is someone taking the sky in,
  and interrupting that is worse than not helping. Stillness long enough to
  mean *I cannot find what to do next* is the only stillness worth answering.
- **Not while a panel is open**, because the panel is already asking for an
  answer and this would be a second thing competing with it.
- **It fades in over 1200ms rather than the 600ms hover uses.** Something the
  reader asked for should arrive at once; something that arrives unbidden
  should not appear to flick on.

It is a hint, not a timeout: it points at a button that was always there, and
nothing happens if it is ignored. The button is keyboard-reachable too — it was
`tabIndex={-1}` on the assumption that the bar offered the same thing, and the
bar offers the letter, which is a different place.

## The sky ages with the letter

A card is sent on one day and read on another, and often on several others —
a week later, the following spring, a year on. Every one of those readings
used to look identical, which quietly said that nothing had happened in
between. The one thing the card knows for certain about the gap is how long it
is, so that is what the background is made of.

Fresh, the gas is close and dense and still warm from the planet it left.
Later it has thinned, cooled towards the blue end, and more of the deep field
shows through it. Nothing is added or taken away: it is the same sky, further
out. Four numbers carry it, all decided in `lib/skyAge.ts` and nowhere else —
how much gas there is, how much of the warm half of the palette survives, how
bright the starfield is, and the two body colours.

**Which date.** `writtenAt`, the sender's own statement of when this was sent,
which is already printed on the landing screen — so the sky and that line
cannot disagree. Without one it falls back to the comet's `leftOn`, the day
you parted, which is the same instant by another name. A card with neither is
simply a fresh sky forever.

**A half-life, not a deadline.** Half the change happens in the first six
months and the curve stops short of its ceiling, so there is no day on which
the card becomes finished. 「またね」 is not a countdown to the sky going out.

Three properties are checked rather than trusted: it is monotone, so coming
back to a card never finds it fresher than it was; it never reaches the
ceiling; and one day's step is a third of a per cent of the whole range, so
two readings a day apart are the same picture while two a season apart are
not. It is a fact about the letter rather than a state of the view, which is
why it is the same sky on the landing screen as in the hub, and why `?now=`
moves it along with the comet and the return label.

## Rocks passing through

Roughly every thirty seconds, some piece of debris crosses the deep field,
tumbling, and is gone. There is nothing to press and nothing to miss. If a
reader never notices one it has still done its job, because what it buys is
the sense that the sky is not a backdrop.

**Only in the hub.** The hub is the one screen a reader *sits* in rather than
reads, which is both where a thirty-second rhythm has time to mean anything
and the only place where something crossing the frame is not crossing a
sentence. It is the rule the speed streaks already follow.

**Poisson, not metronome.** The gap is drawn from an exponential distribution
with a mean of thirty seconds, clamped at six and a hundred and fifty. A fixed
interval would be a clock, and a clock in the corner of the sky is something a
reader starts waiting for. In practice there is nothing in flight about half
the time, one rock a third of it, and four or more for a quarter of a per
cent.

**They pass behind, and they never touch the satellite.** A rock crossing in
front of the subject of the screen reads as a near miss, which is a drama this
card is not telling; one crossing behind it reads as distance. The clearance
is guaranteed by construction rather than by rejection sampling: each path is
built *around* its own closest-approach point, placed at an exact distance in
the plane perpendicular to the travel direction, so the miss distance is an
input and not an outcome. Verify then measures the result against the
satellite's real deployed hull — 2.1 units of clearance at the worst — and
against the camera at five viewports, so neither margin can be quietly eaten
by a satellite that grows or a composition that moves in closer.

It is a tumbling rock rather than a streak on purpose. A streak is the
returned day's flourish, which happens **once**, on a day that means
something; the two should never be mistaken for each other.

## The comet moment, end to end

What the card does after the six faces, once a comet exists:

1. the cube becomes a satellite, and the comet **leaves** — watched once per
   cycle (`departed`), so a later deployment goes straight to the chart;
2. the sheet says briefly what the comet is, and what is sealed on it;
3. it asks whether to put the reader's words on it — the long ask the first
   time, the short one after (M13a / M13e);
4. and the **crossroads** offers the three ways on: the rocket, the trail, and
   the comet's own trajectory.

Step 4 gained the trajectory because step 1 raises a question — *when does it
come back?* — that the sky cannot answer. Up there the comet is a speck with a
short dotted lead; `TrajectoryPanel` is the pulled-back drawing that answers
it, and `hasCrossroads` now counts a comet as somewhere to go so that a card
whose only continuation is the comet does not close on that question.

**The two ways of sending differ only in speed**, so both say so. The rocket
overtakes the comet and arrives now; the comet carries words that cannot be
read until the day. `打ち上げる` on its own was a verb with no object, and left
the reader unsure which of the two they had just chosen.

The comet's invite is **two steps** (M13a, then M13b). Asking and answering are
different sizes of decision: the first is "would you?", which is one line and
two buttons; the second is a form. Opening straight into the form answered the
first question on the reader's behalf.

## The rule that holds all of it together

**Nothing is on a timer that can disagree with what is on screen.** Every
animated phase ends when the thing that is animating says it has arrived:
`MessageCube` owns the deployment, `CameraRig` owns the trail, `RocketLaunch`
and `CometRelease` own their own flights. The reducer is pure and knows about
none of it.
