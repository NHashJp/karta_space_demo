# Documentation

| Read | For |
|---|---|
| [Overview](./overview.md) | what the product is, the reader's journey, the principles behind it |
| [Architecture](./architecture.md) | how the code is laid out, how a request becomes a card, the state machine |
| [Cards](./cards.md) | the content model, where cards and pictures live, validation, languages |
| [Editor](./editor.md) | writing and sharing a card with `/editor` |
| [Cube](./cube.md) | the cube's rotation, the camera, fitting text, the deployment into a satellite |
| [Orbit](./orbit.md) | the hub after the closing screen: dawn, planet, comet, trail, sky |
| [Security](./security.md) | passwords, cookies, private pictures, sealed messages, and their limits |
| [Messaging](./messaging.md) | replies, comet links, the emails, the daily reminder |
| [Testing](./testing.md) | what the automated checks prove, and what to check by hand |
| [Deployment](./deployment.md) | the checklist for going live on Vercel |

## Design history

The product was specified in stages, kept in [`specs/`](./specs/) as written:

- [Spec v0.2 「またね」](./specs/spec-v0.2.md) — the letter becomes a satellite,
  and something comes back.
- [Revision 6](./specs/spec-v0.2-r6-orbit.md) — the orbit composition.
- [Revision 7.1](./specs/spec-v0.2-r7-dawn.md) — the dawn, the company in orbit;
  the [mockup](./specs/mockups/orbit-dawn.html) shows the look.

Later revisions win where they disagree. Code comments cite them by section:
*§12* is v0.2, *rev 6 §4.1* and *r7 §8* the revisions.

## Conventions

- **Face** — one of the cube's six sides, 1–6 in reading order (`activeFace` is
  zero-based).
- **Card** — one six-faced message on one slug. Cards share code and nothing
  else: not content, passwords or cookies.
- **World units** — three.js scene units; the cube is 2 across.
- **Hub** — the orbit view after the closing screen.
