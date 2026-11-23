// Migración de recursos PNG a la paleta V6: cambia cada color histórico por
// el tono V6 del mismo nombre (intercambio exacto de paleta, sin filtros ni
// mezcla). Idempotente: los colores que ya son V6 no se tocan.
// Uso: node scripts/art/remap-palette-v6.mjs
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LEGACY_PALETTE, PALETTE } from '../../src/game/config/palette.ts';
import { readPng, writePng } from './png.mjs';

const map = new Map();
for (const [name, old] of Object.entries(LEGACY_PALETTE))
  map.set(old, PALETTE[name]);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith('.png')) files.push(path);
  }
};
walk('public/assets');

for (const path of files) {
  const image = readPng(path);
  let changed = 0;
  let foreign = 0;
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const rgb = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    const next = map.get(rgb);
    if (next === undefined) {
      if (!Object.values(PALETTE).includes(rgb)) foreign++;
      continue;
    }
    if (next === rgb) continue;
    d[i] = (next >> 16) & 255;
    d[i + 1] = (next >> 8) & 255;
    d[i + 2] = next & 255;
    changed++;
  }
  if (changed) writePng(path, image);
  console.log(
    `${path}: ${changed} px remapeados${foreign ? `, ${foreign} px fuera de paleta` : ''}`,
  );
}
