# KARTA_SPACE documentation

Six-sided 3D message cards. A recipient opens a URL, passes an optional
password gate, sees the card title, and then scrolls or swipes through six cube
faces — each one a paragraph of Japanese text or an image. Some cards have one
more line, written inside. One deployment serves any number of cards, each on
its own slug.

These documents explain how it is built and why the non-obvious parts are the
way they are. For the how-to — running it, writing a card, deploying — see the
[project README](../README.md).

## Start here

**New to this, or explaining it to someone?** Read
[Overview](./overview.md) — the whole project on one page, in plain words.
Everything below goes deep on one part of it.

| Document | What it covers |
|---|---|
| [Overview](./overview.md) | The whole thing on one page: what it is, the journey, the ideas, where the code lives |
| [Architecture](./architecture.md) | Layers, file map, what runs on the server and what runs in the browser |
| [Content and cards](./content-and-cards.md) | Cards as configuration, the slug registry, one definition of a valid card, and how the editor writes the file |
| [Experience flow](./experience-flow.md) | The state machine, how one gesture becomes one face, and the way into the cube |
| [Cube and motion](./cube-and-motion.md) | Face orientations, rotation presets, and why a showy spin still lands exactly square-on |
| [Framing and text](./framing-and-text.md) | Camera distance, the `<Html transform>` scale rule, and fitting type to a cube face |
| [Scene and shaders](./scene-and-shaders.md) | Nebula, starfield, wandering lights, dimming and the performance budget |
| [Access and security](./access-and-security.md) | Slug, password, cookie, and an honest account of what this does and does not protect |
| [The orbit](./orbit.md) | What v0.2 is for: the satellite, the trail of memories, the comet that comes back |
| [Messaging](./messaging.md) | The reply, the comet, the three emails, and the daily job |
| [The editor](./editor.md) | Writing a card without editing the config by hand |
| [Verification](./verification.md) | What `npm run verify` proves, and the bugs it has actually caught |
| [Testing](./testing.md) | How to exercise every feature by hand, and what each one should do |
| [Deployment](./deployment.md) | The checklist before going live on Vercel, and what breaks without each variable |
| [Spec v0.2 「またね」](./spec-v0.2.md) | The specification being implemented: the letter becomes a satellite, and something comes back |
| [Revision 6](./spec-v0.2-r6-orbit.md) | The orbit composition, which overrides the spec where the two disagree |

## The seven mechanisms worth understanding

If you only read parts of this, read these.

1. **Decorative rotation that always lands exactly.** Spins are whole turns and
   tilts swell then return to zero, so both vanish at the end of a transition
   and the cube snaps square-on no matter how elaborate the path was.
   → [Cube and motion](./cube-and-motion.md#the-landing-guarantee)

2. **`<Html transform>` maps 40 CSS pixels to one world unit.** Every piece of
   text sizing follows from that one constant.
   → [Framing and text](./framing-and-text.md#the-40-pixel-rule)

3. **Type is fitted to the face, not to the viewport.** A cube face on a phone
   is only ~270px wide, so font size is solved from the message length rather
   than fixed.
   → [Framing and text](./framing-and-text.md#fitting-type-to-a-face)

4. **The experience is a pure reducer.** Twenty-three states, nineteen events,
   no side effects — no timers, no fetches, no storage — which is why the whole
   flow can be walked and checked without a browser.
   → [Experience flow](./experience-flow.md)

5. **Card content never reaches the browser before access is granted.** The
   page is a server component that returns the gate instead of the card.
   → [Access and security](./access-and-security.md#content-withholding)

6. **One definition of a valid card, four enforcement points.** The registry,
   the editor's save, the editor's UI and `npm run verify` all read the same
   rules module — they differ only in how strictly they treat a warning.
   → [Content and cards](./content-and-cards.md#one-definition-of-a-valid-card)

7. **The cube has an inside.** A third camera position, three states that
   mirror the reading ones, and a line that is attached only once the camera
   has actually arrived in there.
   → [Content and cards](./content-and-cards.md#the-inside-of-the-cube)

8. **The scene is composed backwards from the screen.** The satellite, the
   planet, the comet and the trail are all placed by solving for where they
   should land as *fractions of the viewport*, not by choosing world
   coordinates and hoping. It is why the composition survives a phone.
   → [The orbit](./orbit.md#the-trail-is-staged-not-placed)

## Checks

```console
$ npm run check      # typecheck, then verify
```

There is no ESLint in this project and never has been — the `lint` script was
`create-next-app`'s, calling a `next lint` that Next 16 removed, so it exited
zero having linted nothing. It has been replaced rather than repaired: what
this project actually gates on is the type checker and the verify suite.

## Conventions

- Section references in code comments point at the spec being implemented.
  Unqualified — *spec §12* — means [v0.2](./spec-v0.2.md); the v0.1 spec is
  superseded and kept only for the parts v0.2 does not restate. A comment that
  says *rev 6 §4.1* means [revision 6](./spec-v0.2-r6-orbit.md), which wins
  wherever the two disagree.
- "Face" always means one of the six cube sides, numbered 1–6 in reading order.
  `activeFace` is the zero-based index of the same thing.
- "World units" are three.js scene units. The cube is 2 of them across.
- "Card" means one six-faced message on one slug. One deployment serves many;
  they share code and nothing else — not content, not passwords, not cookies.
- Revision 6 overrides §8.2, §8.4, §8.9, §8.10, §9.1, §10.3–10.4, §11.2,
  §12.2, §16, §17, §18, §22 and §23 where stated.
