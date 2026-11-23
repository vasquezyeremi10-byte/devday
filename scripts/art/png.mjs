// Lectura y escritura PNG mínima (8 bits, RGBA/RGB/gris/indexado) sin dependencias.
import { readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Devuelve { width, height, data: Uint8Array RGBA }. */
export function readPng(path) {
  const buf = readFileSync(path);
  if (!buf.subarray(0, 8).equals(SIGNATURE))
    throw new Error(`No es PNG: ${path}`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  let palette = null;
  let trns = null;
  const idat = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const name = buf.toString('latin1', offset + 4, offset + 8);
    const chunk = buf.subarray(offset + 8, offset + 8 + length);
    if (name === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      depth = chunk[8];
      type = chunk[9];
      interlace = chunk[12];
    } else if (name === 'PLTE') palette = chunk;
    else if (name === 'tRNS') trns = chunk;
    else if (name === 'IDAT') idat.push(chunk);
    else if (name === 'IEND') break;
    offset += 12 + length;
  }
  if (interlace) throw new Error(`PNG entrelazado no soportado: ${path}`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels || (type !== 3 && depth !== 8))
    throw new Error(`Formato PNG no soportado (${type}/${depth}): ${path}`);
  const bitsPerPixel = channels * depth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const raw = inflateSync(Buffer.concat(idat));
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = rows.subarray(y * stride, (y + 1) * stride);
    const prev = y ? rows.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[x] = v & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const row = y * stride;
      if (type === 3) {
        const bit = x * depth;
        const index =
          (rows[row + (bit >> 3)] >> (8 - depth - (bit & 7))) &
          ((1 << depth) - 1);
        data[i] = palette[index * 3];
        data[i + 1] = palette[index * 3 + 1];
        data[i + 2] = palette[index * 3 + 2];
        data[i + 3] = trns && index < trns.length ? trns[index] : 255;
      } else {
        const p = row + x * channels;
        const gray = type === 0 || type === 4;
        data[i] = rows[p];
        data[i + 1] = gray ? rows[p] : rows[p + 1];
        data[i + 2] = gray ? rows[p] : rows[p + 2];
        data[i + 3] = type === 6 ? rows[p + 3] : type === 4 ? rows[p + 1] : 255;
      }
    }
  return { width, height, data };
}

function chunk(name, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(name, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** Escribe RGBA de 8 bits sin filtro; los recursos son pequeños. */
export function writePng(path, { width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  writeFileSync(
    path,
    Buffer.concat([
      SIGNATURE,
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

export const createImage = (width, height) => ({
  width,
  height,
  data: new Uint8Array(width * height * 4),
});

export function crop(image, x, y, w, h) {
  const out = createImage(w, h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const s = ((y + j) * image.width + x + i) * 4;
      const d = (j * w + i) * 4;
      out.data.set(image.data.subarray(s, s + 4), d);
    }
  return out;
}

/** Copia píxeles opacos de src sobre dst (sin mezclas). */
export function blit(dst, src, dx, dy) {
  for (let j = 0; j < src.height; j++)
    for (let i = 0; i < src.width; i++) {
      const s = (j * src.width + i) * 4;
      if (src.data[s + 3] === 0) continue;
      const x = dx + i;
      const y = dy + j;
      if (x < 0 || y < 0 || x >= dst.width || y >= dst.height) continue;
      dst.data.set(src.data.subarray(s, s + 4), (y * dst.width + x) * 4);
    }
}

/** Rectángulo mínimo con píxeles opacos, o null si está vacío. */
export function bounds(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++)
      if (image.data[(y * image.width + x) * 4 + 3]) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
  return maxX < 0
    ? null
    : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
