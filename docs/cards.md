# Cards

Source: `types/card.ts`, `config/cards.config.ts`, `lib/cards.ts`,
`lib/cardRules.ts`, `lib/clientCard.ts`, `lib/i18n.ts`

A card is configuration, not data. The deployment serves exactly the cards it
was built with; publishing a card is a deploy. That keeps content reviewable,
leaves no content API to secure, and means a malformed card fails the build
rather than a visitor's page.

## The content model

```ts
type CardConfig = {
  slug: string;              // URL, cookie name, password variable, picture folder
  lang?: "ja" | "en";        // default "ja"
  title: string;
  subtitle?: string;
  faces: CardFaces;          // exactly six
  closing: string;           // drawn by hand on the closing screen
  secret?: string;           // one short line inside the cube
  social?: SocialLink[];
  // all optional — a card using none of them is the v0.1 card:
  from?, writtenAt?, timeZone?, signature?, sound?,
  memories?, comet?, reply?, access?
};

type CardFace =
  | { type: "text"; body: string; style?: "paragraph" | "line" }
  | { type: "image"; src: string; alt: string; fit?: "cover" | "contain" };
```

`types/card.ts` documents every field. The slug is restricted to `a-z`, `0-9`
and hyphens because it becomes a URL, a cookie name and an environment variable
name.

## Where cards live

| File | Holds | Committed |
|---|---|---|
| `config/cards.config.ts` | the samples | yes |
| `.karta/cards.local.json` | real cards — what the editor saves | **no** |

They are merged by slug, local winning. A real card is a letter to one person,
so it stays out of the repository's history by default — which also means it is
not deployed until you decide how it gets there ([deployment](./deployment.md#1-the-one-that-will-catch-you)).
The local file is re-read when its timestamp changes, so editor saves show
immediately.

The samples are generic templates:

| Slug | Language | Shows |
|---|---|---|
| `2026-newyear-7k2m` | Japanese | every feature |
| `newyear-en-k7m2q9x4` | English | the same card |
| `thanks-sample-3f9q` | Japanese | the minimum: six text faces, no orbit |
| `thanks-en-r4t8w2p6` | English | the same card |

## Validation

`lib/cardRules.ts` is the one definition of a valid card, used by the registry
(build fails), the editor (save refuses errors, shows the rest inline) and
`npm run verify` (fails on errors and warnings). Three severities:

- **Errors** break the build or page: bad or duplicate slug, not six faces,
  empty title or closing, an image face with no file, an unknown `lang`.
- **Warnings** are against the spec but harmless: a paragraph outside 80–250,
  missing alt text, a picture outside the card's folder or in `public/`.
- **Notes** never fail: a closing line over 18 characters, a short random slug.

Limits that matter when writing (all measured in *visual length*, below):
paragraph 80–250, line face up to 30 (keep it under ~12 to stay on one line),
secret 28, closing 18, memory title 24 and caption 80, comet promise 40,
up to 20 memories.

## Pictures

Every picture — cube faces and memory photographs alike — lives in
`private/cards/<slug>/` and is named in the config by that path.
`toClientCard` turns it into `/c/<slug>/media/<file>`, which serves a file only
to someone who can open the card ([security](./security.md#private-pictures)).
A face still pointing at an old `/cards/...` public path keeps working, is
flagged, and is moved into the private folder on the card's next editor save.

A card's pictures stay inside its own folder, so deleting a card is deleting its
entry and its folder. `npm run verify` checks every referenced file exists.

## The signature

Stored inline in the card as SVG markup of stroked paths — never as a file — so
it travels with the card's words, behind the same password. Before it reaches
the page, `cleanSignature` (`lib/signature.ts`) rebuilds it from its own path
data, so nothing but stroked paths is ever put into the document. Strokes, not
fills, because the closing screen draws it by walking a dash along each path.

## The secret line

One optional line written inside the cube's far wall, offered on the closing
screen after everything else has arrived. It is short because a phone sees only
0.6 world units from inside ([cube](./cube.md#reading-from-inside-the-cube)).
"Secret" means hidden from the reader until they look — it is behind the same
password as the rest of the card, not more private.

## Languages

`lang` sets the language of everything around the letter: buttons, panels, the
comet intro, the countdown, dates, the password gate, the comet page, and the
emails to the sender. Every interface string is in `lib/i18n.ts`, one table per
language of the same type, so a string missing from either fails the type
check. Strings with names or numbers are functions, because word order differs.

- Components read the strings through `useStrings()` from `LangContext`;
  non-React code (`returnLabel`, `formatFuzzyDate`, mail) takes `lang` as an
  argument.
- English return dates always read "by …" — the one preposition that works
  before a day, a season and a year.
- Cube faces are drawn in the 3D scene, so their `lang` attribute comes from the
  script of the text itself (`scriptLang`).

**Visual length.** Every fitting rule was written for Japanese, where a
character is about an em wide. `visualLength` counts a kana or kanji as 1, a
Latin letter as 0.55 and a space as 0.3, so English sets at the same size as
Japanese of the same width. It drives face type, line faces, the secret line,
the closing line (which also breaks after an English comma or full stop) and
the limits above.

The editor itself is English and is not translated.

## Dates

Memory dates are *fuzzy*: `2023`, `2023-08` or `2023-08-14`, optionally
`approx` or with a `season` instead of a month — "summer 2023" is what people
actually remember. The comet's `show` sets how precisely its return is
described (`day`, `month`, `season`, `year`), so a promise like 次の冬 is never
turned into an invented date. All date logic uses the card's `timeZone`.
