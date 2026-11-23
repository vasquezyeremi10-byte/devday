// Prepara el fondo del menú principal: convierte la ilustración original
// (1672 × 941, aportada por el usuario) en pixel art nítido a la resolución
// nativa del juego, 480 × 270, y la guarda como PNG opaco en
// public/assets/ui/menu-bg.png.
//   node scripts/art/build-menu-bg.mjs [--preview]
// Opcionalmente acepta MENU_BG_SOURCE y MENU_BG_OUT para preparar variantes
// sin sobrescribir el fondo vigente durante una revisión artística.
// El original vive en .tools/asset-downloads/menu-bg (ignorado por Git).
//
// Por qué: la ilustración es una pintura de tono continuo (612 000 colores).
// Reducida solo con promedio, quedaba blanda y con ~100 000 colores en
// 480 × 270 píxeles, junto a una interfaz de colores planos. Aquí se reduce
// por áreas (la versión fiel), se realzan los bordes, se limita la paleta sin
// tramado (los degradados del cielo quedan en bandas, como en el pixel art) y
// se limpian los píxeles sueltos. La composición no cambia.
//
// Sin dependencias: decodifica y escribe PNG con ./png.mjs.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  areaResample,
  buildPalette,
  countColors,
  quantize,
  removeSpeckles,
  sharpen,
  upscaleNearest,
} from './pixelate.mjs';
import { readPng, writePng } from './png.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const SOURCE = resolve(
  ROOT,
  process.env.MENU_BG_SOURCE ?? '.tools/asset-downloads/menu-bg/menu-bg-original.png',
);
const OUT = resolve(ROOT, process.env.MENU_BG_OUT ?? 'public/assets/ui/menu-bg.png');
const WIDTH = 480;
const HEIGHT = 270;
/** Colores de la paleta del fondo y fuerza del realce de bordes. */
const COLORS = Number(process.env.MENU_BG_COLORS ?? 112);
const SHARPEN = Number(process.env.MENU_BG_SHARPEN ?? 0.9);

const source = readPng(SOURCE);
const small = areaResample(source, WIDTH, HEIGHT);
const crisp = sharpen(small, SHARPEN);
const palette = buildPalette(crisp, COLORS);
const flat = quantize(crisp, palette);
const clean = removeSpeckles(flat, 2200, 2);
mkdirSync(join(ROOT, 'public/assets/ui'), { recursive: true });
writePng(OUT, clean);
console.log(
  `Fondo del menú escrito en ${OUT} (${WIDTH}×${HEIGHT}, ${countColors(clean)} colores, realce ${SHARPEN})`,
);
if (process.argv.includes('--preview'))
  writePng(join(ROOT, 'docs/screenshots/menu-bg-preview-x4.png'), upscaleNearest(clean, 4));
