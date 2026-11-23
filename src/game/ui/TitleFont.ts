/**
 * Tipografía del título del menú (lógica pura, sin Phaser), dibujada sobre la
 * MISMA rejilla de 1 px que el resto del juego. Antes cada «píxel» del título
 * medía 3 px (celdas de 3 × 3): eran los píxeles más gruesos de la pantalla,
 * tres veces mayores que los de la ilustración, los botones y el texto.
 *
 * Cada letra mide GLYPH_W × GLYPH_H píxeles y se arma con formas de trazo de
 * 5 px (troncos, barras y diagonales) con las esquinas talladas, como piezas
 * cortadas en la roca. `rasterLetter` las sombrea con luz arriba a la
 * izquierda: cara dorada en dos tonos (lingote), filete de luz crema arriba y
 * a la izquierda, sombra ocre abajo y a la derecha, relieve de 3 px hacia
 * abajo y contorno de tinta de 1 px. Todo opaco: alfa 0/255.
 */
export const GLYPH_W = 18;
export const GLYPH_H = 22;
/** Trazo de troncos y barras (px). */
const STROKE = 5;
/** Separación entre letras (px). */
export const LETTER_GAP = 2;
/** Profundidad del relieve (px). */
export const EXTRUDE = 3;

type Shape = (x: number, y: number) => boolean;

const rect =
  (x0: number, y0: number, x1: number, y1: number): Shape =>
  (x, y) =>
    x >= x0 && x < x1 && y >= y0 && y < y1;
const union =
  (...shapes: Shape[]): Shape =>
  (x, y) =>
    shapes.some((s) => s(x, y));
const minus =
  (a: Shape, b: Shape): Shape =>
  (x, y) =>
    a(x, y) && !b(x, y);

/**
 * Caja con las esquinas de la derecha cortadas en diagonal de 45° (D y P):
 * `c` es el lado del corte en las esquinas de la derecha.
 */
const roundedRight =
  (x0: number, y0: number, x1: number, y1: number, c: number): Shape =>
  (x, y) => {
    if (!rect(x0, y0, x1, y1)(x, y)) return false;
    const top = x - (x1 - c) > y - y0;
    const bottom = x - (x1 - c) > y1 - 1 - y;
    return !(top && x >= x1 - c) && !(bottom && x >= x1 - c);
  };

/** Quita 3 píxeles en cada esquina de la caja de la letra (talla). */
const nibble: Shape = (x, y) =>
  x + y < 2 ||
  GLYPH_W - 1 - x + y < 2 ||
  x + GLYPH_H - 1 - y < 2 ||
  GLYPH_W - 1 - x + GLYPH_H - 1 - y < 2;

const W = GLYPH_W;
const H = GLYPH_H;
const S = STROKE;
const MID = Math.floor(H / 2);

/** Brazo diagonal de la K entre (x0, y0) y (x1, y1), de `t` px de ancho. */
const diagonal =
  (xa: number, ya: number, xb: number, yb: number, t: number): Shape =>
  (x, y) => {
    const lo = Math.min(ya, yb);
    const hi = Math.max(ya, yb);
    if (y < lo || y > hi) return false;
    const k = (y - ya) / (yb - ya);
    const xc = Math.round(xa + k * (xb - xa));
    return x >= xc && x < xc + t;
  };

const SHAPES: Record<string, Shape> = {
  D: minus(
    roundedRight(0, 0, W, H, 7),
    roundedRight(S, S, W - S, H - S, 3),
  ),
  E: union(
    rect(0, 0, S, H),
    rect(0, 0, W, S),
    rect(0, H - S, W, H),
    rect(0, MID - 2, W - 3, MID + 2),
  ),
  P: union(
    minus(roundedRight(0, 0, W, 14, 7), roundedRight(S, S, W - S, 14 - S, 3)),
    rect(0, 0, S, H),
  ),
  K: union(
    rect(0, 0, S, H),
    diagonal(W - 6, 0, S - 1, MID, 6),
    diagonal(S - 1, MID, W - 6, H - 1, 6),
  ),
  I: union(
    rect(0, 0, W, S - 1),
    rect(0, H - S + 1, W, H),
    rect((W - 6) / 2, 0, (W + 6) / 2, H),
  ),
  N: union(
    rect(0, 0, S, H),
    rect(W - S, 0, W, H),
    diagonal(0, 0, W - 6, H - 1, 6),
  ),
};

/** ¿Hay un glifo tallado para esta letra? */
export const hasGlyph = (char: string): boolean => char in SHAPES;

/** Forma de una letra con las esquinas talladas (vacía si no existe). */
export function glyphShape(char: string): Shape {
  const shape = SHAPES[char];
  if (!shape) return () => false;
  return (x, y) =>
    x >= 0 && y >= 0 && x < GLYPH_W && y < GLYPH_H && shape(x, y) && !nibble(x, y);
}

export type TitleColor =
  | 'ink'
  | 'cream'
  | 'gold'
  | 'amber'
  | 'ochre'
  | 'rust'
  | 'ember';

/** Letra rasterizada: `pixels[y][x]` es un color o null (transparente). */
export interface LetterRaster {
  width: number;
  height: number;
  pixels: (TitleColor | null)[][];
  /** Píxeles de la cara (para el destello), en coordenadas del cuadro. */
  face: [number, number][];
}

/** Cuadro de una letra: caja + relieve + 1 px de contorno por cada lado. */
export const LETTER_FRAME_W = GLYPH_W + 2;
export const LETTER_FRAME_H = GLYPH_H + EXTRUDE + 2;

export function rasterLetter(char: string): LetterRaster {
  const inside = glyphShape(char);
  const W2 = LETTER_FRAME_W;
  const H2 = LETTER_FRAME_H;
  const pixels: (TitleColor | null)[][] = Array.from({ length: H2 }, () =>
    Array<TitleColor | null>(W2).fill(null),
  );
  const solid = Array.from({ length: H2 }, () => Array<boolean>(W2).fill(false));
  // Relieve: la cara repetida de 1 a EXTRUDE px más abajo.
  for (let y = 0; y < GLYPH_H; y++)
    for (let x = 0; x < GLYPH_W; x++)
      if (inside(x, y))
        for (let d = 1; d <= EXTRUDE; d++) {
          pixels[y + 1 + d]![x + 1] = d === EXTRUDE ? 'ember' : 'rust';
          solid[y + 1 + d]![x + 1] = true;
        }
  // Cara: lingote en dos tonos con filete de luz arriba y a la izquierda.
  const face: [number, number][] = [];
  const split = MID;
  for (let y = 0; y < GLYPH_H; y++)
    for (let x = 0; x < GLYPH_W; x++) {
      if (!inside(x, y)) continue;
      const upper = y < split;
      let c: TitleColor = upper ? 'gold' : 'amber';
      if (!inside(x + 1, y)) c = upper ? 'amber' : 'ochre';
      if (!inside(x, y + 1)) c = 'ochre';
      if (!inside(x - 1, y)) c = upper ? 'cream' : 'gold';
      if (!inside(x, y - 1)) c = 'cream';
      pixels[y + 1]![x + 1] = c;
      solid[y + 1]![x + 1] = true;
      face.push([x + 1, y + 1]);
    }
  // Contorno de tinta de 1 px alrededor de la cara y el relieve.
  for (let y = 0; y < H2; y++)
    for (let x = 0; x < W2; x++) {
      if (solid[y]![x]) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1 && !near; dx++)
          near = !!solid[y + dy]?.[x + dx];
      if (near) pixels[y]![x] = 'ink';
    }
  return { width: W2, height: H2, pixels, face };
}

/** Ancho total del título (cajas de las letras con su separación), en px. */
export const titleWidth = (length: number): number =>
  length * GLYPH_W + Math.max(0, length - 1) * LETTER_GAP;
