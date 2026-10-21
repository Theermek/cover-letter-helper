/**
 * Generates the extension icons as PNGs with no image dependencies.
 * Run: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [79, 70, 229]; // indigo
const FG = [255, 255, 255];

/** Signed distance helpers in normalised 0..1 coords. */
const insideRoundedSquare = (x, y, r) => {
  const dx = Math.max(r - x, 0, x - (1 - r));
  const dy = Math.max(r - y, 0, y - (1 - r));
  return Math.hypot(dx, dy) <= r;
};

const nearSegment = (x, y, ax, ay, bx, by, w) => {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - (ax + t * vx), y - (ay + t * vy)) <= w;
};

/** Returns [r,g,b,a] for a point: an envelope glyph on a rounded indigo tile. */
const sample = (x, y) => {
  if (!insideRoundedSquare(x, y, 0.22)) return [0, 0, 0, 0];

  const bodyL = 0.2;
  const bodyR = 0.8;
  const bodyT = 0.3;
  const bodyB = 0.72;
  const inBody = x >= bodyL && x <= bodyR && y >= bodyT && y <= bodyB;
  if (!inBody) return [...BG, 255];

  // The flap: two strokes from the top corners meeting at the middle.
  const stroke = 0.035;
  const midY = bodyT + 0.22;
  const onFlap =
    nearSegment(x, y, bodyL, bodyT, 0.5, midY, stroke) ||
    nearSegment(x, y, bodyR, bodyT, 0.5, midY, stroke);
  return onFlap ? [...BG, 255] : [...FG, 255];
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const png = (size) => {
  const ss = 3; // supersampling factor for smooth edges
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    const rowStart = py * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [r, g, b, a] = sample((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
          acc = [acc[0] + r * a, acc[1] + g * a, acc[2] + b * a, acc[3] + a];
        }
      }
      const n = ss * ss;
      const alpha = acc[3] / n;
      const off = rowStart + 1 + px * 4;
      // Un-premultiply so edge pixels keep their colour.
      raw[off] = acc[3] ? Math.round(acc[0] / acc[3]) : 0;
      raw[off + 1] = acc[3] ? Math.round(acc[1] / acc[3]) : 0;
      raw[off + 2] = acc[3] ? Math.round(acc[2] / acc[3]) : 0;
      raw[off + 3] = Math.round(alpha);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

mkdirSync('public/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = `public/icons/icon${size}.png`;
  writeFileSync(file, png(size));
  console.log(`wrote ${file}`);
}
