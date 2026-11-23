import { surfaceRow, type TerrainGrid } from '../world/TerrainGrid';

/**
 * Terreno descubierto. Es memoria de exploración, distinta de la luz: un
 * bloque descubierto puede estar a oscuras, pero uno no descubierto nunca
 * muestra su contenido (TerrainView lo dibuja como su estrato y la oscuridad
 * no le aplica luz ambiental). Se descubre al recibir luz o al excavarlo.
 *
 * Los índices son los de la cuadrícula (`TerrainGrid.index`): fila ×
 * columnas + (columna − `first`), así el mundo abierto admite columnas
 * negativas.
 */
export class VisibilitySystem {
  readonly revealed: Uint8Array;
  /** Celdas cuyo aspecto debe redibujarse (las consume TerrainView). */
  readonly dirty: number[] = [];

  constructor(
    readonly columns: number,
    readonly rows: number,
    /** Columna del mundo de la primera columna (como TerrainGrid.first). */
    readonly first = 0,
  ) {
    this.revealed = new Uint8Array(columns * rows);
  }

  private inside(column: number, row: number): boolean {
    return (
      column >= this.first &&
      row >= 0 &&
      column < this.first + this.columns &&
      row < this.rows
    );
  }

  has(column: number, row: number): boolean {
    if (!this.inside(column, row)) return false;
    return this.revealed[row * this.columns + column - this.first] === 1;
  }

  reveal(column: number, row: number): boolean {
    if (!this.inside(column, row)) return false;
    const i = row * this.columns + column - this.first;
    if (this.revealed[i]) return false;
    this.revealed[i] = 1;
    this.dirty.push(i);
    return true;
  }

  /**
   * Estado inicial (o de una partida migrada): el aire conectado al cielo y
   * los bloques que lo tocan. Una caverna sellada queda sin descubrir.
   */
  initialize(grid: TerrainGrid): void {
    const { columns, rows, first } = this;
    const open = new Uint8Array(columns * rows);
    const queue: number[] = [];
    for (let x = 0; x < columns; x++)
      for (let r = 0; r < surfaceRow(x + first); r++)
        if (!grid.isSolid(x + first, r)) {
          open[r * columns + x] = 1;
          queue.push(r * columns + x);
        }
    while (queue.length) {
      const i = queue.pop()!;
      const c = i % columns,
        r = Math.floor(i / columns);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const x = c + dx,
          y = r + dy;
        if (x < 0 || y < 0 || x >= columns || y >= rows) continue;
        const n = y * columns + x;
        // Las cavernas naturales (rev. 2) se descubren explorándolas.
        if (open[n] || grid.isSolid(x + first, y) || grid.caveAir.has(n))
          continue;
        open[n] = 1;
        queue.push(n);
      }
    }
    for (let i = 0; i < open.length; i++) {
      if (!open[i]) continue;
      const c = (i % columns) + first,
        r = Math.floor(i / columns);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) this.reveal(c + dx, r + dy);
    }
    this.dirty.length = 0;
  }

  /** Cadena compacta: base64 de un mapa de bits fila por fila. */
  encode(): string {
    const bytes = new Uint8Array(Math.ceil(this.revealed.length / 8));
    this.revealed.forEach((v, i) => {
      if (v) bytes[i >> 3]! |= 1 << (i & 7);
    });
    let text = '';
    bytes.forEach((b) => (text += String.fromCharCode(b)));
    return btoa(text);
  }

  /**
   * `columns` y `first`: ancho y primera columna con que se guardó el mapa.
   * Un mapa de otra forma (partida anterior a una ampliación) se suma a lo ya
   * descubierto, celda por celda en columnas del mundo.
   */
  decode(
    value: string,
    columns: number = this.columns,
    first: number = this.first,
  ): boolean {
    try {
      const text = atob(value);
      const count = columns * this.rows;
      if (
        first < this.first ||
        first + columns > this.first + this.columns ||
        text.length !== Math.ceil(count / 8)
      )
        return false;
      const bit = (i: number) => (text.charCodeAt(i >> 3) >> (i & 7)) & 1;
      if (columns === this.columns && first === this.first)
        for (let i = 0; i < this.revealed.length; i++)
          this.revealed[i] = bit(i);
      else
        for (let i = 0; i < count; i++)
          if (bit(i))
            this.revealed[
              Math.floor(i / columns) * this.columns +
                (i % columns) +
                first -
                this.first
            ] = 1;
      this.dirty.length = 0;
      return true;
    } catch {
      return false;
    }
  }
}
