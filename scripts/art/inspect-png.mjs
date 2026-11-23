// Diagnóstico de nitidez de un PNG: colores únicos, suavidad de los bordes
// y cuántos píxeles son «intermedios» (mezcla de dos vecinos), que es lo que
// delata un reescalado con suavizado.
//   node scripts/art/inspect-png.mjs public/assets/ui/menu-bg.png
import { readPng } from './png.mjs';

const path = process.argv[2];
if (!path) throw new Error('Uso: node scripts/art/inspect-png.mjs <png>');
const { width, height, data } = readPng(path);
const px = (x, y) => {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
};
const key = ([r, g, b]) => (r << 16) | (g << 8) | b;
const unique = new Set();
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) unique.add(key(px(x, y)));
// Píxel «intermedio»: su color está (casi) en el segmento entre dos vecinos
// opuestos que difieren mucho entre sí, o sea, un escalón suavizado.
let blended = 0;
let edges = 0;
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
for (let y = 1; y < height - 1; y++)
  for (let x = 1; x < width - 1; x++) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const a = px(x - dx, y - dy);
      const b = px(x + dx, y + dy);
      const c = px(x, y);
      const span = dist(a, b);
      if (span < 90) continue;
      edges++;
      // c queda entre a y b y a distinta distancia de ambos: escalón blando.
      if (dist(a, c) > 24 && dist(c, b) > 24 && dist(a, c) + dist(c, b) <= span + 18) blended++;
    }
  }
console.log(
  JSON.stringify({
    path,
    size: `${width}x${height}`,
    uniqueColors: unique.size,
    edgeSamples: edges,
    softSteps: blended,
    softRatio: +(blended / Math.max(1, edges)).toFixed(3),
  }),
);
