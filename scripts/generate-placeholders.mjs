/**
 * Generates placeholder card images (dependency-free PNG encoder).
 * Images live per card, privately, so this writes into private/cards/<slug>/:
 *   node scripts/generate-placeholders.mjs [slug]
 *
 * Swap them for real photographs when you have them.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const SIZE = 1200;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Deterministic pseudo-random, so regenerating gives identical files. */
function makeRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function render({ seed, glow, accent }) {
  const random = makeRandom(seed);
  // scanline = 1 filter byte + width * 3 channels
  const rows = Buffer.alloc(SIZE * (1 + SIZE * 3));
  const stars = Array.from({ length: 460 }, () => ({
    x: random() * SIZE,
    y: random() * SIZE,
    r: 0.6 + random() * 1.9,
    b: 0.35 + random() * 0.65,
  }));

  for (let y = 0; y < SIZE; y++) {
    const rowStart = y * (1 + SIZE * 3);
    rows[rowStart] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      const nx = x / SIZE;
      const ny = y / SIZE;

      // Two soft radial glows over a near-black void.
      let r = 5, g = 7, b = 12;
      for (const light of glow) {
        const dx = nx - light.x;
        const dy = ny - light.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const falloff = Math.max(0, 1 - d / light.radius) ** 2.4;
        r += light.color[0] * falloff;
        g += light.color[1] * falloff;
        b += light.color[2] * falloff;
      }

      // Faint diagonal banding, like distant dust.
      const band = (Math.sin((nx * 3.1 + ny * 2.2) * Math.PI) + 1) / 2;
      r += accent[0] * band * 0.09;
      g += accent[1] * band * 0.09;
      b += accent[2] * band * 0.09;

      const offset = rowStart + 1 + x * 3;
      rows[offset] = Math.min(255, r);
      rows[offset + 1] = Math.min(255, g);
      rows[offset + 2] = Math.min(255, b);
    }
  }

  for (const star of stars) {
    const radius = Math.ceil(star.r);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = Math.round(star.x + dx);
        const y = Math.round(star.y + dy);
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        const intensity = Math.max(0, 1 - d / star.r) ** 2 * star.b * 255;
        const offset = y * (1 + SIZE * 3) + 1 + x * 3;
        rows[offset] = Math.min(255, rows[offset] + intensity);
        rows[offset + 1] = Math.min(255, rows[offset + 1] + intensity);
        rows[offset + 2] = Math.min(255, rows[offset + 2] + intensity * 1.02);
      }
    }
  }

  return encodePng(SIZE, SIZE, rows);
}

const slug = process.argv[2] ?? "2026-newyear-7k2m";
// Private, like every picture on a card: served only through the gated route.
const dir = `private/cards/${slug}`;
mkdirSync(dir, { recursive: true });

writeFileSync(
  `${dir}/image-01.png`,
  render({
    seed: 20260101,
    accent: [0, 174, 239],
    glow: [
      { x: 0.32, y: 0.38, radius: 0.62, color: [10, 90, 150] },
      { x: 0.74, y: 0.76, radius: 0.5, color: [30, 40, 110] },
    ],
  }),
);

writeFileSync(
  `${dir}/image-02.png`,
  render({
    seed: 77712,
    accent: [93, 75, 148],
    glow: [
      { x: 0.62, y: 0.3, radius: 0.58, color: [110, 70, 175] },
      { x: 0.26, y: 0.78, radius: 0.55, color: [40, 30, 90] },
    ],
  }),
);

console.log(`wrote ${dir}/image-01.png and image-02.png`);
