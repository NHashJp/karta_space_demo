# Languages

Source: `lib/i18n.ts`, `components/card/LangContext.tsx`.

A card is written in one language, and everything around it speaks the same
one: the buttons, the sheets and panels, the comet intro, the countdown, the
dates, the password gate, the comet page, and the emails the sender receives.
A receiver should never read a Japanese letter in English chrome, or the
reverse.

## Setting it

`lang: "ja" | "en"` on the card, or the **Language** picker at the top of the
editor's Basics section. Japanese is the default, so a card that does not say
is the card it always was — none of the Japanese wording changed when English
arrived. `cardRules` rejects any other value.

The samples come in both: `2026-newyear-7k2m` / `newyear-en-k7m2q9x4` (every
feature) and `thanks-sample-3f9q` / `thanks-en-r4t8w2p6` (the minimum).

## One table per language

Every word the interface says is in `lib/i18n.ts`, in two tables of the same
type, so a string added to one and forgotten in the other fails the type check
rather than showing up blank. Strings that carry a name or a number are
functions, because the word order differs (`${from}の言葉` / `Words from
${from}`) and the sentence is built in the table rather than glued together at
the call site.

Components read it through `useStrings()` / `useLang()` from `LangContext`,
which `CardExperience` provides for the whole card (and `CometPage` for the
comet page). Code outside React — `returnLabel`, `formatFuzzyDate`, the mail
templates, `landingNote` — takes the language as an argument and calls
`strings(lang)`.

Two things are worth knowing:

- **English return dates are always introduced with "by"** — "by December 25,
  2026", "by next winter", "by 2027". It is the one preposition that reads
  right before a day, a season and a year alike, and a return label can be any
  of the three.
- **The cube's faces live in the 3D scene**, outside the card's React tree, so
  they take their `lang` attribute from the script the text is actually
  written in (`scriptLang`) rather than from the card. A Japanese card may
  quote English, and the attribute is right either way.

## Fitting English

Every fitting rule — face type size, line faces, the secret line, the closing
line, the length limits — was written in Japanese characters, where one
character is about an em wide. They now measure **visual length**
(`visualLength`): a kana or kanji counts 1, a Latin letter 0.55, a space 0.3.
Counting an English paragraph by its letters would fit it as though it were
twice as long as it sets. See [framing and text](./framing-and-text.md).

## What is not translated

The editor itself, which is written for the sender and is already in English,
and its password screen.
