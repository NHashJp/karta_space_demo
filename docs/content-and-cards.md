# Content and cards

Source: `config/cards.config.ts`, `types/card.ts`, `lib/cardRules.ts`,
`lib/cards.ts`, `lib/cardsFile.ts`, `app/editor/`, `app/api/editor/`

For the how-to — adding a card, running the editor, where images go — see the
[project README](../README.md#editing-the-cards). This page is the *why*.

## Cards are configuration, not data

There is no database and no content API. Every card is an entry in one array in
`config/cards.config.ts`, and the deployment serves exactly the cards that were
in that file when it was built.

That is a real constraint — publishing a card means a deploy — and it buys
three things that matter more at this size:

- **Content is reviewable.** A card is a diff. You can see what changed in a
  message before a recipient does.
- **There is no content path to secure.** No read API, no write API in
  production, no storage credentials, no migration.
- **A broken card cannot reach a visitor.** Validation runs at import, so a
  malformed card fails the build instead of rendering a broken page.

The ceiling is explicit: the change that forces a database is letting someone
*author* a card without a deploy. Everything before that is more entries in the
array.

## Why one file

The messages are the part of this product a non-engineer edits, so they live
together, in one place, in prose order — rather than a file per card, or
content interleaved with components.

It also means the editor has exactly one file to rewrite, and the registry has
exactly one import to validate.

```
config/cards.config.ts     the content            edited by hand or by /editor
      │
      ├─ lib/cardRules.ts  what "valid" means     pure, no imports
      │
      └─ lib/cards.ts      slug -> card registry  built once, at import
```

## The registry

`lib/cards.ts` turns the array into a `Map` keyed by slug, once, at module
load. `getCardBySlug` is a map lookup; `listCards` is the values.

Building it at import rather than per request is what makes validation free:
the checks run once at server start (and, in a production build, at build
time), so the cost does not grow with traffic — only with the number of cards,
once.

## One definition of a valid card

The same rules are enforced in three places, and are written down once, in
`lib/cardRules.ts` — a pure module with no React, no filesystem and no config
import:

| Where | When | What it does with a problem |
|---|---|---|
| `lib/cards.ts` | server start / build | throws — the build fails |
| `app/api/editor/route.ts` | on save | refuses the write, returns the list |
| `components/editor/CardsEditor.tsx` | as you type | shows it inline, per card |
| `scripts/verify-rotation.mts` | `npm run verify` | fails the run |

Rules separate two severities, and the distinction is the useful part:

- **Errors** would break the build or the page: a malformed or duplicated slug,
  not exactly six faces, an empty title or closing message, an image face whose
  path is missing or points at a folder rather than a file.
- **Warnings** are against the spec but harmless to the machinery: a paragraph
  outside 80–250 characters, an empty message, missing alt text, an image kept
  outside the card's own folder, a link that is not absolute or has no label.

The editor **saves through warnings** — a half-written card is a normal state
while writing, and an empty face renders as an empty face rather than breaking.
`npm run verify` **fails on them**, because it is the gate you run before
deploying. Same rules, different strictness, chosen per tool.

## The editor

`/editor` is a rough authoring UI over that one file: a card list, the six face
editors, closing message, links, and an access panel. It is documented as a
workflow in the README; what is worth recording here is why it is shaped the
way it is.

**It writes the TypeScript file, not JSON.** The alternative — moving content
to `cards.json` so the editor could write data instead of code — would have
been easier to serialise and would have cost the type checking and the comments
that make the file editable by hand. Since the file must stay hand-editable
(the editor is dev-only, and a deploy is needed either way), TypeScript stays,
and `lib/cardsFile.ts` re-emits the whole file from a fixed header plus
`JSON.stringify` of the array.

The consequence is honest and stated in the file's own header: **a save rewrites
the file whole**, so the header survives and comments added below it do not.

**It is development-only**, both the page and the route — see
[access and security](./access-and-security.md#the-editor-is-development-only).

**It never sees a password.** The access panel is rendered on the server from
`Boolean(process.env[key])`, so the browser is told *whether* a card has its
own password and *which variable* holds it, never the value.

## The inside of the cube

`secret` is one optional line. It is not a seventh face — the card still has
exactly six (spec §6) — it is written on the *inside* of the far wall, and the
only way to it is from the closing screen, six seconds after that screen has
settled.

The delay is the whole design. A cube that turns out to have an inside is only
a surprise if the ending has first been allowed to read as the ending; an offer
that appears immediately is just another button.

Three consequences worth knowing before writing one:

- **It must be short.** Inside a cube barely half a world unit of view is
  available on a phone, so `SECRET_MAX` is 28 characters and the rules warn
  past it. A paragraph cannot be read from in there at any size — that is
  geometry, not taste. The sizing rule is in
  [framing and text](./framing-and-text.md#reading-from-inside-the-cube).
- **It is not more private than the rest of the card.** It sits behind the same
  password gate as the six faces and is in the accessible copy of the document
  like everything else. "Secret" means hidden from the *reader* until they go
  looking, not withheld from the browser.
- **Leaving it out removes the feature.** No offer on the closing screen, no
  inner shell, no light, nothing rendered. Cards without one behave exactly as
  they did before the inside existed.

## Per-card images

Images live in `public/cards/<slug>/`, one folder per card, and a card's face
must reference a path inside its own folder. Nothing enforces this at runtime —
it is a warning, not an error — but it keeps deletion safe: removing a card
means removing its entry and its folder, with no shared-asset question to
answer first.

`npm run verify` checks that each referenced file actually exists, which is the
mistake this layout makes easy to catch and easy to make.

## v0.2 additions, and two decisions the spec left open

[Spec v0.2](./spec-v0.2.md) adds optional fields — `from`, `writtenAt`,
`timeZone`, `memories`, `satellite`, `comet`, `reply`, `access`, `signature`,
`sound` — and §0.3 makes it an acceptance criterion that **a card using none of
them behaves exactly as it did in v0.1**. That is why every new rule in
`cardRules.ts` runs only when its field is present.

It also added a third severity, which the spec does not have: **notes**. §5
marks "closing line over 18 characters" and "short random slug" as warnings,
while §17 wants the slug one reported as a NOTE that does not fail. Since this
project's `verify` fails on warnings, and §18 requires a v0.1 card to stay
clean, both became notes: printed, never fatal. Errors and warnings are
unchanged.

Two constants deviate from the spec, both because the spec's own verification
bound (§17: colour continuous to < 0.08 per channel between samples 0.01 apart
in `u`) contradicts its suggested numbers:

| §9.1 says | Implemented | Why |
|---|---|---|
| `BAND_SCALE` 3.0 | 1.2 | 3.0 measures 0.21 per channel — and puts more than the "two to four" bands §9.1 describes on the trail |
| exhaust ramp 5% of `u` | 30% | ramping to white across 5% moves a channel 0.18 per sample step on its own |

Measured worst cases are printed by `npm run verify` section 7. Seeding for
both the trail and each comet's orbit lives in `lib/seed.ts`, which the spec's
file map does not mention — it is one FNV-1a hash plus value noise, shared
rather than written twice.

## The content model

```ts
type CardFace =
  | { type: "text"; body: string }
  | { type: "image"; src: string; alt: string; fit?: "cover" | "contain" }

type CardConfig = {
  slug: string          // the URL, the cookie name, the env var name
  title: string         // shown before the card opens
  subtitle?: string     // optional line under it
  faces: CardFaces      // exactly six, in display order
  closing: string       // drawn stroke by stroke on the last screen
  secret?: string       // one short line, written inside the cube
  social?: SocialLink[] // icons under the replay button
}
```

A face is text or image, never both (spec §6). `CardFaces` is a six-tuple
rather than an array, so a miscounted card is a type error where it can be —
and a runtime error from `lib/cardRules.ts` where it cannot, such as content
arriving from the editor as parsed JSON.

The slug is the one field with reach beyond content: it is the URL, part of the
cookie name (`ks_access_<slug>`), part of the password variable name
(`CARD_PASSWORD_<SLUG>`), and the image folder. That is why its alphabet is
restricted to `a-z`, `0-9` and hyphens rather than anything a URL would
tolerate.
