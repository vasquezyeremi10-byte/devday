// Gnomo minero animado a partir del PNG de 32 × 32 aportado (art/gnome/original.png).
//
// 1. Maestro. Tamaño 32: el original trae ~400 tonos casi iguales y bordes con
//    alfa 253; se agrupan en 20 colores (k-medias determinista), el alfa pasa
//    a 0/255 y los ojos quedan rojos vivos (art/gnome/master.png).
//    Tamaño 24 (el del juego): art/gnome/small.png, el mismo gnomo reducido al
//    75 % y retocado a mano (ojos, nariz, barba y picota legibles).
// 2. Animación por piezas: gorro (punta y medio), cuerpo, cara, barba, brazo,
//    pies y picota se recortan del maestro y se desplazan por píxeles enteros.
//    Nada se reescala: cada cuadro usa los píxeles del maestro.
// 3. La picota (y el cuerpo al caer) se rotan con un RotSprite simplificado:
//    ampliación EPX ×8 y muestreo del vecino más cercano, sin mezclar colores.
//
// Salidas: public/assets/characters/gnome/gnome.png (hoja 8 × 11 de 64 × 48)
// y src/game/config/gnomeFrames.ts (cajas de impacto). GNOME_SIZE y GNOME_OUT
// (variables de entorno) permiten probar otro tamaño en otra carpeta.
import { writeFileSync } from 'node:fs';
import { createImage, readPng, writePng } from './png.mjs';
import {
  GNOME_ANIMATIONS,
  GNOME_IMPACT_FRAME,
  GNOME_SHEET,
} from '../../src/game/config/gnomeAnimations.ts';

const FW = GNOME_SHEET.frameWidth;
const FH = GNOME_SHEET.frameHeight;
const BASELINE = GNOME_SHEET.baseline;
const SIZE = Number(process.env.GNOME_SIZE ?? GNOME_SHEET.size);
const OUT = process.env.GNOME_OUT;

/**
 * Esqueleto de cada tamaño, en coordenadas del maestro: piezas, ojos,
 * lámpara, mano (pivote de la picota), hombro, talón (pivote de la caída) y
 * posición del maestro en el cuadro (pies en la fila 44, centro en x = 32).
 */
const RIGS = {
  32: {
    origin: [21, 14],
    eyes: [
      [13, 17],
      [18, 17],
    ],
    rageEyes: [
      [12, 17],
      [17, 17],
    ],
    lamp: { x0: 13, y0: 8, x1: 18, y1: 12 },
    grip: { x: 22.5, y: 24.5 },
    shoulder: { x: 19.5, y: 22.5 },
    heel: { x: 4, y: 31 },
    markX: 15,
    partOf(x, y, grey) {
      if (
        (x >= 21 && y >= 14 && y <= 27) ||
        (x >= 19 && x <= 22 && y >= 26 && y <= 27)
      )
        return 'weapon';
      if (y >= 28 && x <= 9) return 'footBack';
      if (y >= 28 && x >= 13) return 'footFront';
      if (x <= 5 && y >= 21 && y <= 26) return 'arm';
      if (y <= 4) return 'hatTip';
      if (y <= 7) return 'hatMid';
      if (x >= 9 && x <= 19 && y >= 15 && y <= 20) return 'face';
      if (x >= 8 && x <= 19 && y >= 21 && y <= 25 && grey) return 'beard';
      return 'body';
    },
    isPickHead: (x, y) =>
      (y <= 18 && x >= 22) || (y >= 19 && y <= 22 && x >= 26),
  },
  24: {
    origin: [23, 21],
    eyes: [
      [7, 14],
      [12, 14],
    ],
    rageEyes: [
      [6, 14],
      [13, 14],
    ],
    lamp: { x0: 11, y0: 6, x1: 15, y1: 10 },
    grip: { x: 16, y: 18 },
    shoulder: { x: 14.5, y: 16.5 },
    heel: { x: 3, y: 24 },
    markX: 12,
    partOf(x, y, grey) {
      if (
        (x >= 17 && y >= 9 && y <= 20) ||
        (x === 16 && y >= 12 && y <= 20 && y !== 13) ||
        (x === 15 && y >= 15 && y <= 20) ||
        (x === 14 && y === 20)
      )
        return 'weapon';
      if ((y >= 21 && x <= 6) || (y >= 22 && x <= 8)) return 'footBack';
      if (y >= 21 && x >= 10) return 'footFront';
      if (x <= 3 && y >= 17 && y <= 20) return 'arm';
      if (y <= 3) return 'hatTip';
      if (y <= 5) return 'hatMid';
      if (x >= 5 && x <= 14 && y >= 13 && y <= 15) return 'face';
      if (x >= 5 && x <= 14 && y >= 16 && y <= 20 && grey) return 'beard';
      return 'body';
    },
    isPickHead: (x, y) =>
      y <= 11 || (y === 12 && (x <= 17 || x >= 21)) || (x >= 21 && y <= 15),
  },
};
const RIG = RIGS[SIZE];
if (!RIG) throw new Error(`Tamaño de gnomo sin esqueleto: ${SIZE}`);
const [OX, OY] = RIG.origin;
if (!OUT && (OX !== GNOME_SHEET.originX || OY !== GNOME_SHEET.originY))
  throw new Error('GNOME_SHEET.originX/Y no coincide con el esqueleto');

// ─── 1. Maestro ──────────────────────────────────────────────────────────────
const source = readPng('art/gnome/original.png');
if (source.width !== 32 || source.height !== 32)
  throw new Error('Se requiere el original de 32 × 32');

/** k-medias con siembra por el punto más lejano: siempre el mismo resultado. */
function kmeans(points, k) {
  let centers = [[0, 0, 0]];
  while (centers.length < k) {
    let best = null;
    let bestDist = -1;
    for (const p of points) {
      let near = Infinity;
      for (const c of centers)
        near = Math.min(
          near,
          (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2,
        );
      if (near > bestDist) {
        bestDist = near;
        best = p;
      }
    }
    centers.push(best.slice(0, 3));
  }
  const assign = new Array(points.length).fill(0);
  for (let it = 0; it < 30; it++) {
    points.forEach((p, j) => {
      let bestDist = Infinity;
      centers.forEach((c, i) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestDist) {
          bestDist = d;
          assign[j] = i;
        }
      });
    });
    const sums = centers.map(() => [0, 0, 0, 0]);
    points.forEach((p, j) => {
      const s = sums[assign[j]];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    });
    centers = sums.map((s, i) =>
      s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[i],
    );
  }
  return { centers: centers.map((c) => c.map(Math.round)), assign };
}

const opaque = [];
for (let i = 0; i < 32 * 32; i++)
  if (source.data[i * 4 + 3] >= 128)
    opaque.push([
      source.data[i * 4],
      source.data[i * 4 + 1],
      source.data[i * 4 + 2],
      i,
    ]);
const clean = kmeans(opaque, 20);
const master32 = new Int16Array(32 * 32).fill(-1);
opaque.forEach((p, j) => (master32[p[3]] = clean.assign[j]));
// Ojos del original limpio: un píxel rojo vivo a cada lado de la nariz.
const eye32 = clean.centers.reduce(
  (best, c, i) =>
    (c[0] - 232) ** 2 + (c[1] - 24) ** 2 + (c[2] - 23) ** 2 <
    (clean.centers[best][0] - 232) ** 2 +
      (clean.centers[best][1] - 24) ** 2 +
      (clean.centers[best][2] - 23) ** 2
      ? i
      : best,
  0,
);
for (const [x, y] of RIGS[32].eyes) master32[y * 32 + x] = eye32;
const masterImage = createImage(32, 32);
master32.forEach((c, i) => {
  if (c >= 0) masterImage.data.set([...clean.centers[c], 255], i * 4);
});
writePng('art/gnome/master.png', masterImage);

/** Maestro del tamaño elegido: índices de paleta (−1 transparente). */
let PAL = clean.centers;
let master = master32;
if (SIZE === 24) {
  const small = readPng('art/gnome/small.png');
  if (small.width !== 24 || small.height !== 24)
    throw new Error('art/gnome/small.png debe medir 24 × 24');
  const index = new Map();
  PAL = [];
  master = new Int16Array(24 * 24).fill(-1);
  for (let i = 0; i < 24 * 24; i++) {
    if (small.data[i * 4 + 3] < 128) continue;
    const rgb = [
      small.data[i * 4],
      small.data[i * 4 + 1],
      small.data[i * 4 + 2],
    ];
    const key = rgb.join(',');
    if (!index.has(key)) {
      index.set(key, PAL.length);
      PAL.push(rgb);
    }
    master[i] = index.get(key);
  }
}
const N = SIZE;

const nearest = (rgb) => {
  let best = 0;
  let bestDist = Infinity;
  PAL.forEach((c, i) => {
    const d =
      (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
};
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const INK = PAL.reduce((a, c, i) => (lum(c) < lum(PAL[a]) ? i : a), 0);
const EYE = nearest([232, 24, 23]);
const LAMP_WHITE = nearest([243, 237, 216]);
const LAMP_YELLOW = nearest([248, 202, 49]);
const LAMP_AMBER = nearest([185, 122, 32]);
const SLEEVE = nearest([92, 77, 94]);

const EYES = RIG.eyes;
// Con rabia los ojos se agrandan.
const RAGE_EYES = RIG.rageEyes;

// ─── 2. Piezas ───────────────────────────────────────────────────────────────
const isGrey = (c) => {
  const [r, g, b] = PAL[c];
  return lum(PAL[c]) > 140 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
};
/** Pieza a la que pertenece cada píxel del maestro. */
const partOf = (x, y, c) => RIG.partOf(x, y, isGrey(c));
/** Cabeza metálica de la picota (para la caja de impacto). */
const isPickHead = RIG.isPickHead;

const blank = () => new Int16Array(FW * FH).fill(-1);
const at = (img, x, y) =>
  x < 0 || y < 0 || x >= FW || y >= FH ? -1 : img[y * FW + x];

/** Recorta las piezas de un maestro (ya recoloreado) en coordenadas de cuadro. */
function cutParts(src) {
  const parts = {};
  for (const name of [
    'weapon',
    'footBack',
    'footFront',
    'arm',
    'hatTip',
    'hatMid',
    'face',
    'beard',
    'body',
  ])
    parts[name] = blank();
  parts.pickHead = blank();
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const c = src[y * N + x];
      if (c < 0) continue;
      const part = partOf(x, y, c);
      parts[part][(y + OY) * FW + x + OX] = c;
      if (part === 'weapon' && isPickHead(x, y))
        parts.pickHead[(y + OY) * FW + x + OX] = c;
    }
  return parts;
}

/** Variante del maestro con ojos y lámpara según la pose. */
function recolor(eyes, lamp) {
  const out = master.slice();
  if (eyes === 'closed') for (const [x, y] of EYES) out[y * N + x] = INK;
  if (eyes === 'rage') for (const [x, y] of RAGE_EYES) out[y * N + x] = EYE;
  const { x0, y0, x1, y1 } = RIG.lamp;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * N + x;
      const c = out[i];
      if (lamp === 'dim') {
        if (c === LAMP_WHITE) out[i] = LAMP_YELLOW;
        else if (c === LAMP_YELLOW) out[i] = LAMP_AMBER;
      } else if (lamp === 'flash' && c === LAMP_YELLOW) out[i] = LAMP_WHITE;
    }
  return out;
}

// ─── 3. Rotación sin mezclas (EPX ×8 + vecino más cercano) ───────────────────
function epx(img, w, h) {
  const out = new Int16Array(w * h * 4);
  const get = (x, y) =>
    x < 0 || y < 0 || x >= w || y >= h ? -1 : img[y * w + x];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = get(x, y);
      const a = get(x, y - 1);
      const b = get(x + 1, y);
      const c = get(x - 1, y);
      const d = get(x, y + 1);
      const o = 2 * y * 2 * w + 2 * x;
      out[o] = c === a && c !== d && a !== b ? a : p;
      out[o + 1] = a === b && a !== c && b !== d ? b : p;
      out[o + 2 * w] = d === c && d !== b && c !== a ? c : p;
      out[o + 2 * w + 1] = b === d && b !== a && d !== c ? d : p;
    }
  return out;
}
function upscale8(img) {
  let big = img;
  let w = FW;
  let h = FH;
  for (let i = 0; i < 3; i++) {
    big = epx(big, w, h);
    w *= 2;
    h *= 2;
  }
  return big;
}
/**
 * Rota `img` (cuadro completo) `deg` grados en sentido horario de pantalla
 * alrededor de `pivot` y lleva el pivote a `dest` (coordenadas continuas).
 */
function rotate(img, pivot, deg, dest = pivot) {
  if (deg === 0 && dest.x === pivot.x && dest.y === pivot.y) return img.slice();
  const out = blank();
  if (deg === 0) {
    const dx = Math.round(dest.x - pivot.x);
    const dy = Math.round(dest.y - pivot.y);
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const c = at(img, x - dx, y - dy);
        if (c >= 0) out[y * FW + x] = c;
      }
    return out;
  }
  const big = upscale8(img);
  const t = (deg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++) {
      const rx = x + 0.5 - dest.x;
      const ry = y + 0.5 - dest.y;
      const sx = pivot.x + rx * cos + ry * sin;
      const sy = pivot.y - rx * sin + ry * cos;
      const bx = Math.floor(sx * 8);
      const by = Math.floor(sy * 8);
      if (bx < 0 || by < 0 || bx >= FW * 8 || by >= FH * 8) continue;
      const c = big[by * FW * 8 + bx];
      if (c >= 0) out[y * FW + x] = c;
    }
  return out;
}

// ─── 4. Composición de un cuadro ─────────────────────────────────────────────
const put = (dst, src, dx = 0, dy = 0) => {
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++) {
      const c = src[y * FW + x];
      if (c < 0) continue;
      const X = x + dx;
      const Y = y + dy;
      if (X >= 0 && Y >= 0 && X < FW && Y < FH) dst[Y * FW + X] = c;
    }
};
const bbox = (img) => {
  let x0 = FW;
  let y0 = FH;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++)
      if (img[y * FW + x] >= 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return x1 < 0
    ? null
    : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
};

const GRIP = { x: RIG.grip.x + OX, y: RIG.grip.y + OY };
const SHOULDER = { x: RIG.shoulder.x + OX, y: RIG.shoulder.y + OY };
const HEEL = { x: RIG.heel.x + OX, y: RIG.heel.y + OY };

/** Brazo que une el hombro con la mano cuando la picota se aleja del reposo. */
function drawArm(dst, from, to) {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * 2) + 1;
  const core = [];
  for (let i = 0; i <= steps; i++) {
    const x = Math.floor(from.x + ((to.x - from.x) * i) / steps);
    const y = Math.floor(from.y + ((to.y - from.y) * i) / steps);
    core.push([x, y], [x + 1, y]);
  }
  for (const [x, y] of core)
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++)
        if (
          at(dst, x + i, y + j) < 0 &&
          x + i >= 0 &&
          x + i < FW &&
          y + j >= 0 &&
          y + j < FH
        )
          dst[(y + j) * FW + x + i] = INK;
  for (const [x, y] of core)
    if (x >= 0 && x < FW && y >= 0 && y < FH) dst[y * FW + x] = SLEEVE;
}

/** Signo de admiración sobre el gorro (detectar al jugador). */
function drawMark(dst, dy) {
  const x = RIG.markX + OX;
  const fill = [
    [x, -6],
    [x, -5],
    [x, -4],
    [x, -2],
  ].map(([px, py]) => [px, py + OY + dy]);
  for (const [px, py] of fill)
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++)
        if (at(dst, px + i, py + j) < 0) dst[(py + j) * FW + px + i] = INK;
  for (const [px, py] of fill) dst[py * FW + px] = EYE;
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const pose = (over = {}) => ({
  all: [0, 0],
  upper: [0, 0],
  back: [0, 0],
  front: [0, 0],
  arm: [0, 0],
  tip: [0, 0],
  mid: [0, 0],
  face: [0, 0],
  beard: [0, 0],
  weapon: null,
  eyes: 'open',
  lamp: 'on',
  mark: false,
  fall: null,
  drop: null,
  dissolve: 0,
  ...over,
});
const swing = (deg, gx, gy) => ({ deg, gx, gy });

/** Devuelve el cuadro y la caja de la cabeza de la picota. */
function compose(p) {
  const parts = cutParts(recolor(p.eyes, p.lamp));
  const fig = blank();
  const [ux, uy] = p.upper;
  // Picota y brazo: delante del cuerpo, salvo cuando se alzan sobre el hombro
  // (entonces pasan por detrás de la cabeza y el gorro).
  let head = null;
  const weapon = blank();
  if (!p.drop) {
    const g = p.weapon ?? swing(0, 0, 0);
    const dest = { x: GRIP.x + ux + g.gx, y: GRIP.y + uy + g.gy };
    if (Math.abs(g.gx) + Math.abs(g.gy) >= 2 || Math.abs(g.deg) >= 20)
      drawArm(weapon, { x: SHOULDER.x + ux, y: SHOULDER.y + uy }, dest);
    put(weapon, rotate(parts.weapon, GRIP, g.deg, dest));
    head = rotate(parts.pickHead, GRIP, g.deg, dest);
  }
  const behind = (p.weapon?.deg ?? 0) <= -50;
  if (behind) put(fig, weapon);
  // Pies: sin relleno, al levantarse dejan ver el suelo.
  put(fig, parts.footBack, p.back[0], p.back[1]);
  put(fig, parts.footFront, p.front[0], p.front[1]);
  // Cuerpo: si sube, se estira hacia abajo para no separarse de los pies.
  if (uy < 0) put(fig, parts.body, ux, 0);
  put(fig, parts.body, ux, uy);
  // Cara y barba se recortan del interior: debajo queda su posición de reposo.
  put(fig, parts.face, ux, uy);
  put(fig, parts.face, ux + p.face[0], uy + p.face[1]);
  put(fig, parts.beard, ux, uy);
  put(fig, parts.beard, ux + p.beard[0], uy + p.beard[1]);
  put(fig, parts.hatMid, ux + p.mid[0], uy + p.mid[1]);
  if (p.tip[1] < 0) put(fig, parts.hatTip, ux + p.tip[0], uy);
  put(fig, parts.hatTip, ux + p.tip[0], uy + p.tip[1]);
  if (p.arm[0] < 0) put(fig, parts.arm, ux, uy + p.arm[1]);
  put(fig, parts.arm, ux + p.arm[0], uy + p.arm[1]);
  if (!behind) put(fig, weapon);
  if (p.mark) drawMark(fig, uy);

  let frame = fig;
  if (p.fall) {
    frame = rotate(fig, HEEL, p.fall.deg, { x: HEEL.x, y: HEEL.y });
    // Apoya el cuerpo en el suelo y lo mantiene dentro del cuadro.
    const b = bbox(frame);
    const shiftY = BASELINE - (b.y + b.height - 1) + (p.fall.bounce ?? 0);
    const shiftX = Math.max(0, 2 - b.x);
    const moved = blank();
    put(moved, frame, shiftX, shiftY);
    frame = moved;
  }
  if (p.drop) {
    // La picota cae suelta delante del cuerpo y se apoya en el suelo.
    const dest = { x: GRIP.x + p.drop.gx, y: GRIP.y + p.drop.gy };
    const tool = rotate(parts.weapon, GRIP, p.drop.deg, dest);
    const b = bbox(tool);
    const shift = p.drop.ground ? BASELINE - (b.y + b.height - 1) : 0;
    put(frame, tool, 0, shift);
  }
  if (p.all[0] || p.all[1]) {
    const moved = blank();
    put(moved, frame, p.all[0], p.all[1]);
    frame = moved;
    if (head) {
      const h = blank();
      put(h, head, p.all[0], p.all[1]);
      head = h;
    }
  }
  if (p.dissolve > 0)
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++)
        if (BAYER[y & 3][x & 3] < p.dissolve * 16) frame[y * FW + x] = -1;
  return { frame, head: head ? bbox(head) : null };
}

// ─── 5. Poses de cada animación ──────────────────────────────────────────────
const breath = [0, 0, 0, -1, -1, -1, 0, 0];
const idle = (variant) =>
  breath.map((b, f) =>
    pose({
      upper: [0, b],
      tip: [0, [0, 0, 0, 1, 0, 0, -1, 0][f]],
      beard: [0, f === 3 ? 1 : 0],
      weapon: swing(0, 0, b < 0 ? 1 : 0),
      eyes: variant && f === 3 ? 'closed' : 'open',
      lamp: variant && f === 6 ? 'dim' : 'on',
    }),
  );

const WALK_FRONT_DX = [1, 1, 0, -1, -1, -1, 0, 1];
const WALK_FRONT_DY = [0, 0, 0, 0, 0, -1, -1, 0];
const walk = WALK_FRONT_DX.map((dx, f) => {
  const bob = [0, 0, -1, 0, 0, 0, -1, 0][f];
  return pose({
    front: [dx, WALK_FRONT_DY[f]],
    back: [WALK_FRONT_DX[(f + 4) % 8], WALK_FRONT_DY[(f + 4) % 8]],
    upper: [0, bob],
    arm: [Math.max(-1, Math.min(1, -dx)), 0],
    tip: [-1, bob < 0 ? 1 : 0],
    weapon: swing(0, 0, bob < 0 ? 1 : 0),
  });
});

const RUN_FRONT_DX = [2, 2, 1, -1, -2, -2, -1, 1];
const RUN_FRONT_DY = [0, 0, 0, 0, 0, -1, -2, -1];
const run = RUN_FRONT_DX.map((dx, f) => {
  const bob = [0, -1, -1, 0, 0, -1, -1, 0][f];
  return pose({
    front: [dx, RUN_FRONT_DY[f]],
    back: [-dx, RUN_FRONT_DY[(f + 4) % 8]],
    upper: [1, bob],
    arm: [[-1, -1, 0, 0, 1, 1, 0, 0][f], 0],
    tip: [bob < 0 ? -2 : -1, bob < 0 ? 1 : 0],
    weapon: swing(-25, 0, -1 + (bob < 0 ? 1 : 0)),
  });
});

const attack = [
  pose({ upper: [0, 1], weapon: swing(-15, 0, 1) }),
  pose({ upper: [-1, 0], tip: [1, 0], weapon: swing(-45, -1, -2) }),
  pose({
    upper: [-1, -1],
    tip: [1, 0],
    weapon: swing(-80, -2, -4),
    eyes: 'rage',
  }),
  pose({ upper: [0, 0], tip: [0, 0], weapon: swing(-20, 0, -3), eyes: 'rage' }),
  pose({
    upper: [1, 1],
    front: [1, 0],
    tip: [-2, 0],
    beard: [1, 0],
    weapon: swing(66, 2, -1),
    eyes: 'rage',
  }),
  pose({
    upper: [1, 1],
    front: [1, 0],
    tip: [-1, 0],
    beard: [1, 0],
    weapon: swing(70, 2, -1),
  }),
  pose({ upper: [0, 0], tip: [-1, 0], weapon: swing(40, 1, 0) }),
  pose({ weapon: swing(10, 0, 0) }),
];

const hurt = [
  pose({
    upper: [-2, 0],
    tip: [1, 0],
    beard: [-1, 0],
    eyes: 'closed',
    weapon: swing(-20, -1, -1),
  }),
  pose({
    upper: [-1, 0],
    tip: [1, 0],
    eyes: 'closed',
    weapon: swing(-10, -1, 0),
  }),
  pose({ upper: [1, 0], tip: [-1, 0] }),
  pose({}),
];

const death = [
  pose({
    upper: [-2, 0],
    tip: [1, 0],
    eyes: 'closed',
    weapon: swing(-55, -1, -2),
  }),
  pose({
    upper: [-1, 0],
    eyes: 'closed',
    weapon: swing(-70, -1, -3),
    fall: { deg: -12 },
  }),
  pose({ eyes: 'closed', fall: { deg: -40 }, drop: { deg: 20, gx: 3, gy: 1 } }),
  pose({
    eyes: 'closed',
    fall: { deg: -75 },
    drop: { deg: 62, gx: 4, gy: 4, ground: true },
  }),
  pose({
    eyes: 'closed',
    fall: { deg: -90, bounce: -1 },
    drop: { deg: 62, gx: 4, gy: 4, ground: true },
  }),
  pose({
    eyes: 'closed',
    lamp: 'dim',
    fall: { deg: -90 },
    drop: { deg: 62, gx: 4, gy: 4, ground: true },
  }),
  pose({
    eyes: 'closed',
    lamp: 'dim',
    fall: { deg: -90 },
    drop: { deg: 62, gx: 4, gy: 4, ground: true },
    dissolve: 0.4,
  }),
  pose({
    eyes: 'closed',
    lamp: 'dim',
    fall: { deg: -90 },
    drop: { deg: 62, gx: 4, gy: 4, ground: true },
    dissolve: 0.75,
  }),
];

const alert = [
  pose({ upper: [0, 1], weapon: swing(0, 0, 1) }),
  pose({
    all: [0, -3],
    tip: [0, 1],
    mark: true,
    eyes: 'rage',
    lamp: 'flash',
    weapon: swing(-10, 0, 0),
  }),
  pose({ all: [0, -2], mark: true, eyes: 'rage', weapon: swing(-20, 0, -1) }),
  pose({
    upper: [0, 1],
    tip: [0, 1],
    mark: true,
    eyes: 'rage',
    weapon: swing(-25, 0, -1),
  }),
  pose({ mark: true, eyes: 'rage', weapon: swing(-35, 0, -2) }),
  pose({ eyes: 'rage', weapon: swing(-35, 0, -2) }),
];

const rage = [
  pose({
    upper: [-1, 0],
    tip: [1, 0],
    eyes: 'rage',
    lamp: 'flash',
    weapon: swing(-58, -1, -3),
  }),
  pose({
    upper: [1, 0],
    tip: [-1, 0],
    eyes: 'rage',
    weapon: swing(-52, 0, -3),
  }),
  pose({
    upper: [-1, 0],
    tip: [1, 0],
    eyes: 'rage',
    lamp: 'dim',
    weapon: swing(-58, -1, -3),
  }),
  pose({
    upper: [1, 0],
    tip: [-1, 0],
    eyes: 'rage',
    lamp: 'flash',
    weapon: swing(-52, 0, -3),
  }),
  pose({
    upper: [0, -1],
    back: [0, -1],
    tip: [0, 1],
    eyes: 'rage',
    weapon: swing(-70, -1, -4),
  }),
  pose({
    upper: [0, 1],
    tip: [0, -1],
    beard: [0, 1],
    eyes: 'rage',
    weapon: swing(-52, 0, -2),
  }),
];

const mine = [
  pose({ weapon: swing(-10, 0, 0) }),
  pose({ upper: [-1, 0], weapon: swing(-40, -1, -2) }),
  pose({ upper: [-1, -1], tip: [1, 0], weapon: swing(-75, -2, -3) }),
  pose({ upper: [-1, 0], tip: [1, 1], weapon: swing(-75, -2, -3) }),
  pose({
    upper: [1, 0],
    tip: [-1, 0],
    beard: [1, 0],
    weapon: swing(48, 2, -2),
  }),
  pose({ upper: [1, 1], tip: [-1, 0], weapon: swing(44, 2, -2) }),
  pose({ tip: [-1, 0], weapon: swing(25, 1, 0) }),
  pose({ weapon: swing(0, 0, 0) }),
];

const look = [
  pose({}),
  pose({ face: [-1, 0], tip: [1, 0] }),
  pose({ face: [-1, 0], tip: [1, 0], eyes: 'closed' }),
  pose({ tip: [0, 0] }),
  pose({ face: [1, 0], tip: [-1, 0] }),
  pose({ face: [1, 0], tip: [-1, 0], lamp: 'dim' }),
];

const CLIPS = {
  idle: idle(false),
  idleBlink: idle(true),
  walk,
  run,
  attack,
  hurt,
  death,
  alert,
  rage,
  mine,
  look,
};

// ─── 6. Hoja y metadatos ─────────────────────────────────────────────────────
const rows = Object.keys(GNOME_ANIMATIONS).length;
const sheet = createImage(FW * GNOME_SHEET.columns, FH * rows);
const strike = {};
for (const [name, clip] of Object.entries(GNOME_ANIMATIONS)) {
  const poses = CLIPS[name];
  if (!poses || poses.length !== clip.count)
    throw new Error(`${name}: se esperaban ${clip.count} poses`);
  poses.forEach((p, f) => {
    const { frame, head } = compose(p);
    if (GNOME_IMPACT_FRAME[name] === f) strike[name] = head;
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const c = frame[y * FW + x];
        if (c < 0) continue;
        const i = ((clip.row * FH + y) * sheet.width + f * FW + x) * 4;
        sheet.data.set([...PAL[c], 255], i);
      }
  });
}
writePng(
  OUT ? `${OUT}/gnome.png` : 'public/assets/characters/gnome/gnome.png',
  sheet,
);

const box = (b) =>
  `{ x: ${b.x}, y: ${b.y}, width: ${b.width}, height: ${b.height} }`;
writeFileSync(
  OUT ? `${OUT}/gnomeFrames.ts` : 'src/game/config/gnomeFrames.ts',
  `// Generado por scripts/art/build-gnome.mjs (npm run art:gnome). No editar a mano.

/**
 * Cabeza de la picota en el cuadro de impacto, en coordenadas del cuadro de
 * 64 × 48 con el gnomo mirando a la derecha. Es la zona que hace daño.
 */
export const GNOME_STRIKE_BOX = {
  attack: ${box(strike.attack)},
  mine: ${box(strike.mine)},
} as const;
`,
);
console.log(
  `Gnomo de ${SIZE} px: ${rows} animaciones, ${Object.values(CLIPS).flat().length} cuadros de ${FW}×${FH}, ${PAL.length} colores, alfa binario.`,
);
console.log('Impacto:', JSON.stringify(strike));
