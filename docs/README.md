# KARTA_SPACE documentation

A single six-sided 3D message card. A recipient opens a URL, passes an optional
password gate, sees the card title, and then scrolls or swipes through six cube
faces — each one a paragraph of Japanese text or an image.

These documents explain how it is built and why the non-obvious parts are the
way they are. For running it, editing content and deploying, see the
[project README](../README.md).

## Start here

| Document | What it covers |
|---|---|
| [Architecture](./architecture.md) | Layers, file map, what runs on the server and what runs in the browser |
| [Experience flow](./experience-flow.md) | The seven-state machine, and how one gesture becomes one face |
| [Cube and motion](./cube-and-motion.md) | Face orientations, rotation presets, and why a showy spin still lands exactly square-on |
| [Framing and text](./framing-and-text.md) | Camera distance, the `<Html transform>` scale rule, and fitting type to a cube face |
| [Scene and shaders](./scene-and-shaders.md) | Nebula, starfield, wandering lights, dimming and the performance budget |
| [Access and security](./access-and-security.md) | Slug, password, cookie, and an honest account of what this does and does not protect |
| [Verification](./verification.md) | What `npm run verify` proves, and the bugs it has actually caught |

## The five mechanisms worth understanding

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

## Conventions

- The spec this implements is `KARTA_SPACE_MVP_Implementation_Spec.md` v0.1.
  Section references like *spec §12* in code comments point at it.
- "Face" always means one of the six cube sides, numbered 1–6 in reading order.
  `activeFace` is the zero-based index of the same thing.
- "World units" are three.js scene units. The cube is 2 of them across.
