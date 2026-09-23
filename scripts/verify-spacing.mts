import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The 8-point grid check (spec v0.2 §23.1).
 *
 * Layout on a grid is not a style preference here. The receiver-facing screens
 * are mostly a few blocks of Japanese text floating over a 3D scene, and
 * without a grid those blocks drift a pixel or two apart from each other in
 * ways nobody can name but everybody can feel. One rule, mechanically checked,
 * is cheaper than taste applied 200 times.
 *
 * What it checks: every margin, padding, gap and positional offset in
 * `app/globals.css` and in inline `style={{…}}` objects under `components/`.
 * A value above 4px must be divisible by 8. Four is allowed inside a single
 * control (icon to label), and hairlines of 1-2px are allowed everywhere.
 *
 * What it does not check: computed 3D positions, which are not layout.
 *
 * A line that genuinely needs to sit off the grid says so, either on the line
 * itself or on the one above it — the second reads better when the reason
 * needs more than a few words:
 *
 *     margin-top: 6px; // grid-exempt: optical centring under the stroke text
 *
 *     // grid-exempt: off-screen entirely, so this is not a layout value.
 *     left: -9999px;
 */

const ROOT = new URL("..", import.meta.url).pathname;

/**
 * The tokens themselves. Everything else refers to these by name, so if one of
 * them drifts off the grid every rule using it drifts with it silently.
 */
const TOKENS = /^--(space(-half|-\d+)?|control-h(-compact)?)$/;

/** Properties whose values are layout distances. */
const PROPERTIES =
  /^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|translate)(-(top|right|bottom|left|block|inline|start|end|x|y))?(-(start|end))?$/;

/** The same properties as React would spell them. */
const JSX_PROPERTIES =
  /^(margin|padding|gap|rowGap|columnGap|inset|top|right|bottom|left)(Top|Right|Bottom|Left|Block|Inline)?$/;

const EXEMPT = /grid-exempt/;

type Offence = { file: string; line: number; text: string; value: number };

const offences: Offence[] = [];
let scannedFiles = 0;
let scannedValues = 0;

/** "1.5rem" -> 24, "16px" -> 16, "0" -> 0. Anything else is not a length. */
function toPx(raw: string): number | null {
  const match = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(raw.trim());
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  // em is relative to a font size we cannot know here; rem is the 16px root.
  if (match[2] === "em") return null;
  return match[2] === "rem" ? n * 16 : n;
}

function onGrid(px: number): boolean {
  const v = Math.abs(px);
  // Hairlines, and the half-step allowed inside one control.
  if (v <= 4) return true;
  return v % 8 === 0;
}

/**
 * Values that are not ours to place on a grid: viewport and content-relative
 * units, safe-area insets, and anything a calc() or var() decides at runtime.
 */
function isDynamic(value: string): boolean {
  return /var\(|calc\(|env\(|%|vh|vw|vmin|vmax|auto|inherit|initial|unset/.test(value);
}

function check(file: string, line: number, text: string, value: string) {
  if (isDynamic(value)) return;
  for (const part of value.split(/\s+/)) {
    const px = toPx(part);
    if (px === null) continue;
    scannedValues++;
    if (!onGrid(px)) offences.push({ file, line, text: text.trim(), value: px });
  }
}

function scanCss(file: string) {
  scannedFiles++;
  const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
  lines.forEach((text, index) => {
    if (EXEMPT.test(text) || EXEMPT.test(lines[index - 1] ?? "")) return;
    // Strip a trailing comment so a note never looks like a value.
    const code = text.replace(/\/\*.*?\*\//g, "");
    const match = /^\s*([a-z-]+)\s*:\s*([^;]+);/.exec(code);
    if (!match) return;
    const [, property, value] = match;
    if (!PROPERTIES.test(property) && !TOKENS.test(property)) return;
    check(file, index + 1, text, value);
  });
}

function scanJsx(file: string) {
  scannedFiles++;
  const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
  let inStyle = false;
  lines.forEach((text, index) => {
    if (/style=\{\{/.test(text)) inStyle = true;
    if (inStyle) {
      if (!EXEMPT.test(text) && !EXEMPT.test(lines[index - 1] ?? "")) {
        const match = /([A-Za-z]+)\s*:\s*(["'])([^"']+)\2/.exec(text);
        if (match && JSX_PROPERTIES.test(match[1])) check(file, index + 1, text, match[3]);
        // A bare number in a style object is px to React.
        const numeric = /([A-Za-z]+)\s*:\s*(-?\d+)\s*[,}]/.exec(text);
        if (numeric && JSX_PROPERTIES.test(numeric[1])) {
          check(file, index + 1, text, `${numeric[2]}px`);
        }
      }
      if (/\}\}/.test(text)) inStyle = false;
    }
  });
}

function walk(dir: string, onFile: (relative: string) => void) {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const relative = `${dir}/${entry}`;
    if (statSync(join(ROOT, relative)).isDirectory()) walk(relative, onFile);
    else onFile(relative);
  }
}

console.log("Spacing: the 8-point grid (spec v0.2 §23.1):");

scanCss("app/globals.css");
walk("components", (file) => {
  if (file.endsWith(".tsx")) scanJsx(file);
  if (file.endsWith(".css")) scanCss(file);
});

for (const offence of offences) {
  console.log(`  FAIL ${offence.file}:${offence.line}  ${offence.value}px is off the grid`);
  console.log(`       ${offence.text}`);
}

console.log(
  `  ${scannedValues} layout value(s) across ${scannedFiles} file(s)` +
    (offences.length === 0 ? " — all on the grid." : ""),
);

if (offences.length > 0) {
  console.log(
    `\n${offences.length} value(s) off the 8-point grid. Move them to a multiple of 8, ` +
      "or mark the line `grid-exempt: <reason>` if it genuinely belongs off it.",
  );
  process.exit(1);
}
