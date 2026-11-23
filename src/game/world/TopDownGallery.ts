import { solidLength } from '../lighting/LightOcclusion';
import { GalleryRailway } from '../systems/GalleryRailway';
import { GalleryStability } from '../systems/GalleryStability';
import { GalleryVentilation } from '../systems/GalleryVentilation';
import { MiningSystem } from '../systems/MiningSystem';
import { VisibilitySystem } from '../systems/VisibilitySystem';
import { Block, TerrainGrid, type Cell, type Point } from './TerrainGrid';

export const GALLERY_LEVEL = -1;
export const GALLERY_ENTRY = { x: 232, y: 191 };
const SIZE = { columns: 36, rows: 24 };

export function galleryVisible(
  grid: TerrainGrid,
  origin: Point,
  target: Cell,
): boolean {
  const { column, row } = target;
  if (grid.isSolid(column, row) && !grid.isExposed(column, row)) return false;
  const { x, y } = TerrainGrid.center(target);
  return (
    solidLength(
      {
        isSolid: (c, r) => (c !== column || r !== row) && grid.isSolid(c, r),
      },
      origin.x,
      origin.y,
      x,
      y,
      0.001,
    ) < 0.001
  );
}

// Planta fija de la primera explotación. El índice de cada veta identifica
// su premio dentro de este nivel, independientemente de la geología lateral.
const DEPOSITS = [
  {
    ore: Block.Coal,
    cells: [
      [13, 10],
      [13, 9],
      [12, 9],
    ],
  },
  {
    ore: Block.Iron,
    cells: [
      [19, 11],
      [20, 11],
      [20, 10],
    ],
  },
  {
    ore: Block.Copper,
    cells: [
      [16, 7],
      [17, 7],
      [17, 6],
    ],
  },
  {
    ore: Block.Coal,
    cells: [
      [10, 15],
      [10, 16],
      [9, 16],
    ],
  },
] as const;

export class TopDownGallery {
  readonly grid = new TerrainGrid(SIZE.columns, SIZE.rows);
  readonly mining = new MiningSystem(this.grid);
  readonly visibility = new VisibilitySystem(SIZE.columns, SIZE.rows);
  readonly railway = new GalleryRailway(this.grid);
  readonly ventilation = new GalleryVentilation(this.grid);
  readonly dug = new Set<number>();
  readonly stability = new GalleryStability(
    this.grid,
    this.dug,
    ({ column, row }) => column >= 13 && column <= 15 && row >= 11 && row <= 12,
  );
  position: Point = GALLERY_ENTRY;
  active = false;

  constructor(
    private readonly solid = false,
    readonly layoutSeed?: number,
  ) {
    const { columns, rows } = this.grid;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const edge = x === 0 || y === 0 || x === columns - 1 || y === rows - 1;
        // El arranque conserva espacio para el acceso, la toma de aire y la vía.
        const room =
          x >= 13 &&
          x <= (solid ? 17 : 18) &&
          y >= 11 &&
          y <= (solid ? 13 : 14);
        const branch = !solid && x >= 15 && x <= 17 && y >= 8 && y <= 10;
        this.grid.set(
          x,
          y,
          edge ? Block.Bedrock : room || branch ? Block.Air : Block.Rock,
        );
      }
    }
    for (const { ore, cells } of DEPOSITS)
      for (const [x, y] of cells) this.grid.set(x, y, ore);
    if (layoutSeed !== undefined) {
      // Una ruta continua une la estación, el taller oeste y las labores del este.
      const carve = (
        left: number,
        top: number,
        right: number,
        bottom: number,
      ) => {
        for (let r = top; r <= bottom; r++)
          for (let c = left; c <= right; c++) this.grid.set(c, r, Block.Air);
      };
      carve(5, 12, 14, 12);
      carve(3, 9, 7, 14);
      carve(5, 5, 5, 9);
      carve(4, 3, 10, 5);
      carve(16, 12, 29, 13);
      carve(24, 9, 30, 14);
      carve(27, 4, 27, 9);
      carve(25, 3, 32, 5);
      const south = 17 + ((layoutSeed >>> 0) % 4);
      carve(21, 14, 21, south);
      carve(18, south, 25, south + 1);
      this.grid.set(8, 4, Block.HardRock);
      this.grid.set(9, 3, Block.Gold);
      this.grid.set(10, 3, Block.Gold);
      this.grid.set(32, 4, Block.Copper);
      this.grid.set(32, 3, Block.Copper);
      this.grid.set(22, south + 2, Block.Iron);
      this.grid.set(23, south + 2, Block.Iron);
    }
    this.ventilation.evaluate();
  }

  deposit(column: number, row: number): number {
    return DEPOSITS.findIndex(({ cells }) =>
      cells.some(([x, y]) => x === column && y === row),
    );
  }

  snapshot() {
    return {
      version: this.layoutSeed !== undefined ? 3 : this.solid ? 2 : 1,
      layoutSeed: this.layoutSeed,
      level: GALLERY_LEVEL,
      dug: [...this.dug].sort((a, b) => a - b),
      revealed: this.visibility.encode(),
      position: this.position,
      active: this.active,
      railway: this.railway.snapshot(),
      stability: this.stability.snapshot(),
      ventilation: this.ventilation.snapshot(),
    };
  }

  static restore(raw: unknown): TopDownGallery | undefined {
    if (!raw || typeof raw !== 'object') return;
    const data = raw as Partial<ReturnType<TopDownGallery['snapshot']>>;
    if (
      (data.version !== 1 &&
        data.version !== 2 &&
        !(data.version === 3 && Number.isInteger(data.layoutSeed))) ||
      data.level !== GALLERY_LEVEL ||
      !Array.isArray(data.dug)
    )
      return;
    const gallery = new TopDownGallery(
      data.version !== 1,
      data.version === 3 ? data.layoutSeed : undefined,
    );
    const { grid, visibility } = gallery;
    for (const index of data.dug) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= grid.rows * grid.columns
      )
        continue;
      const c = index % grid.columns,
        r = Math.floor(index / grid.columns);
      const block = grid.get(c, r);
      if (block === Block.Bedrock || block === Block.Air) continue;
      grid.set(c, r, Block.Air);
      gallery.dug.add(index);
    }
    if (typeof data.revealed === 'string') visibility.decode(data.revealed);
    gallery.stability.restore(data.stability);
    gallery.railway.restore(data.railway);
    gallery.ventilation.restore(data.ventilation);
    const p = data.position;
    if (
      p &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      [-5, 4].every((dx) =>
        [-6, -1].every((dy) => {
          const { column, row } = TerrainGrid.worldToCell(p.x + dx, p.y + dy);
          return !grid.isSolid(column, row);
        }),
      )
    )
      gallery.position = p;
    gallery.active = data.active === true;
    return gallery;
  }
}
