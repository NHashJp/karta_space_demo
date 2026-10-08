import { visualLength } from "./i18n.ts";

/**
 * Wrapping the closing line (spec v0.2 rev 6).
 *
 * Pure, and in `lib/` rather than beside the component, so `npm run verify`
 * can check it: where a farewell breaks is the kind of rule that is easy to
 * get subtly wrong and impossible to notice until someone writes a long one.
 */

/*
 * Below this, a closing line has stopped being handwriting and become a
 * caption: the reader can see that something was written but not what.
 *
 * `StrokeText` fits one line to the width it is given, so the size on screen
 * is very nearly the width divided by the number of characters — a
 * thirty-nine character farewell lands at 9px on a phone. Wrapping to a
 * second line nearly doubles that, because the size is set by the longer of
 * the two.
 */
const MIN_GLYPH_PX = 22;

/** What the screen gives the line, once the column's own margins are off. */
function closingWidth(viewport: number): number {
  return Math.min(viewport * 0.92, 992);
}

/** Roughly what one character will measure, drawn on one line of `n`. */
function glyphSize(viewport: number, characters: number): number {
  return characters > 0 ? closingWidth(viewport) / characters : Infinity;
}

/**
 * The closing line, as one line or two (rev 6).
 *
 * Split at punctuation, never mid-phrase: 。 and 、 are where the sentence
 * already pauses, so a break there reads as the writer taking a breath rather
 * than as text reflowing. Among those, the one that leaves the *longest* line
 * shortest wins, because the longest line is what sets the size — that is the
 * whole reason for wrapping at all. A line with no punctuation in it is left
 * alone; breaking it anywhere would be arbitrary, and a wrong break is worse
 * than small.
 */
export function closingLines(closing: string, viewport: number): string[] {
  const text = closing.trim();
  // Measured in full-width characters, so an English line breaks where it
  // is actually too wide rather than where it has too many letters.
  const width = (part: string) => visualLength(part.trim());
  if (!text || glyphSize(viewport, width(text)) >= MIN_GLYPH_PX) return [text];

  const breaks: number[] = [];
  for (let i = 0; i < text.length - 1; i++) {
    const japanese = "。、！？".includes(text[i]);
    // English pauses at a comma or a full stop *followed by a space*, so
    // "3.5" or an initial does not count as one.
    const english = ",.!?;:".includes(text[i]) && text[i + 1] === " ";
    if (japanese || english) breaks.push(i + 1);
  }
  if (breaks.length === 0) return [text];

  const longestAt = (at: number) => Math.max(width(text.slice(0, at)), width(text.slice(at)));
  const best = breaks.reduce((a, b) => (longestAt(b) < longestAt(a) ? b : a));

  // Only if it actually helps: two lines cost vertical room on the screen too.
  if (glyphSize(viewport, longestAt(best)) <= glyphSize(viewport, width(text))) return [text];

  return [text.slice(0, best).trim(), text.slice(best).trim()];
}

