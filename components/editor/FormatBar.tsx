"use client";

import { useRef, type KeyboardEvent } from "react";

/**
 * Bold, italic and underline for a field the sender writes in — as the marks
 * the card reads (`lib/richText.ts`), so what is saved is still plain text.
 *
 * Applying a style wraps the selection in its marks, or unwraps it when the
 * selection is already wrapped, so the same button turns it off again. With
 * nothing selected it leaves an empty pair with the caret between them.
 */

type Field = HTMLTextAreaElement | HTMLInputElement;
export type Format = "bold" | "italic" | "underline";

const MARKS: Record<Format, string> = { bold: "**", italic: "*", underline: "__" };

/** ⌘/Ctrl + B, I, U. */
const KEYS: Record<string, Format> = { b: "bold", i: "italic", u: "underline" };

/** How many of `char` end `text` (or start it, with `fromStart`). */
function run(text: string, char: string, fromStart = false): number {
  let count = 0;
  while (count < text.length && text[fromStart ? count : text.length - 1 - count] === char) count++;
  return count;
}

/**
 * Whether the selection already sits inside this format's marks. Stars are
 * shared by bold (2), italic (1) and both (3), so they are counted rather than
 * matched: an odd run is italic, a run of two or more contains bold.
 */
function wrapped(before: string, after: string, format: Format): boolean {
  if (format === "underline") return before.endsWith("__") && after.startsWith("__");
  const left = run(before, "*");
  const right = run(after, "*", true);
  if (format === "italic") return left % 2 === 1 && right % 2 === 1;
  return left >= 2 && right >= 2;
}

export function useFormatting(value: string, onChange: (next: string) => void) {
  const ref = useRef<Field | null>(null);

  function apply(format: Format) {
    const field = ref.current;
    if (!field) return;
    const mark = MARKS[format];
    const start = field.selectionStart ?? value.length;
    const end = field.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);

    let next: string;
    let caret: [number, number];
    if (wrapped(before, after, format)) {
      next = before.slice(0, -mark.length) + selected + after.slice(mark.length);
      caret = [start - mark.length, end - mark.length];
    } else {
      next = before + mark + selected + mark + after;
      caret = [start + mark.length, end + mark.length];
    }

    onChange(next);
    // After React has written the new value, put the selection back on the words.
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(caret[0], caret[1]);
    });
  }

  function onKeyDown(event: KeyboardEvent<Field>) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const format = KEYS[event.key.toLowerCase()];
    if (!format) return;
    event.preventDefault();
    apply(format);
  }

  return { ref, apply, onKeyDown };
}

export function FormatBar({ onApply }: { onApply: (format: Format) => void }) {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const key = mac ? "⌘" : "Ctrl+";
  const buttons: [Format, string, string][] = [
    ["bold", "B", `Bold (${key}B)`],
    ["italic", "I", `Italic (${key}I)`],
    ["underline", "U", `Underline (${key}U)`],
  ];

  return (
    <span className="format-bar" role="toolbar" aria-label="Text style">
      {buttons.map(([format, letter, label]) => (
        <button
          key={format}
          type="button"
          className="format-bar__button"
          data-format={format}
          aria-label={label}
          title={label}
          // Keep the focus — and so the selection — in the field.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onApply(format)}
        >
          {letter}
        </button>
      ))}
    </span>
  );
}

/**
 * A text field with the bar above it: a textarea for paragraphs, a single
 * line for captions and the secret line.
 */
export function RichField({
  value,
  onChange,
  multiline = false,
  rows,
  lang,
  placeholder,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  rows?: number;
  lang?: string;
  placeholder?: string;
  /**
   * The field's name. Not a wrapping `<label>`: a label hands its clicks to
   * its *first* control, which here would be the bold button.
   */
  label: string;
}) {
  const { ref, apply, onKeyDown } = useFormatting(value, onChange);
  return (
    <div className="rich-field">
      <FormatBar onApply={apply} />
      {multiline ? (
        <textarea
          ref={(node) => {
            ref.current = node;
          }}
          value={value}
          rows={rows}
          aria-label={label}
          lang={lang}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          ref={(node) => {
            ref.current = node;
          }}
          value={value}
          aria-label={label}
          lang={lang}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
