// Recursos originales V2: píxeles enteros, paleta compartida, alfa binario.
import { mkdirSync } from 'node:fs';
import { PALETTE as P } from '../../src/game/config/palette.ts';
import { readPng, writePng } from './png.mjs';

const dir = 'public/assets/interactions';
mkdirSync(dir, { recursive: true });
function sheet(w, h, count, draw, file) {
  const image = {
    width: w * count,
    height: h,
    data: new Uint8Array(w * count * h * 4),
  };
  for (let f = 0; f < count; f++) {
    const rect = (x, y, rw, rh, color) => {
      for (let j = y; j < y + rh; j++)
        for (let i = x; i < x + rw; i++) {
          if (i < 0 || i >= w || j < 0 || j >= h) continue;
          const n = (j * image.width + f * w + i) * 4;
          image.data.set(
            [(color >> 16) & 255, (color >> 8) & 255, color & 255, 255],
            n,
          );
        }
    };
    draw(rect, f);
  }
  writePng(`${dir}/${file}.png`, image);
}
sheet(
  16,
  16,
  8,
  (r, f) => {
    if (f === 7) {
      const draw = r;
      r = (x, y, w, h, color) => {
        for (let j = y; j < y + h; j++)
          for (let i = x; i < x + w; i++)
            if ((i + j) % 2 === 0) draw(i, j, 1, 1, color);
      };
    }
    if (f < 3) {
      const metal = [P.silver, P.steel, P.mint][f];
      for (let i = 0; i < 9; i++) {
        r(4 + Math.floor(i / 2), 13 - i, 2, 2, P.ink);
        r(4 + Math.floor(i / 2), 13 - i, 1, 1, P.clay);
      }
      r(3, 3, 10, 2, P.ink);
      r(4, 3, 8, 1, metal);
      r(12, 4, 2, 3, metal);
      r(2, 4, 2, 2, metal);
    } else if (f === 3) {
      r(7, 2, 2, 9, P.ink);
      r(7, 3, 1, 8, P.clay);
      r(5, 9, 6, 5, P.ink);
      r(6, 10, 4, 3, P.silver);
    } else if (f === 4 || f === 7) {
      r(1, 10, 5, 6, P.ink);
      r(10, 10, 5, 6, P.ink);
      r(2, 11, 3, 4, P.earth);
      r(11, 11, 3, 4, P.earth);
      r(0, 10, 16, 3, P.ink);
      r(0, 10, 16, 1, P.silver);
      r(0, 11, 16, 1, P.steel);
      r(3, 11, 1, 1, P.cream);
      r(12, 11, 1, 1, P.cream);
    } else {
      r(3, 8, 10, 6, P.ink);
      r(5, 5, 6, 8, f === 5 ? P.earth : P.stone);
      r(3, 9, 10, 4, f === 5 ? P.earth : P.stone);
      r(5, 6, 4, 2, f === 5 ? P.clay : P.silver);
    }
  },
  'items',
);
// Variantes equipadas: cambiar solo el acero de la hoja, nunca teñir el personaje.
for (const [name, color] of [
  ['tungsten', P.steel],
  ['diamond', P.mint],
]) {
  const png = readPng(
    'public/assets/characters/player/character_miner_v01.png',
  );
  for (let i = 0; i < png.data.length; i += 4) {
    const c = png.data[i] * 65536 + png.data[i + 1] * 256 + png.data[i + 2];
    if (c === P.silver)
      png.data.set([(color >> 16) & 255, (color >> 8) & 255, color & 255], i);
  }
  writePng(`${dir}/miner-${name}.png`, png);
}
