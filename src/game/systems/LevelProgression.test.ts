import { describe, expect, it } from 'vitest';
import { TOOLS } from '../config/balance';
import {
  LEVEL_REWARD,
  MAX_LEVEL,
  XP,
  xpForLevel,
  xpToNext,
} from '../config/gear';
import { createInitialTerrain, geologyOf } from '../world/Geology';
import { Block, oreBlock, TerrainGrid } from '../world/TerrainGrid';
import { GameSession } from './GameSession';
import { MiningSystem } from './MiningSystem';
import { decodeSave, encodeSave } from './SaveSystem';

const fresh = () => new GameSession(createInitialTerrain());
const point = { x: 208, y: 148 };

describe('Experiencia y recompensas de nivel', () => {
  it.each(Object.entries(XP.ore))(
    'otorga la XP de %s solo al extraer un bloque real',
    (mineral, xp) => {
      const grid = new TerrainGrid();
      const s = new GameSession(grid);
      const mining = new MiningSystem(grid);
      const cell = { column: 10, row: 5 };
      grid.set(10, 5, oreBlock(mineral as keyof typeof XP.ore));
      s.tools.add('tungsten');
      const origin = { x: 10 * 16 + 8, y: 5 * 16 - 8 };
      expect(s.mine(mining, origin, cell)).toBe(true);
      expect(s.progression.xp).toBe(xp);
      expect(s.mine(mining, origin, cell)).toBe(false);
      expect(s.progression.xp).toBe(xp);
    },
  );

  it('premia cada yacimiento y cada anclaje de sostenimiento una sola vez', () => {
    const s = fresh();
    const deposit = geologyOf(s.seed).deposits.find((d) => d.cells.length > 1)!;
    const [[x, y], [nx, ny]] = deposit.cells as [
      [number, number],
      [number, number],
      ...[number, number][],
    ];
    s.rewardExtraction({ column: x, row: y }, deposit.mineral);
    s.rewardExtraction({ column: nx, row: ny }, deposit.mineral);
    expect(s.progression.xp).toBe(XP.ore[deposit.mineral] * 2 + XP.discovery);
    const before = s.progression.xp;
    s.gainXp(XP.support, 'support:15,10:wood');
    s.gainXp(XP.support, 'support:15,10:steel');
    expect(s.progression.xp - before).toBe(5);
  });

  it('paga todos los niveles, conserva excedente y acelera el trabajo', () => {
    const s = fresh();
    s.tools.add('iron');
    const row = 15;
    const cell = { column: s.grid.cells[row]!.indexOf(Block.Rock), row };
    expect(cell.column).toBeGreaterThanOrEqual(0);
    const before = s.money;
    expect(s.workMs(cell)).toBe(TOOLS.iron.workMs);
    expect(s.gainXp(xpToNext(1) - 1)).toBe(0);
    expect(s.gainXp(xpToNext(2) + 12)).toBe(2);
    expect(s.progression.level).toBe(3);
    expect(s.progression.xpInLevel).toBe(11);
    expect(s.money).toBe(before + 50);
    expect(s.progression.miningSpeedPoints).toBe(2);
    expect(s.workMs(cell)).toBe(Math.round(TOOLS.iron.workMs / 1.04));
    expect(s.loadout.unlocked).toBe(24);
    const restored = decodeSave(encodeSave(s, point))!.session;
    expect(restored.money).toBe(before + 50);
    expect(restored.levelEvents).toHaveLength(0);
    expect(restored.progression.xpNeeded).toBe(xpToNext(3));
    expect(restored.progression.xpInLevel).toBe(11);
    expect(restored.progression.miningSpeedPoints).toBe(2);
    expect(restored.workMs(cell)).toBe(Math.round(TOOLS.iron.workMs / 1.04));
    expect(restored.loadout.unlocked).toBe(24);
    restored.gainXp(xpForLevel(MAX_LEVEL));
    expect(restored.progression.level).toBe(MAX_LEVEL);
    expect(restored.progression.workTimeFactor).toBe(
      LEVEL_REWARD.minTimeFactor,
    );
    const maxMoney = restored.money;
    restored.gainXp(1000);
    expect(restored.money).toBe(maxMoney);
  });

  it('migra el avance de un guardado antiguo sin conceder premios retroactivos', () => {
    const s = fresh();
    const old = JSON.parse(encodeSave(s, point));
    old.v4.xp = 180; // Nivel 3 antiguo y 60 de 120 XP hacia el nivel 4.
    delete old.v4.xpCurve;
    old.v4.rewarded = ['support:15,10:wood'];
    const migrated = decodeSave(JSON.stringify(old))!.session;
    expect(migrated.progression.level).toBe(3);
    expect(migrated.progression.xpInLevel).toBe(Math.floor(xpToNext(3) / 2));
    expect(migrated.money).toBe(s.money);
    expect(migrated.loadout.unlocked).toBe(24);
    expect(migrated.progression.miningSpeedPoints).toBe(2);
    const xp = migrated.progression.xp;
    migrated.gainXp(XP.support, 'support:15,10:steel');
    expect(migrated.progression.xp).toBe(xp);
    expect(
      decodeSave(encodeSave(migrated, point))!.session.progression.xp,
    ).toBe(xp);
  });
});
