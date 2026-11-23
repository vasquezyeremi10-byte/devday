import { describe, expect, it } from 'vitest';
import { SPAWN } from '../config/constants';
import {
  createInitialTerrain,
  DEFAULT_SEED,
  pristineTerrain,
  WORLD_REV_EXPLORE,
  WORLD_REV_LEGACY,
} from '../world/Geology';
import { Block } from '../world/TerrainGrid';
import { GameSession } from './GameSession';
import { decodeSave, encodeSave } from './SaveSystem';

/**
 * Caracterización del formato de guardado (auditoría del 16 de noviembre de
 * 2026). Estas pruebas no describen una regla del juego: fijan, byte a byte,
 * lo que `encodeSave` escribe hoy para una partida determinista. Si una
 * refactorización cambia una sola letra del guardado, fallan.
 *
 * La huella se calculó con el código anterior a la auditoría. Solo debe
 * actualizarse cuando el formato cambie a propósito y con su migración.
 */
const fnv1a = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

/** Partida con excavación, escombro, construcción, bienes y progreso. */
function played(rev: number): GameSession {
  const s = new GameSession(
    createInitialTerrain(DEFAULT_SEED, rev),
    DEFAULT_SEED,
  );
  s.mode = 'normal';
  s.modeChosen = true;
  s.mineName = 'AUDITORIA';
  // Pozo excavado, un escombro y un bloque colocado por el jugador.
  for (let row = 10; row <= 14; row++) s.grid.set(60, row, Block.Air);
  s.grid.set(61, 12, Block.Air);
  s.grid.set(61, 13, Block.Rubble);
  s.grid.set(62, 9, Block.Wood);
  s.placed.add(s.grid.index(62, 9));
  for (let row = 10; row <= 14; row++) s.visibility.reveal(60, row);
  s.afterTerrainChange([{ column: 60, row: 12 }]);
  s.money = 1234;
  s.supplies.torch = 3;
  s.supplies.rail = 5;
  s.supplies.mat_wood = 17;
  s.tools.add('iron');
  s.tools.add('shovel');
  s.inventory.add('dirt');
  s.inventory.add('stone');
  s.cart.inventory.add('coal');
  s.gainXp(250, 'auditoria');
  s.stats.playMs = 98_765;
  s.stats.mined = 6;
  s.dayNight.restore(123_456, 723_456);
  s.loadout.sync();
  return s;
}

describe('Formato de guardado V6 (caracterización)', () => {
  // Huellas del mundo abierto (18 de noviembre de 2026): el guardado suma
  // `left` (borde oeste) y los índices y el mapa de descubrimiento empiezan
  // ahí. Las partidas anteriores (sin `left`) se leen con la columna 0.
  it.each([
    ['rev. 1 (mundo original)', WORLD_REV_LEGACY, 'fe528821'],
    ['rev. 2 (cavernas)', WORLD_REV_EXPLORE, 'b0b34680'],
  ])('escribe exactamente el mismo guardado: %s', (_name, rev, expected) => {
    const raw = encodeSave(played(rev), SPAWN);
    expect(fnv1a(raw)).toBe(expected);
  });

  it('guardar dos veces seguidas no cambia nada', () => {
    const s = played(WORLD_REV_EXPLORE);
    expect(encodeSave(s, SPAWN)).toBe(encodeSave(s, SPAWN));
  });

  it('cargar y volver a guardar reproduce el mismo guardado', () => {
    for (const rev of [WORLD_REV_LEGACY, WORLD_REV_EXPLORE]) {
      const raw = encodeSave(played(rev), SPAWN);
      const back = decodeSave(raw)!;
      expect(back).not.toBeNull();
      expect(encodeSave(back.session, back.player)).toBe(raw);
    }
  });

  it('guardar no modifica el terreno de la partida', () => {
    const s = played(WORLD_REV_EXPLORE);
    const before = s.grid.cells.map((row) => [...row]);
    encodeSave(s, SPAWN);
    expect(s.grid.cells).toEqual(before);
  });

  it('la referencia del terreno inicial es idéntica al mundo y no se puede alterar', () => {
    for (const rev of [WORLD_REV_LEGACY, WORLD_REV_EXPLORE]) {
      const fresh = createInitialTerrain(DEFAULT_SEED, rev);
      const reference = pristineTerrain(DEFAULT_SEED, rev);
      expect(reference.cells).toEqual(fresh.cells);
      expect(reference.worldRev).toBe(fresh.worldRev);
      // La misma referencia mientras no cambie la semilla ni la revisión.
      expect(pristineTerrain(DEFAULT_SEED, rev)).toBe(reference);
      expect(() => reference.set(60, 12, Block.Air)).toThrow();
      expect(reference.get(60, 12)).toBe(fresh.get(60, 12));
    }
    // Otra semilla: otra referencia, igual a su propio mundo.
    expect(pristineTerrain(7, WORLD_REV_EXPLORE).cells).toEqual(
      createInitialTerrain(7, WORLD_REV_EXPLORE).cells,
    );
  });

  it('las diferencias del terreno son solo las celdas cambiadas', () => {
    const s = played(WORLD_REV_LEGACY);
    const data = JSON.parse(encodeSave(s, SPAWN));
    const at = (column: number, row: number) => s.grid.index(column, row);
    const expected = [
      ...[10, 11, 12, 13, 14].map((row) => [at(60, row), Block.Air]),
      [at(61, 12), Block.Air],
      [at(61, 13), Block.Rubble],
      [at(62, 9), Block.Wood],
    ].sort((a, b) => a[0]! - b[0]!);
    // Mundo abierto: los índices empiezan en el borde oeste.
    expect(data.left).toBe(s.grid.first);
    expect(data.terrain).toEqual(expected);
  });
});
