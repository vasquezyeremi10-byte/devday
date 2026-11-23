// Recorta una región de un PNG (para revisar detalles de las capturas).
//   node scripts/art/crop-png.mjs <entrada.png> <salida.png> <x> <y> <ancho> <alto>
import { readPng, writePng } from './png.mjs';

const [input, output, x, y, w, h] = process.argv.slice(2);
if (!output) throw new Error('Uso: crop-png.mjs <entrada> <salida> <x> <y> <w> <h>');
const src = readPng(input);
const [cx, cy, cw, ch] = [x, y, w, h].map(Number);
const out = new Uint8Array(cw * ch * 4);
for (let j = 0; j < ch; j++)
  for (let i = 0; i < cw; i++) {
    const s = ((cy + j) * src.width + cx + i) * 4;
    const o = (j * cw + i) * 4;
    out.set(src.data.subarray(s, s + 4), o);
  }
writePng(output, { width: cw, height: ch, data: out });
