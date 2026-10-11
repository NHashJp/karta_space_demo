/**
 * Bold, italic and underline in what the sender writes, as plain-text marks:
 *
 *   **bold**   *italic*   __underline__   ***bold italic***
 *
 * Marks rather than HTML, so a card stays a string in the config, the editor
 * stays a textarea, and nothing the sender typed is ever handed to the
 * browser as markup — `parseRich` returns runs of text, which the card turns
 * into elements itself. A mark with no partner is just a character and shows
 * as typed.
 */

export type RichRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };

type Style = Omit<RichRun, "text">;

/** Longest first, so `***` is read as bold-and-italic rather than `**` + `*`. */
const MARK = /\*\*\*([^*\n](?:[\s\S]*?[^*\n])?)\*\*\*|\*\*([^*\n](?:[\s\S]*?[^*\n])?)\*\*|__([^_\n](?:[\s\S]*?[^_\n])?)__|\*([^*\s](?:[^*]*?[^*\s])?)\*/;

export function parseRich(text: string, style: Style = {}): RichRun[] {
  const runs: RichRun[] = [];
  let rest = text;

  while (rest) {
    const match = MARK.exec(rest);
    if (!match) {
      runs.push({ text: rest, ...style });
      break;
    }
    if (match.index > 0) runs.push({ text: rest.slice(0, match.index), ...style });

    const [, both, bold, underline, italic] = match;
    if (both !== undefined) runs.push(...parseRich(both, { ...style, bold: true, italic: true }));
    else if (bold !== undefined) runs.push(...parseRich(bold, { ...style, bold: true }));
    else if (underline !== undefined) runs.push(...parseRich(underline, { ...style, underline: true }));
    else runs.push(...parseRich(italic, { ...style, italic: true }));

    rest = rest.slice(match.index + match[0].length);
  }

  return runs;
}

/** The words without their marks: what is measured, counted and read aloud. */
export function plainText(text: string): string {
  return parseRich(text)
    .map((run) => run.text)
    .join("");
}

/** True when the text uses any formatting at all. */
export function hasMarks(text: string): boolean {
  return plainText(text) !== text;
}
