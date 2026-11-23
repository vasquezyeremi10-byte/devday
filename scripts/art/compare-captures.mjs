// Compara capturas «antes» y «después» (docs/screenshots/pixel-*): colores
// distintos en la imagen lógica de 480 × 270 y bloques no uniformes.
//   node scripts/art/compare-captures.mjs menu-1920 game-1920
import { readPng } from './png.mjs';

for (const name of process.argv.slice(2)) {
  const row = { captura: name };
  for (const label of ['before', 'after']) {
    const img = readPng(`docs/screenshots/pixel-${label}-${name}.png`);
    // El lienzo es el mayor múltiplo entero de 480 × 270 que cabe, centrado.
    const f = Math.floor(Math.min(img.width / 480, img.height / 270));
    const ox = Math.floor((img.width - 480 * f) / 2);
    const oy = Math.floor((img.height - 270 * f) / 2);
    const colors = new Set();
    let bad = 0;
    for (let gy = 0; gy < 270; gy++)
      for (let gx = 0; gx < 480; gx++) {
        const base = ((oy + gy * f) * img.width + ox + gx * f) * 4;
        colors.add((img.data[base] << 16) | (img.data[base + 1] << 8) | img.data[base + 2]);
        let same = true;
        for (let dy = 0; dy < f && same; dy++)
          for (let dx = 0; dx < f; dx++) {
            const i = ((oy + gy * f + dy) * img.width + ox + gx * f + dx) * 4;
            if (img.data[i] !== img.data[base] || img.data[i + 1] !== img.data[base + 1] || img.data[i + 2] !== img.data[base + 2]) {
              same = false;
              break;
            }
          }
        if (!same) bad++;
      }
    row[label] = { tamaño: `${img.width}x${img.height}`, colores: colors.size, bloquesIrregulares: bad };
  }
  console.log(JSON.stringify(row));
}
