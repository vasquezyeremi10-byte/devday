// Fuente del minero en Pixelorama. Cada cuadro se compone píxel a píxel con
// poses explícitas; el resultado se guarda como .pxo editable y Pixelorama
// exporta la hoja de sprites que usa el juego.
//   node scripts/art/build-miner.mjs [--preview]
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PALETTE } from '../../src/game/config/palette.ts';
import { exportSpritesheet, writePxo } from './pixelorama.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const PXO = resolve(ROOT, 'art/pixelorama/character_miner_v01.pxo');
const PNG = resolve(
  ROOT,
  'public/assets/characters/player/character_miner_v01.png',
);
const W = 16;
const H = 24;
const FPS = 12;
const LAYERS = ['contorno', 'pico_atras', 'cuerpo', 'pico', 'brazo'];
const C = PALETTE;

function createFrame() {
  const layers = Object.fromEntries(
    LAYERS.map((name) => [name, new Array(W * H).fill(null)]),
  );
  const sparks = new Set();
  const put = (layer, x, y, color, spark = false) => {
    // Margen de 1 px para el contorno automático; las chispas pueden tocar el borde.
    const min = spark ? 0 : 1;
    if (x < min || y < min || x > W - 1 - min || y > H - 1 - min)
      throw new Error(`Píxel fuera del cuadro: ${layer} ${x},${y}`);
    layers[layer][y * W + x] = color;
    if (spark) sparks.add(y * W + x);
  };
  const rect = (layer, x, y, w, h, color) => {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) put(layer, x + i, y + j, color);
  };
  const line = (layer, [x0, y0], [x1, y1], color, thick = 1) => {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      for (let t = 0; t < thick; t++) put(layer, x0 + t, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  };
  /** Contorno de 1 px alrededor de los rellenos que no son tinta. */
  const finish = () => {
    const filled = (i) =>
      LAYERS.some((name) => layers[name][i] !== null && !sparks.has(i));
    const light = (i) =>
      !sparks.has(i) &&
      LAYERS.some(
        (name) => layers[name][i] !== null && layers[name][i] !== C.ink,
      );
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (filled(i) || sparks.has(i)) continue;
        const near = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          return nx >= 0 && ny >= 0 && nx < W && ny < H && light(ny * W + nx);
        });
        if (near) layers.contorno[i] = C.ink;
      }
    return LAYERS.map((name) => {
      const rgba = new Uint8Array(W * H * 4);
      layers[name].forEach((color, i) => {
        if (color === null) return;
        rgba[i * 4] = (color >> 16) & 255;
        rgba[i * 4 + 1] = (color >> 8) & 255;
        rgba[i * 4 + 2] = color & 255;
        rgba[i * 4 + 3] = 255;
      });
      return rgba;
    });
  };
  return { put, rect, line, finish };
}

/** Pierna de 2 px desde la cadera hasta el talón; bota con punta hacia delante. */
function leg(f, { hip, x, lift = 0, knee }, by, color) {
  const top = [hip, 16 + by];
  const foot = [x, 20 - lift];
  if (knee) {
    f.line('cuerpo', top, knee, color, 2);
    f.line('cuerpo', knee, foot, color, 2);
  } else f.line('cuerpo', top, foot, color, 2);
  f.rect('cuerpo', x, 21 - lift, 3, 1, C.ink);
  f.rect('cuerpo', x, 22 - lift, 4, 1, C.ink);
}

function arm(f, layer, shoulder, hand, sleeve) {
  f.line(layer, shoulder, hand, sleeve);
  f.rect(layer, hand[0], hand[1], 2, 2, C.peach);
}

function head(f, x, y) {
  f.rect('cuerpo', 6 + x, 3 + y, 4, 1, C.gold);
  f.rect('cuerpo', 5 + x, 4 + y, 6, 2, C.gold);
  f.rect('cuerpo', 4 + x, 6 + y, 8, 1, C.gold);
  f.put('cuerpo', 6 + x, 4 + y, C.cream);
  f.put('cuerpo', 11 + x, 4 + y, C.cream);
  f.put('cuerpo', 11 + x, 5 + y, C.cream);
  f.rect('cuerpo', 6 + x, 7 + y, 5, 1, C.peach);
  f.rect('cuerpo', 6 + x, 8 + y, 6, 1, C.peach);
  f.rect('cuerpo', 7 + x, 9 + y, 4, 1, C.peach);
  f.put('cuerpo', 5 + x, 7 + y, C.pine);
  f.put('cuerpo', 5 + x, 8 + y, C.pine);
  f.put('cuerpo', 9 + x, 7 + y, C.ink);
}

/** Mango de madera, hoja de acero y punta sombreada; delante o detrás del cuerpo. */
function pick(f, { butt, end, blade, tip, behind = false }) {
  const layer = behind ? 'pico_atras' : 'pico';
  f.line(layer, butt, end, C.clay);
  f.line(layer, blade[0], blade[1], C.silver);
  f.put(layer, tip[0], tip[1], C.steel);
}

/** Pala: mango de madera y hoja rectangular; `soil` dibuja tierra sobre la hoja. */
function shovel(f, { butt, end, blade, soil }) {
  f.line('pico', butt, end, C.clay);
  const [x, y, w, h] = blade;
  f.rect('pico', x, y, w, h, C.silver);
  f.rect('pico', x, y + h - 1, w, 1, C.steel);
  for (const [sx, sy] of soil ?? []) f.put('brazo', sx, sy, C.earth, true);
}

/** Roca cargada con ambas manos frente al pecho. */
function rock(f, x, y) {
  f.rect('pico', x, y, 5, 4, C.stone);
  f.rect('pico', x + 1, y, 3, 1, C.steel);
  f.rect('pico', x, y + 3, 5, 1, C.slate);
}

function miner(pose) {
  const f = createFrame();
  const by = pose.by ?? 0;
  const lean = pose.lean ?? 0;
  leg(f, pose.back, by, C.ink);
  arm(f, 'cuerpo', [6 + lean, 10 + by], pose.backHand, C.pine);
  f.rect('cuerpo', 5, 10 + by, 6, 4, C.teal);
  f.rect('cuerpo', 5, 10 + by, 1, 4, C.pine);
  f.rect('cuerpo', 5, 14 + by, 6, 2, C.pine);
  f.put('cuerpo', 9, 14 + by, C.gold);
  leg(f, pose.front, by, C.pine);
  head(f, lean, by);
  if (pose.pick) pick(f, pose.pick);
  if (pose.shovel) shovel(f, pose.shovel);
  if (pose.rock) rock(f, ...pose.rock);
  arm(f, 'brazo', [9 + lean, 10 + by], pose.hand, C.teal);
  for (const [x, y] of pose.sparks ?? []) f.put('brazo', x, y, C.cream, true);
  return f.finish();
}

const BACK = 5;
const FRONT = 8;
/**
 * Pico vertical en la mano delantera. `sway` inclina la hoja y `dx` desplaza
 * mano y pico: el brazo delantero oscila opuesto a la pierna delantera.
 */
const carry = (by, sway = 0, dx = 0) => ({
  butt: [13 + dx, 19 + by],
  end: [13 + sway + dx, 10 + by],
  blade: [
    [11 + sway + dx, 9 + by],
    [14 + sway + dx, 9 + by],
  ],
  tip: [14 + sway + dx, 10 + by],
});
const stand = (by, backHand = [4, 13 + by]) => ({
  by,
  back: { hip: BACK, x: 3 },
  front: { hip: FRONT, x: 8 },
  backHand,
  hand: [12, 13 + by],
  pick: carry(by),
});
/**
 * Ciclo de marcha: cuando la pierna delantera (oscura clara) avanza, el brazo
 * trasero avanza y el delantero retrocede (dx -1); en el paso opuesto se invierte.
 */
const walk = (by, front, back, backHandX, sway, dx = 0, lean = 0) => ({
  by,
  lean,
  front: { hip: FRONT, ...front },
  back: { hip: BACK, ...back },
  backHand: [backHandX, 13 + by],
  hand: [12 + dx, 13 + by],
  pick: carry(by, sway, dx),
});

const ANIMATIONS = [
  {
    name: 'idle',
    color: 'f8c058ff',
    duration: 3,
    poses: [stand(0), stand(0, [4, 12]), stand(1), stand(1, [4, 13])],
  },
  {
    name: 'walk',
    color: '70b890ff',
    duration: 1,
    poses: [
      // Paso 1: pierna delantera adelante, brazo trasero adelante.
      walk(0, { x: 10 }, { x: 2 }, 7, 0, -1),
      walk(1, { x: 9 }, { x: 3, lift: 1 }, 6, 0, -1),
      // Paso intermedio: piernas cruzando, brazos al centro.
      walk(0, { x: 7 }, { x: 5, lift: 2 }, 5, -1, 0),
      walk(-1, { x: 5 }, { x: 8, lift: 1 }, 4, -1, 0),
      // Paso 2: pierna trasera adelante, brazo trasero atrás.
      walk(0, { x: 3 }, { x: 10 }, 3, 0, 0),
      walk(1, { x: 4, lift: 1 }, { x: 9 }, 4, 0, 0),
      walk(0, { x: 6, lift: 2 }, { x: 7 }, 5, -1, -1),
      walk(-1, { x: 8, lift: 1 }, { x: 5 }, 6, -1, -1),
    ],
  },
  {
    name: 'jump',
    color: '587ca0ff',
    duration: 2,
    poses: [
      {
        ...stand(-1, [3, 8]),
        front: { hip: FRONT, x: 10, lift: 3, knee: [10, 15] },
        back: { hip: BACK, x: 3 },
      },
      {
        ...stand(0, [3, 10]),
        front: { hip: FRONT, x: 10, lift: 3, knee: [10, 16] },
        back: { hip: BACK, x: 4, lift: 2, knee: [4, 17] },
      },
      {
        ...stand(-1, [2, 7]),
        front: { hip: FRONT, x: 10 },
        back: { hip: BACK, x: 3, lift: 1 },
      },
      {
        ...stand(2, [3, 15]),
        front: { hip: FRONT, x: 10 },
        back: { hip: BACK, x: 2 },
      },
    ],
  },
  {
    name: 'mine',
    color: 'd85040ff',
    duration: 2 / 3,
    poses: [
      {
        by: 0,
        lean: -1,
        back: { hip: BACK, x: 2 },
        front: { hip: FRONT, x: 9 },
        backHand: [5, 7],
        hand: [7, 8],
        pick: {
          butt: [9, 10],
          end: [3, 2],
          blade: [
            [2, 3],
            [4, 1],
          ],
          tip: [1, 4],
          behind: true,
        },
      },
      {
        by: -1,
        back: { hip: BACK, x: 3 },
        front: { hip: FRONT, x: 9 },
        backHand: [9, 7],
        hand: [10, 5],
        pick: {
          butt: [11, 9],
          end: [11, 2],
          blade: [
            [8, 1],
            [13, 1],
          ],
          tip: [13, 2],
        },
      },
      {
        by: 0,
        lean: 1,
        back: { hip: BACK, x: 2 },
        front: { hip: FRONT, x: 10 },
        backHand: [8, 11],
        hand: [10, 10],
        pick: {
          butt: [8, 13],
          end: [13, 6],
          blade: [
            [11, 4],
            [13, 6],
          ],
          tip: [14, 7],
        },
      },
      {
        by: 1,
        lean: 1,
        back: { hip: BACK, x: 2 },
        front: { hip: FRONT, x: 10 },
        backHand: [8, 13],
        hand: [10, 14],
        pick: {
          butt: [7, 15],
          end: [13, 17],
          blade: [
            [13, 13],
            [13, 19],
          ],
          tip: [13, 20],
        },
        sparks: [
          [15, 19],
          [15, 21],
          [14, 22],
        ],
      },
      {
        by: 1,
        lean: 1,
        back: { hip: BACK, x: 2 },
        front: { hip: FRONT, x: 10 },
        backHand: [8, 13],
        hand: [10, 13],
        pick: {
          butt: [7, 14],
          end: [13, 14],
          blade: [
            [13, 11],
            [13, 17],
          ],
          tip: [13, 18],
        },
        sparks: [[15, 16]],
      },
      {
        by: 0,
        back: { hip: BACK, x: 3 },
        front: { hip: FRONT, x: 9 },
        backHand: [7, 12],
        hand: [10, 11],
        pick: {
          butt: [9, 14],
          end: [12, 7],
          blade: [
            [10, 5],
            [13, 8],
          ],
          tip: [14, 9],
        },
      },
    ],
  },
  {
    // Pala: clavar, empujar, hacer palanca, lanzar tierra y recuperar.
    name: 'dig',
    color: 'b86838ff',
    duration: 0.8,
    poses: [
      {
        by: 1,
        lean: 1,
        back: { hip: BACK, x: 2 },
        front: { hip: FRONT, x: 10 },
        backHand: [8, 11],
        hand: [10, 13],
        shovel: { butt: [8, 11], end: [13, 18], blade: [12, 19, 3, 3] },
      },
      {
        by: 1,
        lean: 1,
        back: { hip: BACK, x: 2 },
        front: { hip: FRONT, x: 10, lift: 1 },
        backHand: [8, 12],
        hand: [10, 14],
        shovel: { butt: [9, 12], end: [13, 19], blade: [12, 20, 3, 2] },
      },
      {
        by: 0,
        back: { hip: BACK, x: 3 },
        front: { hip: FRONT, x: 9 },
        backHand: [6, 13],
        hand: [10, 13],
        shovel: {
          butt: [7, 13],
          end: [12, 17],
          blade: [12, 17, 3, 3],
          soil: [
            [12, 16],
            [13, 16],
          ],
        },
      },
      {
        by: -1,
        lean: -1,
        back: { hip: BACK, x: 3 },
        front: { hip: FRONT, x: 9 },
        backHand: [5, 9],
        hand: [9, 8],
        shovel: {
          butt: [6, 12],
          end: [11, 6],
          blade: [11, 4, 3, 3],
          soil: [
            [12, 2],
            [14, 1],
            [15, 3],
          ],
        },
      },
      {
        by: 0,
        back: { hip: BACK, x: 3 },
        front: { hip: FRONT, x: 8 },
        backHand: [6, 12],
        hand: [10, 12],
        shovel: { butt: [8, 14], end: [12, 9], blade: [12, 7, 3, 3] },
      },
    ],
  },
  {
    // Festejo: agacharse, saltar con el pico en alto y aterrizar.
    name: 'celebrate',
    color: 'ffecb0ff',
    duration: 1.5,
    poses: [
      { ...stand(1, [6, 12]), hand: [10, 12] },
      {
        by: -1,
        back: { hip: BACK, x: 3 },
        front: { hip: FRONT, x: 8 },
        backHand: [3, 5],
        hand: [12, 5],
        pick: {
          butt: [13, 10],
          end: [13, 2],
          blade: [
            [11, 1],
            [14, 1],
          ],
          tip: [14, 2],
        },
      },
      {
        by: -2,
        back: { hip: BACK, x: 4, lift: 2 },
        front: { hip: FRONT, x: 9, lift: 2 },
        backHand: [2, 4],
        hand: [12, 4],
        pick: {
          butt: [13, 9],
          end: [13, 2],
          blade: [
            [11, 1],
            [14, 1],
          ],
          tip: [14, 2],
        },
      },
      { ...stand(0, [3, 8]), hand: [12, 13] },
    ],
  },
  {
    // Preparada: zancada larga, torso inclinado, brazos amplios.
    name: 'run',
    color: '388078ff',
    duration: 6 / 7,
    poses: [
      walk(0, { x: 11 }, { x: 1, lift: 1 }, 8, 0, -1, 1),
      walk(-1, { x: 9 }, { x: 4, lift: 3 }, 7, -1, -1, 1),
      walk(-1, { x: 6, lift: 2 }, { x: 8, lift: 3 }, 4, -1, 0, 1),
      walk(0, { x: 2, lift: 1 }, { x: 11 }, 2, 0, 0, 1),
      walk(-1, { x: 5, lift: 3 }, { x: 9 }, 4, -1, 0, 1),
      walk(-1, { x: 8, lift: 3 }, { x: 6, lift: 2 }, 7, -1, -1, 1),
    ],
  },
  {
    // Preparada: empujar un carro con ambas manos al frente.
    name: 'push',
    color: '8890a0ff',
    duration: 1.5,
    poses: [
      {
        by: 1,
        lean: 1,
        back: { hip: BACK, x: 2 },
        front: { hip: FRONT, x: 8 },
        backHand: [11, 12],
        hand: [12, 13],
      },
      {
        by: 1,
        lean: 1,
        back: { hip: BACK, x: 3 },
        front: { hip: FRONT, x: 9, lift: 1 },
        backHand: [11, 12],
        hand: [12, 13],
      },
      {
        by: 1,
        lean: 1,
        back: { hip: BACK, x: 4, lift: 1 },
        front: { hip: FRONT, x: 7 },
        backHand: [11, 12],
        hand: [12, 13],
      },
      {
        by: 0,
        lean: 1,
        back: { hip: BACK, x: 2 },
        front: { hip: FRONT, x: 8 },
        backHand: [11, 11],
        hand: [12, 12],
      },
    ],
  },
  {
    // Preparada: transportar una roca frente al pecho.
    name: 'carry',
    color: '586078ff',
    duration: 1.2,
    poses: [
      {
        by: 0,
        back: { hip: BACK, x: 2 },
        front: { hip: FRONT, x: 9 },
        backHand: [8, 12],
        hand: [11, 12],
        rock: [9, 10],
      },
      {
        by: 1,
        back: { hip: BACK, x: 5, lift: 2 },
        front: { hip: FRONT, x: 7 },
        backHand: [8, 13],
        hand: [11, 13],
        rock: [9, 11],
      },
      {
        by: 0,
        back: { hip: BACK, x: 9 },
        front: { hip: FRONT, x: 3 },
        backHand: [8, 12],
        hand: [11, 12],
        rock: [9, 10],
      },
      {
        by: 1,
        back: { hip: BACK, x: 7 },
        front: { hip: FRONT, x: 6, lift: 2 },
        backHand: [8, 13],
        hand: [11, 13],
        rock: [9, 11],
      },
    ],
  },
  {
    // Preparada: cansancio, encorvado con la mano en la rodilla.
    name: 'tired',
    color: '983c30ff',
    duration: 6,
    poses: [
      {
        by: 2,
        lean: 1,
        back: { hip: BACK, x: 3 },
        front: { hip: FRONT, x: 9 },
        backHand: [8, 16],
        hand: [12, 15],
        pick: carry(2, 0, 0),
      },
      {
        by: 1,
        lean: 1,
        back: { hip: BACK, x: 3 },
        front: { hip: FRONT, x: 9 },
        backHand: [8, 15],
        hand: [12, 14],
        pick: carry(1, 0, 0),
      },
    ],
  },
];

// Siete fases de carga: preparación, flexión, recoger, elevar, girar, vaciar, recuperar.
ANIMATIONS.push({
  name: 'load',
  color: 'c8a070ff',
  duration: 2.5,
  poses: [
    {
      ...stand(0),
      pick: undefined,
      shovel: { butt: [8, 12], end: [13, 17], blade: [12, 18, 3, 3] },
    },
    {
      ...stand(1),
      pick: undefined,
      lean: 1,
      hand: [11, 16],
      shovel: { butt: [8, 13], end: [13, 19], blade: [12, 20, 3, 2] },
    },
    {
      ...stand(1),
      pick: undefined,
      hand: [11, 16],
      shovel: {
        butt: [8, 13],
        end: [13, 18],
        blade: [12, 19, 3, 2],
        soil: [
          [12, 18],
          [13, 18],
          [14, 18],
        ],
      },
    },
    {
      ...stand(0),
      pick: undefined,
      hand: [11, 12],
      shovel: {
        butt: [8, 14],
        end: [13, 11],
        blade: [12, 10, 3, 2],
        soil: [
          [12, 9],
          [13, 9],
          [14, 9],
        ],
      },
    },
    {
      ...stand(0),
      pick: undefined,
      lean: 1,
      hand: [12, 11],
      shovel: {
        butt: [8, 13],
        end: [13, 9],
        blade: [12, 8, 3, 2],
        soil: [
          [12, 7],
          [13, 7],
          [14, 7],
        ],
      },
    },
    {
      ...stand(0),
      pick: undefined,
      lean: 1,
      hand: [12, 10],
      shovel: {
        butt: [8, 11],
        end: [13, 10],
        blade: [13, 10, 2, 3],
        soil: [
          [15, 13],
          [15, 15],
          [14, 17],
        ],
      },
    },
    {
      ...stand(0),
      pick: undefined,
      shovel: { butt: [8, 13], end: [13, 16], blade: [12, 17, 3, 3] },
    },
  ],
});

const frames = [];
const tags = [];
for (const animation of ANIMATIONS) {
  const from = frames.length + 1;
  for (const pose of animation.poses)
    frames.push({ cels: miner(pose), duration: animation.duration });
  tags.push({
    name: animation.name,
    color: animation.color,
    from,
    to: frames.length,
  });
}

mkdirSync(dirname(PXO), { recursive: true });
mkdirSync(dirname(PNG), { recursive: true });
writePxo(PXO, { width: W, height: H, fps: FPS, layers: LAYERS, frames, tags });
exportSpritesheet(PXO, PNG);
// Variantes equipadas con las mismas poses, anclas y cuerpo fisico.
for (const kind of ['unarmed', 'shovel']) {
  const variantFrames = [];
  for (const animation of ANIMATIONS)
    for (const pose of animation.poses) {
      const variant = { ...pose, pick: undefined };
      if (kind === 'shovel' && !variant.shovel) {
        const hy = Math.min(17, Math.max(8, pose.hand[1]));
        variant.shovel = {
          butt: [12, hy - 2],
          end: [12, hy + 2],
          blade: [11, hy + 3, 3, 2],
        };
      }
      variantFrames.push({
        cels: miner(variant),
        duration: animation.duration,
      });
    }
  const path = resolve(ROOT, `art/pixelorama/character_miner_${kind}.pxo`);
  writePxo(path, {
    width: W,
    height: H,
    fps: FPS,
    layers: LAYERS,
    frames: variantFrames,
    tags,
  });
  mkdirSync(resolve(ROOT, 'public/assets/interactions'), { recursive: true });
  exportSpritesheet(
    path,
    resolve(ROOT, `public/assets/interactions/miner-${kind}.png`),
  );
}
if (process.argv.includes('--preview')) {
  const preview = resolve(ROOT, 'test-results/character_miner_preview.png');
  mkdirSync(dirname(preview), { recursive: true });
  exportSpritesheet(PXO, preview, 8);
  console.log(preview);
}
console.log(
  `Minero: ${frames.length} cuadros → ${PXO} → ${PNG} (${tags.map((t) => `${t.name} ${t.from}-${t.to}`).join(', ')})`,
);
