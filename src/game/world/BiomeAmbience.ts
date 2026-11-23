import Phaser from 'phaser';
import { TILE_SIZE, VIEW, WORLD_LEFT } from '../config/constants';
import {
  biomeDef,
  ditheredBiome,
  BIOME_BAND,
  type Ambience,
} from '../config/biomes';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import type { DayNightCycle } from '../systems/DayNightCycle';
import { surfaceRow, type TerrainGrid } from './TerrainGrid';

/**
 * Ambiente vivo de las zonas (V9): pocas partículas de 1–4 px en el aire
 * libre sobre el suelo, con colores de la paleta y sin alfa parcial (aparecen
 * y desaparecen de golpe). Cada partícula toma el tipo de la zona que pisa,
 * así en los cruces se mezclan como el resto del paisaje:
 *
 * - Cerros de la Costa: ráfagas de viento;
 * - La Portada: brisa salina.
 *
 * El polvo del desierto sigue en world/Backdrop.ts (V7). Las posiciones salen
 * del tiempo y del índice (sin estado por partícula): no hay nada que crear ni
 * destruir mientras se camina, y el total está acotado (COUNT).
 */
const COUNT = 16;
const SPAN = VIEW.width + 40;

const hash = (a: number, b: number) => {
  let h = Math.imul(a + 17, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const mod = (v: number, m: number) => ((v % m) + m) % m;

export class BiomeAmbience {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private elapsed = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly grid: TerrainGrid,
  ) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.terrain + 1);
  }

  update(
    day: DayNightCycle,
    dtMs: number,
    active: boolean,
    cam: Phaser.Cameras.Scene2D.Camera,
  ): void {
    if (active) this.elapsed += dtMs;
    const g = this.gfx.clear();
    const t = this.elapsed / 1000;
    const sun = day.sunStrength;
    const left = Math.floor(cam.scrollX) - 20;
    for (let i = 0; i < COUNT; i++) {
      const r1 = hash(i, 1),
        r2 = hash(i, 2),
        r3 = hash(i, 3);
      // Posición base en la vista (deriva propia según el tipo, abajo).
      const baseX = left + Math.floor(r1 * SPAN);
      const column = Math.floor(baseX / TILE_SIZE);
      if (baseX < WORLD_LEFT + TILE_SIZE || column >= this.grid.end - 1) continue;
      const kind: Ambience =
        biomeDef(ditheredBiome(column, BIOME_BAND, 17)).ambience;
      const p = this.particle(kind, i, t, r2, r3, sun);
      if (!p) continue;
      const x = Math.round(left + mod(r1 * SPAN + p.dx, SPAN));
      const cell = Math.floor(x / TILE_SIZE);
      if (x < WORLD_LEFT + TILE_SIZE || cell >= this.grid.end - 1) continue;
      const y = Math.round(surfaceRow(cell) * TILE_SIZE - p.h);
      // Solo aire libre: nunca dentro de la roca ni bajo la superficie natural.
      if (
        y >= surfaceRow(cell) * TILE_SIZE ||
        this.grid.isSolid(cell, Math.floor(y / TILE_SIZE))
      )
        continue;
      g.fillStyle(p.color).fillRect(x, y, p.w, p.hgt);
    }
  }

  /**
   * Desplazamiento horizontal (dx), altura sobre el suelo (h), tamaño y
   * color de la partícula i para el tipo de ambiente; null si no se ve.
   */
  private particle(
    kind: Ambience,
    i: number,
    t: number,
    r2: number,
    r3: number,
    sun: number,
  ): { dx: number; h: number; w: number; hgt: number; color: number } | null {
    switch (kind) {
      case 'dust':
        // Lo dibuja el fondo del desierto.
        return null;
      case 'wind': {
        // Ráfagas: trazos cortos y rápidos que cruzan en tandas.
        const gust = Math.floor(t / 3 + r2 * 5) % 4 === 0;
        if (!gust || i % 2) return null;
        return {
          dx: -t * (120 + r2 * 60),
          h: 12 + r3 * 60,
          w: 3 + (i % 3),
          hgt: 1,
          color: sun < 0.25 ? P.steel : P.mist,
        };
      }
      case 'spray': {
        if (i % 2) return null;
        const rise = 30;
        const h = mod(t * (6 + r2 * 4) + r3 * rise, rise) + 2;
        return {
          dx: -t * (14 + r2 * 8),
          h,
          w: 1,
          hgt: 1,
          color: sun < 0.25 ? P.steel : i % 4 ? P.white : P.mist,
        };
      }
    }
  }
}
