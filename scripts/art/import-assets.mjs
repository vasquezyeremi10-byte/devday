// Importa recursos de terceros verificados (ver docs/ASSET_CREDITS.md) y los
// normaliza a la dirección de MINA CERO: paleta global de 24 colores, alfa
// binario, recortes enteros y sin reescalado. Los packs originales viven en
// .tools/asset-downloads (ignorado por Git); aquí solo salen los recortes usados.
//   node scripts/art/import-assets.mjs
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { PALETTE } from '../../src/game/config/palette.ts';
import { blit, bounds, createImage, crop, readPng, writePng } from './png.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const DL = join(ROOT, '.tools/asset-downloads');
const OUT = join(ROOT, 'public/assets');
const KENNEY_PP = join(
  DL,
  'kenney/pixel-platformer/src/Tilemap/tilemap_packed.png',
);
const KENNEY_IND = join(
  DL,
  'kenney/pixel-platformer-industrial-expansion/src/Tilemap/tilemap_packed.png',
);
const MINERY = join(DL, 'opengameart/minery-icons/Mineria.png');
const ORES = join(
  DL,
  'opengameart/various-stones-and-oregem-veins-16x16/src/Stone_ore_gems/Stones_ores_gems_without_grass.png',
);
const TORCH = join(
  DL,
  'opengameart/treasure-hunter-game-assets/src/TreasureHunter16x16/png/objects/torch',
);
const PIXELFX_RENDERS = join(DL, 'pixelfx/renders');

const P = PALETTE;
const ALL = Object.values(P);
const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Distancia "redmean": barata y suficientemente perceptual para 24 colores. */
function nearest(r, g, b, colors) {
  let best = colors[0];
  let bestDistance = Infinity;
  for (const color of colors) {
    const [cr, cg, cb] = rgb(color);
    const rm = (r + cr) / 2;
    const d =
      (2 + rm / 256) * (r - cr) ** 2 +
      4 * (g - cg) ** 2 +
      (2 + (255 - rm) / 256) * (b - cb) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = color;
    }
  }
  return best;
}

/** Alfa binario (umbral) y cada color al más cercano de la subpaleta. */
function normalize(image, { colors = ALL, threshold = 128, map } = {}) {
  const out = createImage(image.width, image.height);
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] < threshold) continue;
    const key =
      (image.data[i] << 16) | (image.data[i + 1] << 8) | image.data[i + 2];
    const color =
      map?.(key, image.data[i], image.data[i + 1], image.data[i + 2]) ??
      nearest(image.data[i], image.data[i + 1], image.data[i + 2], colors);
    const [r, g, b] = rgb(color);
    out.data[i] = r;
    out.data[i + 1] = g;
    out.data[i + 2] = b;
    out.data[i + 3] = 255;
  }
  return out;
}

function trim(image) {
  const b = bounds(image);
  return b ? crop(image, b.x, b.y, b.w, b.h) : image;
}

const sheets = new Map();
const sheet = (path) => {
  if (!sheets.has(path)) sheets.set(path, readPng(path));
  return sheets.get(path);
};
/** Celda (o bloque de celdas) de un tilemap empaquetado sin separación. */
const cell = (path, size, c, r, w = 1, h = 1) =>
  crop(sheet(path), c * size, r * size, w * size, h * size);

/** Atlas JSON (formato hash de TexturePacker) con 1 px de separación. */
function packAtlas(name, entries) {
  const width = 256;
  let x = 0;
  let y = 0;
  let rowH = 0;
  const placed = [];
  for (const { name: frame, image } of [...entries].sort(
    (a, b) => b.image.height - a.image.height,
  )) {
    if (x + image.width > width) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    placed.push({ frame, image, x, y });
    x += image.width + 1;
    rowH = Math.max(rowH, image.height);
  }
  const height = 2 ** Math.ceil(Math.log2(y + rowH + 1));
  const atlas = createImage(width, height);
  const frames = {};
  for (const { frame, image, x: px, y: py } of placed) {
    blit(atlas, image, px, py);
    frames[frame] = {
      frame: { x: px, y: py, w: image.width, h: image.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: image.width, h: image.height },
      sourceSize: { w: image.width, h: image.height },
    };
  }
  const png = join(OUT, `${name}.png`);
  mkdirSync(dirname(png), { recursive: true });
  writePng(png, atlas);
  writeFileSync(
    join(OUT, `${name}.json`),
    JSON.stringify(
      {
        frames,
        meta: {
          image: `${name.split('/').pop()}.png`,
          size: { w: width, h: height },
          scale: '1',
        },
      },
      null,
      1,
    ),
  );
  return Object.keys(frames);
}

/** Tira horizontal de cuadros de igual tamaño. */
function strip(name, frames) {
  const w = frames[0].width;
  const h = frames[0].height;
  const image = createImage(w * frames.length, h);
  frames.forEach((frame, i) => blit(image, frame, i * w, 0));
  const png = join(OUT, `${name}.png`);
  mkdirSync(dirname(png), { recursive: true });
  writePng(png, image);
  return { frameWidth: w, frameHeight: h, frames: frames.length };
}

const report = {};

// --- Utilería de superficie y mina (Kenney CC0 + Minery Icons CC0) ---------
const PP = (c, r, w, h, opts) =>
  normalize(trim(cell(KENNEY_PP, 18, c, r, w, h)), opts);
const IND = (c, r, w, h, opts) =>
  normalize(trim(cell(KENNEY_IND, 18, c, r, w, h)), opts);
const MIN = (c, r, opts) => normalize(trim(cell(MINERY, 32, c, r)), opts);
report.props = packAtlas('structures/props', [
  { name: 'tree_poplar', image: PP(16, 0, 1, 7) },
  { name: 'plant_sprout', image: PP(4, 6) },
  { name: 'plant_grass', image: PP(5, 6) },
  { name: 'mushroom', image: PP(8, 6) },
  { name: 'crate', image: PP(6, 1) },
  { name: 'sign_arrow', image: PP(5, 4) },
  { name: 'fence_a', image: PP(5, 5) },
  { name: 'fence_b', image: PP(6, 5) },
  { name: 'door', image: PP(10, 6, 1, 2) },
  { name: 'barrel', image: IND(9, 0) },
  { name: 'barrel_band', image: IND(10, 0) },
  { name: 'cart_empty', image: MIN(1, 4) },
  { name: 'cart_loaded', image: MIN(3, 4) },
  { name: 'coal_pile', image: MIN(1, 3) },
  { name: 'ore_pile', image: MIN(3, 2) },
]);

// Equipamiento y maquinaria preparados para etapas futuras; no se cargan al iniciar.
report.equipment = packAtlas('machinery/equipment', [
  { name: 'tool_pickaxe', image: MIN(2, 0) },
  { name: 'tool_shovel', image: MIN(1, 0) },
  { name: 'tool_sledgehammer', image: MIN(4, 0) },
  { name: 'tool_helmet', image: MIN(0, 0) },
  { name: 'drill_jackhammer', image: MIN(1, 1) },
  { name: 'blast_dynamite', image: MIN(0, 4) },
  { name: 'rail_segment', image: MIN(2, 4) },
  { name: 'ladder', image: PP(11, 2, 1, 2) },
  { name: 'hoist_chain_hook', image: IND(8, 0, 1, 5) },
  { name: 'hoist_rope_hook', image: IND(7, 0, 1, 5) },
  { name: 'support_girder', image: IND(4, 0, 3, 1) },
  { name: 'support_truss', image: IND(5, 2, 1, 3) },
  { name: 'conveyor', image: IND(4, 6, 3, 1) },
  { name: 'beacon_red', image: IND(0, 4) },
  { name: 'beacon_blue', image: IND(1, 4) },
  { name: 'crate_hazard', image: IND(15, 3) },
  { name: 'hazard_sign', image: IND(10, 2, 1, 3) },
]);

// --- Minerales (senmou, CC0) ------------------------------------------------
// Filas del pack: 1 naranja, 2 blanco, 3 amarillo, 4 negro, 6 rojo, 8 cian.
// Hierro reutiliza la veta roja con tonos óxido; cuarzo la cian con tonos niebla.
const MINERALS = [
  { key: 'coal', row: 4, colors: [P.ink, P.night, P.slate, P.stone, P.steel] },
  {
    key: 'copper',
    row: 1,
    colors: [P.rust, P.clay, P.amber, P.peach, P.teal, P.mint],
  },
  { key: 'iron', row: 6, colors: [P.umber, P.rust, P.clay, P.earth] },
  { key: 'silver', row: 2, colors: [P.steel, P.silver, P.white] },
  { key: 'gold', row: 3, colors: [P.amber, P.gold, P.cream] },
  { key: 'quartz', row: 8, colors: [P.mist, P.white, P.silver] },
];
const STONE = [P.night, P.slate, P.stone, P.steel, P.silver];
const isGray = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) < 18;
/** Separa la mena (píxeles con color o extremos) de la roca gris que la rodea. */
function inclusions(image, key) {
  const out = createImage(image.width, image.height);
  for (let i = 0; i < image.data.length; i += 4) {
    if (!image.data[i + 3]) continue;
    const [r, g, b] = [image.data[i], image.data[i + 1], image.data[i + 2]];
    const light = (r + g + b) / 3;
    const ore =
      key === 'coal'
        ? light < 52
        : key === 'silver'
          ? light > 200
          : !isGray(r, g, b);
    if (ore) out.data.set(image.data.subarray(i, i + 4), i);
  }
  return out;
}
const oreSheet = sheet(ORES);
const lumps = [];
const nuggets = [];
const veins = [];
for (const mineral of MINERALS) {
  const opts = {
    colors: [...mineral.colors, ...STONE],
    map: (key, r, g, b) =>
      isGray(r, g, b) && !(mineral.key === 'silver' && r > 200)
        ? nearest(r, g, b, STONE)
        : nearest(r, g, b, mineral.colors),
  };
  lumps.push(normalize(crop(oreSheet, 0, mineral.row * 16, 16, 16), opts));
  // La pepita de carbón de la columna 5 es casi vacía; se usa el trozo de la 6.
  const nuggetColumn = mineral.key === 'coal' ? 6 : 5;
  nuggets.push(
    normalize(
      crop(oreSheet, nuggetColumn * 16, mineral.row * 16, 16, 16),
      opts,
    ),
  );
  // Veta para el tile: mena de dos variantes, una de ellas espejada.
  const vein = createImage(16, 16);
  const a = inclusions(
    crop(oreSheet, 16, mineral.row * 16, 16, 16),
    mineral.key,
  );
  const b = inclusions(
    crop(oreSheet, 48, mineral.row * 16, 16, 16),
    mineral.key,
  );
  const mirrored = createImage(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      mirrored.data.set(
        b.data.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4),
        (((y + 9) % 16) * 16 + (15 - x)) * 4,
      );
  blit(vein, a, 0, -2);
  blit(vein, mirrored, 0, 0);
  veins.push(normalize(vein, { colors: mineral.colors }));
}
report.minerals = strip('environments/minerals/mineral_items', [
  ...lumps,
  ...nuggets,
]);
report.veins = strip('environments/minerals/ore_veins', veins);

// --- Antorcha (Treasure Hunter, CC0): mango + 4 llamas ---------------------
{
  const handle = readPng(join(TORCH, 'torch.png'));
  const frames = [1, 2, 3, 4].map((n) => {
    const frame = createImage(8, 16);
    blit(frame, readPng(join(TORCH, `tfire${n}.png`)), 1, 2);
    blit(frame, handle, 1, 8);
    return normalize(frame, {
      colors: [
        P.ink,
        P.umber,
        P.earth,
        P.clay,
        P.amber,
        P.gold,
        P.cream,
        P.red,
        P.rust,
        P.stone,
        P.steel,
      ],
    });
  });
  report.torch = strip('environments/underground/torch', frames);
}

// --- Efectos PixelFX (MIT) ------------------------------------------------
const PIXELFX = existsSync(join(DL, 'pixelfx/src'))
  ? join(DL, 'pixelfx/src', readdirSync(join(DL, 'pixelfx/src'))[0])
  : null;
const EFFECTS = [
  {
    id: 'impacts/hit-spark',
    out: 'effects/fx_pick_spark',
    step: 2,
    colors: [P.white, P.cream, P.gold, P.amber],
  },
  {
    id: 'impacts/blunt-hit',
    out: 'effects/fx_dust',
    step: 2,
    colors: [P.sand, P.clay, P.earth, P.umber, P.cream],
  },
  {
    id: 'pickups/collect-burst',
    out: 'effects/fx_collect',
    step: 2,
    colors: [P.white, P.cream, P.gold, P.mint],
  },
];
report.effects = {};
for (const effect of EFFECTS) {
  const name = effect.id.split('/')[1];
  const dir = join(PIXELFX_RENDERS, effect.id);
  if (PIXELFX && !existsSync(join(dir, `${name}.png`)))
    execFileSync(process.execPath, [
      join(PIXELFX, 'tools/render.mjs'),
      effect.id,
      '--sheet',
      '--no-actor',
      '--bg',
      'none',
      '--max',
      '4',
      '--out',
      PIXELFX_RENDERS,
    ]);
  const meta = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
  const src = readPng(join(dir, `${name}.png`));
  const [fw, fh] = meta.meta.pixelfx.frameSize;
  const columns = meta.meta.pixelfx.columns;
  const frames = [];
  for (let i = 0; i < meta.meta.pixelfx.frames; i += effect.step) {
    const frame = normalize(
      crop(src, (i % columns) * fw, Math.floor(i / columns) * fh, fw, fh),
      { colors: effect.colors, threshold: 160 },
    );
    if (bounds(frame)) frames.push(frame);
  }
  // Recorte común a todos los cuadros para conservar el pivote relativo.
  let box = null;
  for (const frame of frames) {
    const b = bounds(frame);
    box = box
      ? {
          x: Math.min(box.x, b.x),
          y: Math.min(box.y, b.y),
          r: Math.max(box.r, b.x + b.w),
          b: Math.max(box.b, b.y + b.h),
        }
      : { x: b.x, y: b.y, r: b.x + b.w, b: b.y + b.h };
  }
  const cropped = frames.map((f) =>
    crop(f, box.x, box.y, box.r - box.x, box.b - box.y),
  );
  const info = strip(effect.out, cropped);
  const [px, py] = meta.meta.pixelfx.pivot;
  report.effects[effect.out] = {
    ...info,
    fps: Math.round(meta.meta.pixelfx.fps / effect.step),
    originX: +((px - box.x) / (box.r - box.x)).toFixed(3),
    originY: +((py - box.y) / (box.b - box.y)).toFixed(3),
  };
}

// --- Audio (Kenney Impact Sounds, CC0) -----------------------------------
const AUDIO = join(DL, 'kenney/impact-sounds/src/Audio');
mkdirSync(join(OUT, 'audio'), { recursive: true });
report.audio = [];
for (const file of [
  'impactMining_000',
  'impactMining_001',
  'impactMining_002',
  'impactSoft_medium_000',
  'impactSoft_medium_001',
  'impactGlass_light_002',
]) {
  copyFileSync(join(AUDIO, `${file}.ogg`), join(OUT, `audio/${file}.ogg`));
  report.audio.push(file);
}

// --- Licencias que deben acompañar a los recursos -------------------------
mkdirSync(join(OUT, 'licenses'), { recursive: true });
copyFileSync(
  join(DL, 'kenney/pixel-platformer/src/License.txt'),
  join(OUT, 'licenses/kenney-pixel-platformer-License.txt'),
);
copyFileSync(
  join(DL, 'kenney/pixel-platformer-industrial-expansion/src/License.txt'),
  join(OUT, 'licenses/kenney-industrial-expansion-License.txt'),
);
copyFileSync(
  join(DL, 'kenney/impact-sounds/src/License.txt'),
  join(OUT, 'licenses/kenney-impact-sounds-License.txt'),
);
if (PIXELFX)
  copyFileSync(
    join(PIXELFX, 'LICENSE'),
    join(OUT, 'licenses/pixelfx-MIT-LICENSE.txt'),
  );

// El informe documenta medidas y orígenes de los efectos; no se publica.
writeFileSync(
  join(ROOT, 'art/import-report.json'),
  JSON.stringify(report, null, 1),
);
console.log(JSON.stringify(report, null, 1));
