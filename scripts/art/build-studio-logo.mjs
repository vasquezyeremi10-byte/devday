// Prepara el logotipo del estudio THE MINERS CL para la introducción.
// Convierte el emblema original aportado por el usuario (1254 × 1254, con
// transparencia) en pixel art nítido a la resolución del juego sin rediseñarlo:
// recorta los márgenes transparentes, conserva la proporción y genera una tira
// de cuadros de tamaño creciente (2 px por paso) para el zoom lento de la
// introducción. Así el zoom avanza en píxeles enteros y nunca se escala con un
// factor fraccionario dentro del juego.
//   node scripts/art/build-studio-logo.mjs
// Original: .tools/asset-downloads/studio-logo (ignorado por Git).
// Salida: public/assets/ui/studio-logo.png (cuadros de FRAME × FRAME).
//
// Cada cuadro se reduce por áreas, se realzan los bordes y se limita la
// paleta sin tramado (una sola paleta para los siete cuadros, así los colores
// no cambian al crecer el zoom), con alfa binario. Antes se reducía solo con
// suavizado: 74 000 colores y bordes blandos. Sin dependencias: usa
// ./pixelate.mjs y ./png.mjs.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  areaResample,
  buildPalette,
  countColors,
  quantize,
  removeSpeckles,
  sharpen,
} from './pixelate.mjs';
import { readPng, writePng } from './png.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const SOURCE = join(
  ROOT,
  '.tools/asset-downloads/studio-logo/the-miners-cl-original.png',
);
const OUT = join(ROOT, 'public/assets/ui/studio-logo.png');
// Debe coincidir con SPLASH.studio.logo en src/game/config/splash.ts.
const SIZES = [200, 202, 204, 206, 208, 210, 212];
const FRAME = Math.max(...SIZES);
const COLORS = Number(process.env.LOGO_COLORS ?? 56);
const SHARPEN = Number(process.env.LOGO_SHARPEN ?? 0.8);

/** Recorta la imagen a su contenido (alfa > 8). */
function cropToContent(img) {
  const { width, height, data } = img;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    out.set(
      data.subarray(((y0 + y) * width + x0) * 4, ((y0 + y) * width + x0 + w) * 4),
      y * w * 4,
    );
  return { width: w, height: h, data: out };
}

const content = cropToContent(readPng(SOURCE));
const longSide = Math.max(content.width, content.height);
/** Cuadro `size`: lado mayor = size, proporción original, centrado en FRAME². */
function frameOf(size) {
  const w = Math.round((content.width * size) / longSide);
  const h = Math.round((content.height * size) / longSide);
  return { small: sharpen(areaResample(content, w, h), SHARPEN), w, h };
}
const frames = SIZES.map(frameOf);
// Paleta común, calculada con el cuadro más grande.
const palette = buildPalette(frames.at(-1).small, COLORS);
const strip = new Uint8Array(FRAME * SIZES.length * FRAME * 4);
const stripWidth = FRAME * SIZES.length;
frames.forEach(({ small, w, h }, i) => {
  const flat = removeSpeckles(quantize(small, palette), 2200, 1);
  const ox = i * FRAME + Math.floor((FRAME - w) / 2);
  const oy = Math.floor((FRAME - h) / 2);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = ((oy + y) * stripWidth + ox + x) * 4;
      strip.set(flat.data.subarray(s, s + 4), d);
    }
});
mkdirSync(join(ROOT, 'public/assets/ui'), { recursive: true });
writePng(OUT, { width: stripWidth, height: FRAME, data: strip });
console.log(
  `Logo del estudio escrito en ${OUT} (${SIZES.length} cuadros de ${FRAME}×${FRAME}, ${countColors({ data: strip })} colores)`,
);
