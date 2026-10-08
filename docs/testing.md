# Testing

Two halves: `npm run check` proves the arithmetic; a person checks how it looks
and feels.

## Automated checks

```console
$ npm run check        # tsc --noEmit, then the three verify scripts
```

The verify scripts import the pure modules directly in Node — no browser, no
test framework. They need Node 22.6+ (`--experimental-strip-types`); on older
Node run `npx tsx scripts/verify-rotation.mts` (and `verify-spacing`,
`verify-orbiters`). There is no ESLint; the type checker and these scripts are
the gate.

| Area | What is proven |
|---|---|
| Cube | every face lands square-on and upright from every preset (error 0°); decoration within budget |
| Framing and type | camera distance, face fill, font ≥ 14 px and fit at five viewports; the secret line from inside the cube; the closing line wraps rather than shrinking |
| Content | every sample card against `cardRules`; every picture exists, is in the card's private folder and reaches the browser through the gated route; signatures are inline and survive sanitising; faces measured by visual length |
| Flow | a full walk of the state machine: text only in `reading`, input ignored while animating, the comet moment and its intro, the inside from both directions, ceremony counts, every `?at=` target |
| Access | password normalisation, hashing and its rejections, precedence, cookie invalidation |
| Seals | the sender's message absent before its date (searched for in the whole payload); no secret in any payload or email; the comet token refuses every tampered byte |
| Mail and cron | templates as strings, what the receiver may send, the reminder's date logic and idempotency key |
| Deployment | the four overlapping windows, continuity at two resolutions, no panel through the body, the satellite fading as one object |
| Hub composition | satellite, planet, comet ellipse, sun and trail placed as specified at every viewport; the comet's glow and tail clear of the satellite; the label never covering the comet |
| Motion | the trail's drift and bends (camera 1.2 units clear), the retrace never stalling or kicking, rocks never reaching the satellite, shooting stars and fireballs, the sky only ever ageing, both ways of sending heading for the comet |
| Dawn and company | the dawn curve and its light; two simulated hours of orbiters — enough in view, nothing darting, nothing in front of the planet or satellite (`verify-orbiters`) |
| Kept as built | the satellite's position and the contrail's polyline pinned to the pixel — a failure here means *decide*, not *update* |
| Layout | every spacing value on the 8-point grid (`verify-spacing`) |

The checks prove numbers, not pixels: nothing here says whether the scene looks
right, whether an email is delivered, or whether the whole thing holds together.

## By hand

```console
$ npm run dev          # with MAIL_DEV_SINK=1 to test replies and comets with no mail account
```

Use the [development parameters](./architecture.md#development-parameters) to
jump straight to a state. Test both a full card (`2026-newyear-7k2m`) and the
text-only one (`thanks-sample-3f9q`) — a card without an orbit must end exactly
at the closing screen.

**The reply and comet buttons appear only when mail is configured** — set
`MAIL_DEV_SINK=1`, or a real `RESEND_API_KEY`, `MAIL_FROM` and `NOTIFY_TO`, and
restart the server ([messaging](./messaging.md#only-offered-when-deliverable)).

| Area | Expect |
|---|---|
| Gate | nothing of the card in the page source; `HOSHIZORA`, ` hoshizora`, `ほしぞら` all accepted; an eleventh wrong try refused; a wrong slug looks like a wrong password |
| Faces | one gesture, one face; every face square-on and upright; text never readable mid-turn or on the landing/closing screens |
| Closing | the line, then the signature, then the offers; 中をのぞく last; the second visit plays faster |
| Inside | the line attaches only after the camera arrives; any gesture leads out |
| Deployment | starts without a hitch; no panel through the body; the satellite stays in front of the planet on a phone; docking returns the closing screen exactly as it was |
| First launch | the intro: あと X 日 over the promise, the dashed way home, the comet's run with the sunrise, the rewind, then the sheet; スキップ works; it can be replayed from the sheet once words are aboard |
| Hub | the planet's rim exactly on its edge; the comet moving round its loop across `?now=` dates; shooting stars and the odd fireball; rocks behind the satellite; `?` and sound side by side; the caption's promise and countdown |
| Comet sheet | the seal stated first; the two-step invite; the words fly to the comet; `?now=<returnsOn>` opens the sender's message |
| Rocket | the panel closes; the rocket crosses from the far edge, overtakes the comet, becomes a star; a failure (dummy key) keeps the message and says so above the button |
| Trail | newest first; even hops; the ribbon beside, never through the lens; colours warming with age; bends after the first few; the way back retraces the curve |
| Sky age | `?now=` a year on is thinner and bluer; adjacent days identical; never fresher going forward |
| English | `/c/newyear-en-k7m2q9x4`: gate, landing, offers, bar, caption (*78 days to go*), intro, sheets and dates all English; faces the same size as Japanese |
| Reduced motion | everything legible and reachable, nothing moving |
| Editor | Setup shows what the server has; errors block a save, warnings do not; uploads land in `private/cards/<slug>/` |

**Once per release**, on a real phone with no parameters: open the link, pass
the gate, read every face, go inside, deploy, sit in the hub for a couple of
minutes, walk the whole trail and back, put words on the comet, send a reply,
and dock. It is the only way to see whether it is one thing.

When something is wrong, capture the full URL with parameters, the viewport and
orientation, whether reduced motion is on, the browser console, and the
`next dev` terminal (a failed send prints the provider's reason there). In an
automated browser keep the window in front: a backgrounded tab stops
`requestAnimationFrame`, and with it the state machine.
