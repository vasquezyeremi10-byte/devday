import { describe, expect, it } from 'vitest';
import {
  createInitialTerrain,
  WORLD_REV_EXPLORE,
  WORLD_REV_LEGACY,
} from './Geology';
import { isOutcrop, surfaceRow } from './TerrainGrid';
import {
  edgeFrame,
  materialAt,
  TERRAIN_FRAME_COUNT,
  terrainFrame,
  transitionFrame,
} from './TerrainVisuals';

/**
 * Atlas del terreno (corrección visual, 11 de noviembre de 2026). Un frame
 * fuera de la textura `terrain` se dibujaría con la textura de reemplazo de
 * Phaser; aquí se recorre el mundo entero, oculto y descubierto, en las dos
 * geologías.
 */
describe('Frames del terreno dentro del atlas', () => {
  for (const rev of [WORLD_REV_LEGACY, WORLD_REV_EXPLORE])
    it(`geología rev. ${rev}: todo frame es -1 o un índice válido`, () => {
      const grid = createInitialTerrain(12345, rev);
      const bad: string[] = [];
      const check = (frame: number, what: string, c: number, r: number) => {
        if (frame !== -1 && !(frame >= 0 && frame < TERRAIN_FRAME_COUNT))
          bad.push(`${what} ${c},${r} → ${frame}`);
      };
      for (let r = 0; r < grid.rows; r++)
        for (let c = 0; c < grid.columns; c++) {
          check(terrainFrame(grid, c, r), 'visible', c, r);
          check(
            terrainFrame(grid, c, r, () => false),
            'oculto',
            c,
            r,
          );
          check(edgeFrame(grid, c, r), 'borde', c, r);
          check(transitionFrame(grid, c, r), 'transición', c, r);
        }
      expect(bad).toEqual([]);
    });

  it('los afloramientos del desierto usan arenisca, no la roca del subsuelo', () => {
    const grid = createInitialTerrain(12345, WORLD_REV_EXPLORE);
    let outcrops = 0;
    for (let c = 0; c < grid.columns; c++)
      for (let r = 0; r <= surfaceRow(c) + 2; r++)
        if (isOutcrop(c, r) && grid.isSolid(c, r)) {
          outcrops++;
          expect(materialAt(grid, c, r)).toBe('outcrop');
        }
    expect(outcrops).toBeGreaterThan(0);
  });
});
