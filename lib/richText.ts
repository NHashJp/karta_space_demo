/**
 * Bold, italic and underline in what the sender writes, as plain-text marks:
 *
 *   **bold**   *italic*   __underline__   ***bold italic***
 *   [the words](https://example.com)   or a bare https://example.com
 *
 * Marks rather than HTML, so a card stays a string in the config, the editor
 * stays a textarea, and nothing the sender typed is ever handed to the
 * browser as markup — `parseRich` returns runs of text, which the card turns
 * into elements itself. A mark with no partner is just a character and shows
 * as typed.
 */

export type RichRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Only ever http(s) or mailto (`safeHref`). */
  href?: string;
};

type Style = Omit<RichRun, "text">;

/**
 * The characters a bare address is made of. ASCII only, so a URL typed
 * straight into Japanese (…https://example.comこちら) stops where the address
 * does; no `*` or `_` runs at the end, so it never swallows a closing mark.
 */
const URL_BODY = "[A-Za-z0-9\\-._~:/?#@!$&+,;=%]*[A-Za-z0-9\\-~/#@$&+=%]";

/** A link written out — `[words](address)` — or an address on its own. */
const LINK = new RegExp(
  `\\[([^\\[\\]\\n]+)\\]\\(((?:https?://|mailto:)[^\\s)]+)\\)|((?:https?://)${URL_BODY})`,
);

/** Longest first, so `***` is read as bold-and-italic rather than `**` + `*`. */
const MARK = /\*\*\*([^*\n](?:[\s\S]*?[^*\n])?)\*\*\*|\*\*([^*\n](?:[\s\S]*?[^*\n])?)\*\*|__([^_\n](?:[\s\S]*?[^_\n])?)__|\*([^*\s](?:[^*]*?[^*\s])?)\*/;

/**
 * An address that is safe to put in `href`: http, https or mailto, nothing
 * else — never `javascript:` or `data:`, however it was written.
 */
export function safeHref(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Whichever of a link and a style mark comes first in `text`. */
function firstMark(text: string): { kind: "link" | "style"; match: RegExpExecArray } | null {
  const link = LINK.exec(text);
  const style = MARK.exec(text);
  // A link found first keeps any `_` or `*` in its address as part of it.
  if (link && (!style || link.index <= style.index)) return { kind: "link", match: link };
  return style ? { kind: "style", match: style } : null;
}

export function parseRich(text: string, style: Style = {}): RichRun[] {
  const runs: RichRun[] = [];
  let rest = text;

  while (rest) {
    const found = firstMark(rest);
    if (found?.kind === "link") {
      const { match } = found;
      if (match.index > 0) runs.push(...parseRich(rest.slice(0, match.index), style));
      const [whole, label, address, bare] = match;
      const href = safeHref(address ?? bare);
      if (href && style.href === undefined) {
        runs.push(...parseRich(label ?? bare, { ...style, href }));
      } else {
        // Not an address we will link to, or a link inside a link: as typed.
        runs.push({ text: whole, ...style });
      }
      rest = rest.slice(match.index + whole.length);
      continue;
    }
    const match = found?.match ?? null;
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
