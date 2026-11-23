// Protagonista: minero dibujado píxel a píxel por código con la paleta de 49
// colores (V13). Cada cuadro se arma con partes en orden de profundidad
// (brazo trasero, pierna trasera, torso, pierna delantera, cabeza,
// herramienta, brazo delantero) y un contorno de tinta de 1 px.
//
//   npm run art:hero            exporta las hojas
//   npm run art:hero -- --preview   además deja una vista ampliada en
//                                   .tools/hero-preview.png (ignorado)
//
// Salidas en public/assets/characters/player/ (9 × 6 cuadros de 32 × 32,
// mismo orden de animaciones que Miner.ts / MINER_ANIMATIONS):
//   hero.png            minero sin EPP con el pico de hierro (clave `miner`)
//   hero_unarmed.png    sin herramienta (`miner-unarmed`)
//   hero_shovel.png     pala (`miner-shovel`)
//   hero_tungsten.png   pico de tungsteno (`miner-tungsten`)
//   hero_axe.png        hacha (`miner-axe`)
//   hero_ppe.png        capas de EPP apiladas (orden de PPE_LAYERS)
//
// El juego viste al minero componiendo esas capas (entities/MinerCompose.ts);
// este script comprueba que la composición coincide con el dibujo completo.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE as C } from '../../src/game/config/palette.ts';
import {
  composeLook,
  HERO_COLUMNS,
  HERO_FRAME as F,
  HERO_FRAMES,
  HERO_SHEET,
  PPE_LAYERS,
} from '../../src/game/entities/MinerCompose.ts';
import { createImage, writePng } from './png.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(root, 'public', 'assets', 'characters', 'player');

// ---------------------------------------------------------------- colores
const SKIN = { light: C.peach, shade: C.desertSoil, deep: C.loam };
const HAIR = { main: C.earth, dark: C.umber, light: C.clay };
const SHIRT = { main: C.azure, shade: C.sky, light: C.blue };
const PANTS = { main: C.khaki, shade: C.taupe };
const SHOE = { main: C.earth, sole: C.umber };
const PICKS = {
  iron: { head: C.steel, tip: C.silver, socket: C.stone },
  tungsten: { head: C.stone, tip: C.steel, socket: C.slate },
};
const WOOD = { main: C.clay, dark: C.earth };

/** Códigos de los mapas de caracteres. */
const KEY = {
  H: HAIR.main,
  h: HAIR.dark,
  k: HAIR.light,
  S: SKIN.light,
  d: SKIN.shade,
  R: SKIN.deep,
  B: HAIR.dark, // cejas y bigote
  W: C.white,
  E: C.ink,
  N: SKIN.light, // nariz
  M: HAIR.dark,
  m: C.rust, // boca
  A: SHIRT.main,
  a: SHIRT.shade,
  L: SHIRT.light,
  U: C.umber, // cinturón
  G: C.gold, // hebilla
  K: PANTS.main,
  T: PANTS.shade,
  // EPP
  O: C.orange,
  e: C.ember,
  V: C.silver,
  w: C.white,
  Y: C.gold,
  y: C.amber,
  c: C.cream,
  l: C.steel,
  s: C.slate,
  i: C.mist,
};

/** Cabeza de perfil mirando a la derecha (8 × 8, la nariz sobresale). */
const HEAD = [
  '..HHHH...',
  '.HHkkHH..',
  'HHHHHHHH.',
  'HHHSSBBS.',
  'HHRSSWES.',
  'HhSSSSSSN',
  '.hdSSMMM.',
  '..ddSmS..',
];
/** Gestos: reemplazos [x, y, código] sobre HEAD. */
const FACES = {
  normal: [],
  blink: [
    [5, 4, 'B'],
    [6, 4, 'B'],
  ],
  effort: [
    [5, 3, 'S'],
    [5, 4, 'B'],
    [6, 3, 'B'],
    [7, 3, 'B'],
    [5, 7, 'E'],
  ],
  happy: [
    [5, 4, 'B'],
    [6, 4, 'B'],
    [5, 3, 'S'],
    [5, 7, 'E'],
    [4, 7, 'm'],
  ],
  tired: [
    [5, 4, 'B'],
    [5, 7, 'E'],
    [6, 7, 'E'],
  ],
};
/** Torso: camisa de trabajo, cinturón y pretina (7 × 8). */
const TORSO = [
  '.AALLA.',
  'aAAAAAA',
  'aAAAaaA',
  'aAAAAAA',
  'aAAAAAA',
  'aaaaaaa',
  'UUUUUGU',
  'TKKKKKK',
];
/** Chaleco reflectante sobre el torso (filas 0–5). */
const VEST = [
  '.OO..O.',
  'eOVOOOO',
  'eOVOOOO',
  'eVVVwVV',
  'eOOOOOO',
  'eOOOOOO',
];
/** Casco con lámpara frontal, relativo a la cabeza (filas −2..2). */
const HELMET = [
  '...YYY...',
  '..YcYYY..',
  '.YcYYYYlc',
  'YYYYYYYlc',
  'yyyyyyyyy',
];
/** Gafas de seguridad con correa, relativas a la cabeza (filas 3–4). */
const GOGGLES = ['....ssss.', 'sssssiws.'];

// ---------------------------------------------------------------- dibujo
/**
 * Lista de operaciones de un cuadro: cada píxel lleva su grupo (`body`,
 * `tool` o una pieza de EPP) y se pinta en el orden de la lista.
 */
function frameBuilder() {
  const ops = [];
  const put = (g, x, y, c, spark = false) => {
    x = Math.round(x);
    y = Math.round(y);
    // Margen de 1 px para el contorno; la suela apoya en la última fila
    // (el borde inferior del cuadro es el suelo bajo el cuerpo físico).
    const min = spark ? 0 : 1;
    if (x < min || y < min || x > F - 1 - min || y > F - 1)
      throw new Error(`Píxel fuera del cuadro (${g}): ${x},${y}`);
    ops.push({ g, x, y, c, spark });
  };
  const map = (g, rows, ox, oy, subs = []) => {
    const grid = rows.map((r) => r.split(''));
    for (const [x, y, k] of subs) grid[y][x] = k;
    grid.forEach((row, y) =>
      row.forEach((k, x) => {
        if (k !== '.') put(g, ox + x, oy + y, KEY[k]);
      }),
    );
  };
  /** Línea de Bresenham; devuelve los puntos. */
  const linePts = (a, b) => {
    let [x0, y0] = [Math.round(a.x), Math.round(a.y)];
    const [x1, y1] = [Math.round(b.x), Math.round(b.y)];
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const pts = [];
    for (;;) {
      pts.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) return pts;
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
  const square = (g, p, c, size = 2) => {
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) put(g, p.x + i, p.y + j, c);
  };
  return { ops, put, map, linePts, square };
}

/** Codo de un brazo de dos segmentos de 4 px (cinemática inversa simple). */
function elbowOf(s, h, bend) {
  const dx = h.x - s.x;
  const dy = h.y - s.y;
  const d = Math.hypot(dx, dy);
  const L = 4;
  const mid = { x: (s.x + h.x) / 2, y: (s.y + h.y) / 2 };
  if (!d || d >= 2 * L - 0.01) return mid;
  const off = Math.sqrt(L * L - (d / 2) ** 2);
  const px = -dy / d;
  const py = dx / d;
  // Por defecto el codo cae hacia abajo y, si empata, hacia delante.
  const sign = bend ?? (py + 0.1 * px >= -py - 0.1 * px ? 1 : -1);
  return { x: mid.x + sign * px * off, y: mid.y + sign * py * off };
}

/** Brazo: manga arremangada hasta el codo, antebrazo y mano de 2 × 2. */
function arm(f, shoulder, hand, tone, bend) {
  const elbow = elbowOf(shoulder, hand, bend);
  for (const p of f.linePts(shoulder, elbow)) f.square('body', p, tone.sleeve);
  const fore = f.linePts(elbow, hand);
  for (const p of fore) f.square('body', p, tone.skin);
  f.square('body', hand, tone.skin);
  return fore;
}
/** Guante de cuero con puño, sobre la mano y el final del antebrazo. */
function glove(f, hand, fore) {
  const cuff = fore.length > 1 ? fore[fore.length - 2] : null;
  if (cuff) f.square('gloves', cuff, C.earth);
  f.square('gloves', hand, C.clay);
  f.put('gloves', hand.x, hand.y, C.loam);
}

/** Pierna de 3 px que sigue cadera → rodilla → tobillo, fila por fila. */
function leg(f, hip, knee, ankle, tone) {
  const pts = knee ? [hip, knee, ankle] : [hip, ankle];
  const xAt = (y) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (y <= b.y || i === pts.length - 2) {
        if (b.y === a.y) return b.x;
        const t = Math.min(1, Math.max(0, (y - a.y) / (b.y - a.y)));
        return a.x + (b.x - a.x) * t;
      }
    }
    return ankle.x;
  };
  let prev = null;
  for (let y = hip.y; y <= ankle.y; y++) {
    const x = Math.round(xAt(y));
    const lo = prev === null ? x : Math.min(prev, x);
    const hi = prev === null ? x : Math.max(prev, x);
    for (let xx = lo; xx <= hi + 2; xx++)
      f.put('body', xx, y, xx === hi + 2 ? tone.shade : tone.main);
    prev = x;
  }
  // Zapato de trabajo (sin puntera de seguridad).
  for (let i = 0; i < 3; i++) f.put('body', ankle.x + i, ankle.y + 1, SHOE.main);
  for (let i = 0; i < 4; i++) f.put('body', ankle.x + i, ankle.y + 2, SHOE.sole);
}
/** Bota de seguridad: caña, cordones, puntera de acero y suela gruesa. */
function boot(f, ankle) {
  const { x, y } = ankle;
  const rows = ['cOO', 'cOY', 'cOOV', 'UUUU'];
  const colors = { c: C.clay, O: C.ochre, Y: C.gold, V: C.silver, U: C.umber };
  rows.forEach((row, j) =>
    row.split('').forEach((k, i) => f.put('boots', x + i, y - 1 + j, colors[k])),
  );
}

/** Herramienta en la mano delantera. `angle` en grados (0 = adelante). */
function tool(f, kind, grip, spec) {
  const th = (spec.angle * Math.PI) / 180;
  const dir = { x: Math.cos(th), y: Math.sin(th) };
  const perp = { x: -dir.y, y: dir.x };
  const g = { x: grip.x + 0.5, y: grip.y + 0.5 };
  const at = (t, k = 0) => ({
    x: g.x + dir.x * t + perp.x * k,
    y: g.y + dir.y * t + perp.y * k,
  });
  const handle = (from, to) => {
    for (const p of f.linePts(at(from), at(to))) f.put('tool', p.x, p.y, WOOD.main);
  };
  // `reach` es el largo del pico; la pala y el hacha se acortan para que la
  // hoja quede a la misma distancia de la mano.
  if (kind === 'shovel') {
    const reach = (spec.reach ?? 8) - 4;
    handle(-1.5, reach);
    // Empuñadura en T del extremo.
    f.put('tool', at(-1.5, -1).x, at(-1.5, -1).y, WOOD.dark);
    f.put('tool', at(-1.5, 1).x, at(-1.5, 1).y, WOOD.dark);
    for (let t = reach + 0.5; t <= reach + 4.5; t += 0.5)
      for (const k of [-1, 0, 1])
        f.put('tool', at(t, k).x, at(t, k).y, t > reach + 4 ? C.steel : C.silver);
    if (spec.soil) {
      // Tierra sobre la hoja, del lado de arriba.
      const up = perp.y <= 0 ? 1 : -1;
      for (const [t, k, c] of [
        [reach + 1.5, 2, C.soil],
        [reach + 2.5, 2, C.earth],
        [reach + 3.5, 2, C.soil],
        [reach + 2.5, 3, C.earth],
      ])
        f.put('tool', at(t, k * up).x, at(t, k * up).y, c);
    }
  } else if (kind === 'axe') {
    const reach = (spec.reach ?? 8) - 1;
    handle(-2, reach);
    for (let t = reach - 2; t <= reach; t += 0.5) {
      for (const k of [1, 2]) f.put('tool', at(t, k).x, at(t, k).y, C.steel);
      f.put('tool', at(t, 3).x, at(t, 3).y, C.silver);
      f.put('tool', at(t, -1).x, at(t, -1).y, C.stone);
    }
  } else {
    const m = PICKS[kind];
    const reach = spec.reach ?? 8;
    handle(-2, reach);
    // Cabeza en media luna: gruesa junto al mango y afinada hacia las puntas.
    const end = reach + 0.5;
    const pts = new Map();
    const mark = (t, k, c) => {
      const p = at(t, k);
      pts.set(`${Math.round(p.x)},${Math.round(p.y)}`, c);
    };
    for (const k of [-3, -2, -1, 0, 1, 2, 3]) {
      const a = Math.abs(k);
      mark(end - (a === 3 ? 1.2 : a === 2 ? 0.4 : 0), k, a === 3 ? m.tip : a === 0 ? m.socket : m.head);
    }
    for (const k of [-1, 0, 1]) mark(end - 1, k, k ? m.head : m.socket);
    for (const [key, c] of pts) {
      const [x, y] = key.split(',').map(Number);
      f.put('tool', x, y, c);
    }
  }
  for (const [x, y, c] of spec.sparks ?? []) f.put('tool', x, y, c, true);
}

/** Cuadro completo de una pose con una herramienta (o ninguna). */
function drawFrame(pose, kind) {
  const f = frameBuilder();
  const by = pose.by ?? 0;
  const lean = pose.lean ?? 0;
  const hipY = 25 + (pose.hipBy ?? by);
  const back = { sleeve: SHIRT.shade, skin: SKIN.shade };
  const front = { sleeve: SHIRT.light, skin: SKIN.light };
  const shoulderBack = { x: 15 + lean, y: 18 + by };
  const shoulderFront = { x: 17 + lean, y: 18 + by };
  const pt = ([x, y]) => ({ x, y });
  const hasTool = kind && pose.tool;
  const toolSpec = hasTool ? pose.tool : null;
  const grip = pt(pose.front);
  // La mano trasera sujeta el mango más atrás si la pose usa las dos manos.
  let backHand = pt(pose.back);
  if (pose.twoHands) {
    const th = (pose.tool.angle * Math.PI) / 180;
    const along = pose.twoHands;
    backHand = {
      x: Math.round(grip.x - Math.cos(th) * along),
      y: Math.round(grip.y - Math.sin(th) * along),
    };
  }
  // 0. Herramienta por detrás del cuerpo (mango sobre el hombro).
  if (toolSpec?.behind) tool(f, kind, grip, toolSpec);
  // 1. Brazo trasero.
  const backFore = arm(f, shoulderBack, backHand, back, pose.backBend);
  glove(f, backHand, backFore);
  // 2. Pierna trasera.
  const lb = pose.legs.back;
  leg(f, { x: lb.hip, y: hipY }, lb.knee && pt(lb.knee), pt(lb.ankle), {
    main: PANTS.shade,
    shade: C.desertRock,
  });
  boot(f, pt(lb.ankle));
  // 3. Torso y chaleco.
  f.map('body', TORSO, 13 + lean, 17 + by);
  f.map('vest', VEST, 13 + lean, 17 + by);
  // 4. Pierna delantera.
  const lf = pose.legs.front;
  leg(f, { x: lf.hip, y: hipY }, lf.knee && pt(lf.knee), pt(lf.ankle), PANTS);
  boot(f, pt(lf.ankle));
  // 5. Cuello, cabeza, gafas y casco.
  const hx = 12 + lean + (pose.head?.dx ?? 0);
  const hy = 8 + by + (pose.head?.dy ?? 0);
  f.put('body', hx + 3, hy + 8, SKIN.shade);
  f.put('body', hx + 4, hy + 8, SKIN.shade);
  f.map('body', HEAD, hx, hy, FACES[pose.face ?? 'normal']);
  f.map('goggles', GOGGLES, hx, hy + 3);
  f.map('helmet', HELMET, hx, hy - 2);
  // 6. Roca en brazos (cargar).
  if (pose.rock) {
    const [rx, ry] = pose.rock;
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 5; i++)
        f.put('body', rx + i, ry + j, j === 0 ? C.steel : j === 3 ? C.slate : C.stone);
  }
  // 7. Herramienta delante del cuerpo.
  if (toolSpec && !toolSpec.behind) tool(f, kind, grip, toolSpec);
  // 8. La mano trasera vuelve a cubrir el mango.
  if (pose.twoHands) {
    f.square('body', backHand, SKIN.shade);
    glove(f, backHand, []);
  }
  // 9. Brazo delantero.
  const frontFore = arm(f, shoulderFront, grip, front, pose.frontBend);
  glove(f, grip, frontFore);
  // 10. Gota de sudor y partículas del cuerpo.
  for (const [x, y, c] of pose.fx ?? []) f.put('body', x, y, c, true);
  return f.ops;
}

/** Píxeles RGBA de un cuadro con las piezas de EPP indicadas. */
function render(ops, gear) {
  const px = new Array(F * F).fill(null);
  for (const o of ops)
    if (o.g === 'body' || o.g === 'tool' || gear.has(o.g)) px[o.y * F + o.x] = o;
  const out = new Uint8Array(F * F * 4);
  const set = (i, c) => {
    out[i * 4] = (c >> 16) & 255;
    out[i * 4 + 1] = (c >> 8) & 255;
    out[i * 4 + 2] = c & 255;
    out[i * 4 + 3] = 255;
  };
  px.forEach((o, i) => o && set(i, o.c));
  // Contorno de tinta: píxeles vacíos junto a un relleno que no es tinta.
  for (let y = 0; y < F; y++)
    for (let x = 0; x < F; x++) {
      const i = y * F + x;
      if (px[i]) continue;
      const solid = (nx, ny) => {
        if (nx < 0 || ny < 0 || nx >= F || ny >= F) return false;
        const o = px[ny * F + nx];
        return o && !o.spark && o.c !== C.ink;
      };
      if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))
        set(i, C.ink);
    }
  return out;
}

// ---------------------------------------------------------------- poses
const STANCE = {
  back: { hip: 14, ankle: [13, 29] },
  front: { hip: 16, ankle: [17, 29] },
};
const WIDE = {
  back: { hip: 14, ankle: [12, 29] },
  front: { hip: 16, ankle: [18, 29] },
};
const legs = (bA, fA, bK, fK) => ({
  back: { hip: 14, ankle: bA, knee: bK },
  front: { hip: 16, ankle: fA, knee: fK },
});
const CARRY = (angle = 22) => ({ tool: { angle } });
const SPARK = [
  [31, 18, C.cream],
  [30, 16, C.white],
  [31, 22, C.cream],
  [29, 24, C.gold],
];
const SOIL_TOSS = [
  [27, 6, C.soil],
  [29, 9, C.earth],
  [26, 3, C.earth],
  [30, 5, C.soil],
];

const idle = (by, face = 'normal') => ({
  by,
  hipBy: 0,
  face,
  legs: STANCE,
  back: [14, 24 + by],
  front: [18, 23 + by],
  ...CARRY(20),
});
const walk = (bA, fA, bK, fK, by, back, front, angle) => ({
  by,
  legs: legs(bA, fA, bK, fK),
  back,
  front,
  tool: { angle },
});
const run = (bA, fA, bK, fK, by, back, front, angle) => ({
  by,
  lean: 1,
  head: { dx: 0 },
  legs: legs(bA, fA, bK, fK),
  back,
  front,
  tool: { angle },
});
const swing = (lean, by, front, angle, face, extra = {}) => ({
  lean,
  by,
  face,
  legs: WIDE,
  front,
  back: front,
  twoHands: 2.5,
  tool: { angle, ...extra },
});
const shovel = (lean, by, front, angle, extra = {}, face = 'effort') => ({
  lean,
  by,
  face,
  legs:
    by >= 2
      ? legs([12, 29], [18, 29], [14, 27], [20, 28])
      : by === 1
        ? legs([12, 29], [18, 29], null, [19, 27])
        : WIDE,
  front,
  back: front,
  twoHands: 3.5,
  tool: { angle, ...extra },
});
const push = (bA, fA, bK, fK, by) => ({
  by,
  lean: 1,
  face: 'effort',
  legs: legs(bA, fA, bK, fK),
  back: [22, 21 + by],
  front: [23, 21 + by],
});
const carry = (bA, fA, bK, fK, by) => ({
  by,
  legs: legs(bA, fA, bK, fK),
  back: [20, 21 + by],
  front: [22, 21 + by],
  rock: [19, 17 + by],
});

/** 54 cuadros en el orden de MINER_ANIMATIONS (kind: herramienta forzada). */
const POSES = [
  // 0–3 reposo: respiración (el torso baja 1 px) y parpadeo.
  idle(0),
  idle(0),
  idle(1),
  idle(1, 'blink'),
  // 4–11 caminar (la animación usa 6; 10–11 repiten 4–5).
  walk([12, 29], [19, 29], null, null, 0, [18, 23], [15, 23], 40),
  walk([13, 28], [18, 29], [15, 27], null, 1, [17, 24], [16, 24], 32),
  walk([15, 27], [16, 29], [17, 26], null, 0, [16, 24], [17, 24], 25),
  walk([19, 29], [12, 29], null, null, 0, [12, 23], [20, 23], 12),
  walk([18, 29], [13, 28], null, [15, 27], 1, [13, 24], [19, 24], 18),
  walk([16, 29], [15, 27], null, [17, 26], 0, [15, 24], [18, 24], 25),
  walk([12, 29], [19, 29], null, null, 0, [18, 23], [15, 23], 40),
  walk([13, 28], [18, 29], [15, 27], null, 1, [17, 24], [16, 24], 32),
  // 12 subida, 13 cima, 14 caída, 15 aterrizaje.
  {
    legs: legs([12, 29], [17, 27], null, [19, 26]),
    back: [12, 21],
    front: [21, 14],
    tool: { angle: -35 },
  },
  {
    legs: legs([14, 27], [17, 27], [16, 26], [19, 26]),
    back: [11, 18],
    front: [21, 17],
    tool: { angle: -20, reach: 6 },
  },
  {
    legs: legs([12, 29], [18, 29]),
    back: [11, 14],
    front: [21, 13],
    face: 'effort',
    tool: { angle: -55 },
  },
  {
    by: 2,
    face: 'effort',
    legs: legs([13, 29], [17, 29], [16, 27], [19, 27]),
    back: [14, 25],
    front: [20, 24],
    tool: { angle: 30 },
  },
  // 16–21 picar: el pico sube por detrás de la cabeza y golpea adelante.
  swing(-1, 0, [18, 16], -115, 'effort', { behind: true }),
  swing(0, 0, [20, 17], -75, 'effort', { behind: true }),
  swing(1, 0, [21, 16], -25, 'effort'),
  swing(1, 1, [21, 19], 10, 'effort', { sparks: SPARK }),
  swing(1, 1, [20, 21], 35, 'effort'),
  swing(0, 0, [19, 17], -40, 'normal'),
  // 22–26 palear: clavar, empujar, levantar la tierra y lanzarla.
  { ...shovel(0, 0, [19, 19], 60), kind: 'shovel' },
  { ...shovel(1, 1, [21, 20], 48), kind: 'shovel' },
  { ...shovel(1, 1, [21, 21], 30), kind: 'shovel' },
  { ...shovel(0, 0, [20, 19], 0, { soil: true }), kind: 'shovel' },
  { ...shovel(0, 0, [19, 16], -40, { sparks: SOIL_TOSS }, 'normal'), kind: 'shovel' },
  // 27–30 festejo: brazos arriba y un pequeño salto.
  {
    face: 'happy',
    legs: STANCE,
    back: [12, 16],
    front: [21, 15],
    tool: { angle: -45 },
  },
  {
    by: -1,
    face: 'happy',
    legs: legs([13, 28], [17, 28]),
    back: [11, 11],
    front: [23, 14],
    tool: { angle: -70, reach: 7 },
  },
  {
    face: 'happy',
    legs: STANCE,
    back: [11, 12],
    front: [23, 15],
    tool: { angle: -65, reach: 7 },
  },
  {
    face: 'happy',
    legs: STANCE,
    back: [13, 22],
    front: [20, 20],
    tool: { angle: 0 },
  },
  // 31–36 correr: zancada larga e inclinado hacia delante.
  run([11, 29], [20, 28], null, [21, 26], 0, [21, 21], [14, 22], 45),
  run([12, 27], [18, 29], [15, 26], null, 1, [19, 22], [15, 23], 35),
  run([16, 26], [14, 29], [19, 25], null, 0, [16, 23], [18, 23], 25),
  run([20, 28], [11, 29], [21, 26], null, 0, [13, 22], [21, 21], 28),
  run([18, 29], [12, 27], null, [15, 26], 1, [14, 23], [20, 22], 30),
  run([14, 29], [16, 26], null, [19, 25], 0, [16, 23], [18, 23], 25),
  // 37–40 empujar el carro: manos al frente, sin herramienta.
  push([12, 29], [17, 29], null, null, 0),
  push([13, 28], [16, 29], [15, 27], null, 1),
  push([16, 29], [13, 29], null, null, 0),
  push([15, 29], [14, 28], null, [16, 27], 1),
  // 41–44 cargar una roca en brazos.
  carry([12, 29], [19, 29], null, null, 0),
  carry([15, 27], [16, 29], [17, 26], null, 1),
  carry([19, 29], [12, 29], null, null, 0),
  carry([16, 29], [15, 27], null, [17, 26], 1),
  // 45–46 cansado: manos en las rodillas, respira agitado y suda.
  {
    by: 1,
    lean: 1,
    head: { dx: 0, dy: 1 },
    face: 'tired',
    legs: legs([13, 29], [17, 29], [15, 27], [19, 27]),
    back: [17, 25],
    front: [20, 25],
    tool: { angle: 5, reach: 6 },
  },
  {
    by: 2,
    lean: 1,
    head: { dx: 0, dy: 1 },
    face: 'tired',
    legs: legs([13, 29], [17, 29], [15, 27], [19, 27]),
    back: [17, 26],
    front: [20, 26],
    tool: { angle: 5, reach: 6 },
    fx: [
      [22, 12, C.mist],
      [22, 13, C.mist],
    ],
  },
  // 47–53 palear para cargar: siete fases que sigue WorkSystem.
  { ...shovel(1, 1, [20, 21], 45, {}, 'normal'), kind: 'shovel' },
  { ...shovel(1, 2, [21, 23], 25), kind: 'shovel' },
  { ...shovel(1, 2, [21, 23], 12, { soil: true }), kind: 'shovel' },
  { ...shovel(0, 1, [20, 20], 0, { soil: true }), kind: 'shovel' },
  { ...shovel(0, 0, [19, 17], -25, { soil: true }), kind: 'shovel' },
  { ...shovel(0, 0, [19, 15], -50, { sparks: SOIL_TOSS }, 'normal'), kind: 'shovel' },
  { ...shovel(0, 0, [19, 19], 40, {}, 'normal'), kind: 'shovel' },
];
if (POSES.length !== HERO_FRAMES)
  throw new Error(`Se esperaban ${HERO_FRAMES} poses, hay ${POSES.length}`);

/** Hojas por herramienta: archivo y tipo de herramienta del juego. */
const SKINS = [
  ['hero_unarmed.png', null],
  ['hero.png', 'iron'],
  ['hero_shovel.png', 'shovel'],
  ['hero_tungsten.png', 'tungsten'],
  ['hero_axe.png', 'axe'],
];
/** Herramienta que se dibuja en un cuadro: la pala de los cuadros de pala. */
const toolOf = (pose, skin) => (skin ? (pose.kind ?? skin) : null);

function sheetOf(skin, gear) {
  const sheet = createImage(HERO_SHEET.width, HERO_SHEET.height);
  POSES.forEach((pose, n) => {
    const kind = toolOf(pose, skin);
    let ops;
    try {
      ops = drawFrame(pose, kind);
    } catch (error) {
      throw new Error(`Cuadro ${n} (${kind ?? 'sin herramienta'}): ${error.message}`, {
        cause: error,
      });
    }
    const px = render(ops, gear);
    const ox = (n % HERO_COLUMNS) * F;
    const oy = Math.floor(n / HERO_COLUMNS) * F;
    for (let y = 0; y < F; y++)
      sheet.data.set(px.subarray(y * F * 4, (y + 1) * F * 4), ((oy + y) * sheet.width + ox) * 4);
  });
  return sheet;
}

/** Píxeles que una pieza cambia sobre el minero sin herramienta. */
function layerOf(piece, bare) {
  const dressed = sheetOf(null, new Set([piece]));
  const layer = createImage(bare.width, bare.height);
  for (let i = 0; i < bare.data.length; i += 4) {
    const same =
      dressed.data[i] === bare.data[i] &&
      dressed.data[i + 1] === bare.data[i + 1] &&
      dressed.data[i + 2] === bare.data[i + 2] &&
      dressed.data[i + 3] === bare.data[i + 3];
    if (same) continue;
    if (!dressed.data[i + 3]) throw new Error(`${piece} deja un hueco en ${i / 4}`);
    layer.data.set(dressed.data.subarray(i, i + 4), i);
  }
  return layer;
}

const NONE = new Set();
const sheets = new Map(SKINS.map(([file, skin]) => [file, sheetOf(skin, NONE)]));
const bare = sheets.get('hero_unarmed.png');
const layers = Object.fromEntries(PPE_LAYERS.map((p) => [p, layerOf(p, bare)]));

// Comprobación: composición en el juego frente al dibujo completo.
const masks = [...Array(1 << PPE_LAYERS.length).keys()];
let worst = 0;
let worstAt = '';
for (const [file, skin] of SKINS)
  for (const mask of masks) {
    const pieces = PPE_LAYERS.filter((_, i) => mask & (1 << i));
    const truth = sheetOf(skin, new Set(pieces));
    const composed = composeLook(
      sheets.get(file).data,
      bare.data,
      pieces.map((p) => layers[p].data),
    );
    let diff = 0;
    for (let i = 0; i < truth.data.length; i += 4)
      if (
        truth.data[i] !== composed[i] ||
        truth.data[i + 1] !== composed[i + 1] ||
        truth.data[i + 2] !== composed[i + 2] ||
        truth.data[i + 3] !== composed[i + 3]
      )
        diff++;
    if (diff > worst) {
      worst = diff;
      worstAt = `${file} con ${pieces.join('+') || 'nada'}`;
    }
  }
console.log(
  `Composición: como máximo ${worst} píxeles distintos del dibujo completo` +
    (worst ? ` (${worstAt}, en ${HERO_FRAMES} cuadros)` : ''),
);

mkdirSync(OUT, { recursive: true });
for (const [file, sheet] of sheets) writePng(join(OUT, file), sheet);
const ppe = createImage(HERO_SHEET.width, HERO_SHEET.height * PPE_LAYERS.length);
PPE_LAYERS.forEach((p, i) => ppe.data.set(layers[p].data, i * layers[p].data.length));
writePng(join(OUT, 'hero_ppe.png'), ppe);
console.log(`Hojas: ${[...sheets.keys(), 'hero_ppe.png'].join(', ')}`);

// Vista previa ×4: sin EPP, con todo el EPP, y cada herramienta con EPP.
if (process.argv.includes('--preview')) {
  const rows = [
    sheetOf('iron', NONE),
    sheetOf('iron', new Set(PPE_LAYERS)),
    sheetOf(null, NONE),
    sheetOf('shovel', new Set(['helmet', 'vest', 'boots'])),
    sheetOf('axe', NONE),
    sheetOf('tungsten', new Set(PPE_LAYERS)),
  ];
  const S = 4;
  const per = HERO_FRAMES;
  const prev = createImage(per * F * S / 3, rows.length * F * S * 3);
  // 18 cuadros por fila, 3 filas por hoja.
  rows.forEach((sheet, r) => {
    for (let n = 0; n < per; n++) {
      const sx = (n % HERO_COLUMNS) * F;
      const sy = Math.floor(n / HERO_COLUMNS) * F;
      const dx = (n % 18) * F * S;
      const dy = (r * 3 + Math.floor(n / 18)) * F * S;
      for (let y = 0; y < F * S; y++)
        for (let x = 0; x < F * S; x++) {
          const s = ((sy + Math.floor(y / S)) * sheet.width + sx + Math.floor(x / S)) * 4;
          const d = ((dy + y) * prev.width + dx + x) * 4;
          if (sheet.data[s + 3]) prev.data.set(sheet.data.subarray(s, s + 4), d);
          else {
            const checker = ((x >> 4) + (y >> 4)) & 1 ? 0x9a : 0xb0;
            prev.data.set([checker, checker + 10, checker + 30, 255], d);
          }
        }
    }
  });
  mkdirSync(join(root, '.tools'), { recursive: true });
  writePng(join(root, '.tools', 'hero-preview.png'), prev);
  console.log('Vista previa: .tools/hero-preview.png');
}
