/**
 * Exposición de las estructuras a la luz real (lógica pura, sin Phaser).
 *
 * Problema que resuelve: la oscuridad se calcula por celda del terreno. Un
 * objeto dibujado delante de la roca (el letrero sobre la bocamina, el
 * dintel, un techo apoyado en la ladera) heredaba la oscuridad de la roca de
 * detrás aunque estuviera al aire libre.
 *
 * Regla: cada píxel opaco de una estructura que cae sobre una celda sólida
 * pertenece a esa estructura; su luz es la del aire que la rodea (máximo de
 * la luz compuesta en sus puntos de muestra sobre celdas de aire). Así un
 * objeto al sol queda iluminado; uno dentro de una galería, oscuro salvo que
 * lo alcance una lámpara; y si algún día anochece, se oscurece solo. Los
 * píxeles sobre aire siguen usando la luz de su propia celda.
 */
export interface SurfaceShape {
  /** Esquina superior izquierda en píxeles del mundo. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** ¿El píxel (i, j) de la forma es opaco? */
  opaque: (i: number, j: number) => boolean;
}

/** Separación de los puntos de muestra de luz (px). */
const STEP = 4;

export class ExposureMap {
  /** Dueño de cada píxel del mundo (0 = ninguno; k = forma k − 1). */
  readonly owner: Uint16Array;
  /** Celdas de 4 × 4 px con algún píxel con dueño (atajo de la composición). */
  readonly ownedCells: Uint8Array;
  /** Luz 0..1 de cada forma en el último cuadro (índice = dueño). */
  exposure = new Float32Array(1);
  /** Puntos de muestra sobre aire de cada forma (x, y intercalados). */
  private samples: Int32Array[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.owner = new Uint16Array(width * height);
    this.ownedCells = new Uint8Array(Math.ceil(width / 4) * Math.ceil(height / 4));
  }

  /** ¿La celda de 4 px que contiene (x, y) tiene píxeles con dueño? */
  cellOwned(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.ownedCells[(y >> 2) * Math.ceil(this.width / 4) + (x >> 2)] === 1;
  }

  /** Reconstruye dueños y puntos de muestra (al excavar o al cambiar objetos). */
  rebuild(
    shapes: readonly SurfaceShape[],
    solid: (x: number, y: number) => boolean,
  ): void {
    this.owner.fill(0);
    this.ownedCells.fill(0);
    const cellsWide = Math.ceil(this.width / 4);
    this.samples = [new Int32Array(0)];
    shapes.forEach((s, k) => {
      const id = k + 1;
      if (id > 0xffff) return;
      const points: number[] = [];
      for (let j = 0; j < s.h; j++) {
        const y = s.y + j;
        if (y < 0 || y >= this.height) continue;
        for (let i = 0; i < s.w; i++) {
          const x = s.x + i;
          if (x < 0 || x >= this.width || !s.opaque(i, j)) continue;
          if (solid(x, y)) {
            this.owner[y * this.width + x] = id;
            this.ownedCells[(y >> 2) * cellsWide + (x >> 2)] = 1;
          }
          else if (i % STEP === 0 && j % STEP === 0) points.push(x, y);
        }
      }
      // Sin aire en su contorno inmediato: muestra bajo los bordes, por si la
      // pieza solo se apoya en la roca (queda a oscuras si no llega luz).
      if (!points.length)
        for (const [x, y] of [
          [s.x - 1, s.y + (s.h >> 1)],
          [s.x + s.w, s.y + (s.h >> 1)],
          [s.x + (s.w >> 1), s.y - 1],
        ] as const)
          if (!solid(x, y)) points.push(x, y);
      this.samples.push(Int32Array.from(points));
    });
    this.exposure = new Float32Array(this.samples.length);
  }

  /** Luz de cada forma: la máxima del aire que la rodea en este cuadro. */
  update(lightAt: (x: number, y: number) => number): void {
    for (let k = 1; k < this.samples.length; k++) {
      const p = this.samples[k]!;
      let e = 0;
      for (let i = 0; i < p.length; i += 2) {
        const v = lightAt(p[i]!, p[i + 1]!);
        if (v > e) e = v;
      }
      this.exposure[k] = e;
    }
  }

  /** Luz del píxel del mundo según su estructura, o −1 si no tiene dueño. */
  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    const id = this.owner[y * this.width + x]!;
    return id ? this.exposure[id]! : -1;
  }
}
