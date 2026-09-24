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

| Document | What it covers |
|---|---|
| [Architecture](./architecture.md) | Layers, file map, what runs on the server and what runs in the browser |
| [Content and cards](./content-and-cards.md) | Cards as configuration, the slug registry, one definition of a valid card, and how the editor writes the file |
| [Experience flow](./experience-flow.md) | The ten-state machine, how one gesture becomes one face, and the way into the cube |
| [Cube and motion](./cube-and-motion.md) | Face orientations, rotation presets, and why a showy spin still lands exactly square-on |
| [Framing and text](./framing-and-text.md) | Camera distance, the `<Html transform>` scale rule, and fitting type to a cube face |
| [Scene and shaders](./scene-and-shaders.md) | Nebula, starfield, wandering lights, dimming and the performance budget |
| [Access and security](./access-and-security.md) | Slug, password, cookie, and an honest account of what this does and does not protect |
| [Verification](./verification.md) | What `npm run verify` proves, and the bugs it has actually caught |
| [Spec v0.2 「またね」](./spec-v0.2.md) | The specification being implemented now: the letter becomes a satellite, and something comes back |

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

4. **The experience is a pure reducer.** Seven states, five events, no
   side effects — which is why the whole flow can be tested without a browser.
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

## Conventions

- The spec this implements is `KARTA_SPACE_MVP_Implementation_Spec.md` v0.1.
  Section references like *spec §12* in code comments point at it.
- "Face" always means one of the six cube sides, numbered 1–6 in reading order.
  `activeFace` is the zero-based index of the same thing.
- "World units" are three.js scene units. The cube is 2 of them across.
- "Card" means one six-faced message on one slug. One deployment serves many;
  they share code and nothing else — not content, not passwords, not cookies.

- [Revision 6 (orbit composition)](./spec-v0.2-r6-orbit.md) overrides §8.2, §8.4, §8.9, §8.10, §9.1, §10.3–10.4, §11.2, §12.2, §16, §17, §18, §22 and §23 where stated.
