import { describe, expect, it } from 'vitest';
import { BALANCE, SUPPLIES, TOOLS } from '../config/balance';
import {
  BUILD_MATERIAL_KEYS,
  isBuildMaterial,
  materialOfBlock,
  STACK_MAX,
  TREE,
} from '../config/buildMaterials';
import { createInitialTerrain } from '../world/Geology';
import { Block, TerrainGrid, surfaceRow } from '../world/TerrainGrid';
import { TREE_COLUMNS, TreeState, treeGround } from '../world/Trees';
import {
  terrainFrame,
  TerrainFrame,
  TERRAIN_FRAME_COUNT,
} from '../world/TerrainVisuals';
import { placementProblem } from './BlockPlacement';
import { GameSession } from './GameSession';
import { MiningSystem } from './MiningSystem';
import { decodeSave, encodeSave } from './SaveSystem';

const player = { x: 208, y: 148 };

/** Sesión con picota y pala, lista para excavar y construir. */
function setup() {
  const s = new GameSession(createInitialTerrain());
  const mining = new MiningSystem(s.grid);
  s.tools.add('shovel');
  s.tools.add('iron');
  return { s, mining };
}

/** Desde el aire sobre la celda: dentro del alcance y sin tapar el tiro. */
const above = (column: number, row: number) => ({
  x: column * 16 + 8,
  y: (row - 1) * 16 + 8,
});
const cell = (column: number, row: number) => ({ column, row });

describe('Materiales de construcción', () => {
  it('son tres, modulares y apilables como suministros', () => {
    expect(BUILD_MATERIAL_KEYS).toEqual(['mat_dirt', 'mat_stone', 'mat_wood']);
    for (const k of BUILD_MATERIAL_KEYS) {
      expect(isBuildMaterial(k)).toBe(true);
      expect(SUPPLIES[k].category).toBe('MATERIALES');
    }
    expect(isBuildMaterial('rail')).toBe(false);
    expect(materialOfBlock(Block.Dirt)).toBe('mat_dirt');
    expect(materialOfBlock(Block.Rock)).toBe('mat_stone');
    expect(materialOfBlock(Block.Wood)).toBe('mat_wood');
    expect(materialOfBlock(Block.Coal)).toBeNull();
  });

  it('el bloque de madera tiene su tile dentro del atlas y es sólido', () => {
    const g = new TerrainGrid(8, 8);
    g.set(3, 3, Block.Wood);
    const frame = terrainFrame(g, 3, 3, () => false);
    expect(frame).toBe(TerrainFrame.Wood);
    expect(frame).toBeLessThan(TERRAIN_FRAME_COUNT);
    expect(g.isSolid(3, 3)).toBe(true);
  });
});

describe('Excavar y recoger', () => {
  it('10 bloques de tierra se acumulan sin llenar la carga minera', () => {
    const { s, mining } = setup();
    for (let c = 70; c < 80; c++) {
      expect(s.mine(mining, above(c, 10), cell(c, 10))).toBe(true);
    }
    expect(s.supplies.mat_dirt).toBe(10);
    expect(s.inventory.items).toEqual([]);
    expect(s.stats.mined).toBe(10);
  });

  it('la roca rinde piedra y las menas siguen a la carga minera', () => {
    const { s, mining } = setup();
    s.grid.set(60, 10, Block.Rock);
    s.grid.set(61, 10, Block.Coal);
    expect(s.mine(mining, above(60, 10), cell(60, 10))).toBe(true);
    expect(s.mine(mining, above(61, 10), cell(61, 10))).toBe(true);
    expect(s.supplies.mat_stone).toBe(1);
    expect(s.inventory.items).toEqual(['coal']);
  });

  it('añadir material respeta el máximo apilable y ocupa la barra rápida', () => {
    const { s } = setup();
    expect(s.addMaterial('mat_dirt', STACK_MAX + 50)).toBe(STACK_MAX);
    expect(s.addMaterial('mat_dirt')).toBe(0);
    expect(s.supplies.mat_dirt).toBe(STACK_MAX);
    expect(s.loadout.quickbar.filter((q) => q?.type === 'supply')).toEqual([
      { type: 'supply', kind: 'mat_dirt' },
    ]);
    // Sin lugar para más: no se mina más (el bloque se queda donde está).
    const mining = new MiningSystem(s.grid);
    expect(s.mine(mining, above(70, 10), cell(70, 10))).toBe(false);
    expect(s.grid.get(70, 10)).toBe(Block.Dirt);
  });
});

describe('Colocar bloques', () => {
  it('consume una unidad, se ancla a la celda y tiene colisión (sólido)', () => {
    const { s } = setup();
    s.addMaterial('mat_dirt', 3);
    const c = cell(60, 9);
    expect(s.placeBlock(c, 'mat_dirt', above(60, 9), [])).toBeNull();
    expect(s.grid.get(60, 9)).toBe(Block.Dirt);
    expect(s.grid.isSolid(60, 9)).toBe(true);
    expect(s.supplies.mat_dirt).toBe(2);
    expect(s.isPlaced(c)).toBe(true);
    // Una celda ya ocupada no admite otro bloque (sin duplicar ni gastar).
    expect(s.placeBlock(c, 'mat_dirt', above(60, 9), [])).toBe(
      'ESA CELDA YA ESTA OCUPADA',
    );
    expect(s.supplies.mat_dirt).toBe(2);
  });

  it('no coloca sin material, lejos, flotando ni sobre entidades', () => {
    const { s } = setup();
    expect(s.placeBlock(cell(60, 9), 'mat_dirt', above(60, 9), [])).toBe(
      'SIN TIERRA',
    );
    s.addMaterial('mat_dirt', 5);
    expect(s.placeBlock(cell(60, 9), 'mat_dirt', { x: 400, y: 100 }, [])).toBe(
      'DEMASIADO LEJOS',
    );
    // Flotando: ningún bloque vecino.
    expect(s.placeBlock(cell(60, 6), 'mat_dirt', above(60, 7), [])).toMatch(
      /NECESITA APOYO/,
    );
    // Sobre el jugador o el carro.
    const body = { x: 60 * 16 + 3, y: 9 * 16 - 2, w: 10, h: 18 };
    expect(s.placeBlock(cell(60, 9), 'mat_dirt', above(60, 9), [body])).toBe(
      'HAY ALGUIEN EN ESA CELDA',
    );
    expect(s.supplies.mat_dirt).toBe(5);
    expect(s.grid.get(60, 9)).toBe(Block.Air);
  });

  it('se construye donde sea (sin zonas protegidas) salvo sobre objetos instalados', () => {
    const { s } = setup();
    s.addMaterial('mat_stone', 5);
    // Junto a la bodega y en la boca de la mina también se puede.
    expect(s.placeBlock(cell(8, 9), 'mat_stone', above(8, 9), [])).toBeNull();
    expect(s.placeBlock(cell(21, 7), 'mat_stone', above(21, 7), [])).toBeNull();
    s.addMaterial('mat_stone', 2);
    // Una antorcha instalada ocupa su celda.
    expect(s.lights.install(s.grid, cell(65, 9), 'torch')).toBe(true);
    expect(placementProblem(s, cell(65, 9), above(65, 9), [])).toBe(
      'HAY UN OBJETO INSTALADO AQUI',
    );
    expect(s.supplies.mat_stone).toBe(5);
  });

  it('no se puede colocar sobre el tronco de un árbol en pie', () => {
    const { s } = setup();
    s.addMaterial('mat_wood', 2);
    const g = treeGround(0);
    const above1 = cell(g.column, g.row - 1);
    expect(
      s.placeBlock(above1, 'mat_wood', above(g.column, g.row - 1), []),
    ).toBe('HAY UN ARBOL AQUI');
    s.trees.uproot(0);
    expect(
      s.placeBlock(above1, 'mat_wood', above(g.column, g.row - 1), []),
    ).toBeNull();
  });
});

describe('Construcciones', () => {
  /** Escalera de 4 escalones con 10 bloques de tierra (1+2+3+4). */
  function stairs(s: GameSession) {
    for (let k = 1; k <= 4; k++)
      for (let h = 1; h <= k; h++) {
        const c = cell(50 + k, 10 - h);
        expect(
          s.placeBlock(
            c,
            'mat_dirt',
            { x: c.column * 16 - 8, y: c.row * 16 + 8 },
            [],
          ),
        ).toBeNull();
      }
  }

  it('excavar 10, construir una escalera y subirla sin atravesarla', () => {
    const { s, mining } = setup();
    for (let c = 70; c < 80; c++) s.mine(mining, above(c, 10), cell(c, 10));
    expect(s.supplies.mat_dirt).toBe(10);
    stairs(s);
    expect(s.supplies.mat_dirt).toBe(0);
    // Cada escalón sube un bloque respecto del anterior: la altura libre sobre
    // cada columna es la del peldaño, así que se puede saltar de uno a otro.
    const top = (c: number) => {
      let r = 0;
      while (!s.grid.isSolid(c, r)) r++;
      return r;
    };
    expect([51, 52, 53, 54].map(top)).toEqual([9, 8, 7, 6]);
    for (let c = 51; c <= 54; c++) {
      // Sólido de arriba abajo: nada se atraviesa.
      for (let r = top(c); r <= 10; r++)
        expect(s.grid.isSolid(c, r)).toBe(true);
    }
  });

  it('una pequeña casa de tierra, piedra y madera; se desarma y devuelve todo', () => {
    const { s, mining } = setup();
    s.addMaterial('mat_dirt', 20);
    s.addMaterial('mat_stone', 20);
    s.addMaterial('mat_wood', 20);
    const total = () =>
      s.supplies.mat_dirt + s.supplies.mat_stone + s.supplies.mat_wood;
    expect(total()).toBe(60);
    // Casa de 5 × 4: paredes de tierra y piedra, techo de madera.
    const left = 81,
      right = 85,
      floor = 10;
    const build: [number, number, 'mat_dirt' | 'mat_stone' | 'mat_wood'][] = [];
    for (const r of [9, 8, 7]) {
      build.push([left, r, 'mat_dirt'], [right, r, 'mat_stone']);
    }
    for (let c = left; c <= right; c++) build.push([c, 6, 'mat_wood']);
    expect(floor).toBe(surfaceRow(left));
    for (const [c, r, kind] of build)
      expect(
        s.placeBlock(
          cell(c, r),
          kind,
          { x: c * 16 + 8, y: (r + 1) * 16 - 8 },
          [],
        ),
      ).toBeNull();
    expect(build).toHaveLength(11);
    expect(total()).toBe(60 - 11);
    expect(s.placed.size).toBe(11);
    const tool = s.tools.current!;
    const wear = tool.durability;
    // Desarmar (techo y luego paredes): cada bloque devuelve exactamente su
    // material, sin desgaste de la herramienta.
    for (const [c, r] of [...build].reverse()) {
      const side = c === left ? -1 : 1;
      const from =
        r === 6
          ? { x: c * 16 + 8, y: 5 * 16 + 8 }
          : { x: (c + side) * 16 + 8, y: r * 16 + 8 };
      expect(s.mine(mining, from, cell(c, r))).toBe(true);
    }
    expect(total()).toBe(60);
    expect(s.placed.size).toBe(0);
    expect(tool.durability).toBe(wear);
    expect(s.stats.mined).toBe(0);
  });

  it('colocar y retirar muchas veces no genera recursos ni experiencia', () => {
    const { s, mining } = setup();
    s.addMaterial('mat_stone', 1);
    const xp = s.progression.xp;
    for (let i = 0; i < 40; i++) {
      expect(
        s.placeBlock(cell(65, 9), 'mat_stone', above(65, 9), []),
      ).toBeNull();
      expect(s.supplies.mat_stone).toBe(0);
      expect(s.mine(mining, above(65, 9), cell(65, 9))).toBe(true);
      expect(s.supplies.mat_stone).toBe(1);
    }
    expect(s.progression.xp).toBe(xp);
    expect(s.stats.mined).toBe(0);
  });

  it('retirar un bloque colocado es rápido y no gasta la herramienta', () => {
    const { s } = setup();
    s.addMaterial('mat_dirt', 1);
    s.placeBlock(cell(65, 9), 'mat_dirt', above(65, 9), []);
    expect(s.workMs(cell(65, 9))).toBeLessThan(TOOLS.iron.workMs);
    expect(s.workMs(cell(65, 9))).toBe(
      Math.round(TOOLS.iron.workMs * 0.25 * s.progression.workTimeFactor),
    );
    // Un bloque natural sigue costando su tiempo completo.
    expect(s.workMs(cell(65, 10))).toBe(
      Math.round(TOOLS.iron.workMs * s.progression.workTimeFactor),
    );
  });

  it('la madera se desarma con hacha, pala o picota; el hacha no rompe roca', () => {
    const { s } = setup();
    s.tools.add('axe');
    expect(s.toolProblem(Block.Wood)).toBeNull();
    expect(s.toolProblem(Block.Rock)).toMatch(/HACHA/);
    expect(s.toolProblem(Block.Dirt)).toMatch(/HACHA/);
    s.tools.equipped = s.tools.items.find((t) => t.kind === 'iron')!.id;
    expect(s.toolProblem(Block.Wood)).toBeNull();
    expect(TOOLS.axe.price).toBeGreaterThan(0);
    expect(BALANCE.initialMoney).toBeGreaterThanOrEqual(TOOLS.axe.price);
  });
});

describe('Árboles', () => {
  it('caen tras los hachazos exactos, rinden madera una sola vez', () => {
    const t = new TreeState();
    expect(t.standing(0)).toBe(true);
    for (let i = 1; i < TREE.hp; i++) {
      const r = t.hit(0);
      expect(r).toMatchObject({ fell: false, wood: 0, hits: i });
    }
    expect(t.hit(0)).toMatchObject({ fell: true, wood: TREE.wood });
    expect(t.standing(0)).toBe(false);
    // Un árbol ya talado no vuelve a dar madera ni a recibir golpes.
    expect(t.hit(0)).toEqual({ fell: false, wood: 0, hits: 0 });
    expect(t.trunkAt(treeGround(0))).toBe(-1);
  });

  it('están en terreno llano de la superficie ', () => {
    expect(new Set(TREE_COLUMNS).size).toBe(TREE_COLUMNS.length);
    for (const c of TREE_COLUMNS) {
      expect(surfaceRow(c - 1)).toBe(surfaceRow(c));
      expect(surfaceRow(c + 1)).toBe(surfaceRow(c));
    }
  });

  it('un árbol sin suelo se arranca sin dar madera', () => {
    const t = new TreeState();
    expect(t.uproot(2)).toBe(true);
    expect(t.uproot(2)).toBe(false);
    expect(t.standing(2)).toBe(false);
  });
});

describe('Guardado de la construcción', () => {
  it('conserva bloques colocados, excavados, árboles, cantidades y posición', () => {
    const { s, mining } = setup();
    for (let c = 70; c < 78; c++) s.mine(mining, above(c, 10), cell(c, 10));
    s.addMaterial('mat_stone', 6);
    s.addMaterial('mat_wood', TREE.wood);
    s.trees.hit(1);
    for (let i = 1; i < TREE.hp; i++) s.trees.hit(1);
    expect(s.trees.standing(1)).toBe(false);
    s.placeBlock(cell(60, 9), 'mat_stone', above(60, 9), []);
    s.placeBlock(cell(60, 8), 'mat_wood', above(60, 8), []);
    s.placeBlock(cell(61, 9), 'mat_dirt', above(61, 9), []);
    s.placeBlock(cell(63, 9), 'mat_stone', above(63, 9), []);
    const raw = encodeSave(s, { x: 123, y: 99 });
    const r = decodeSave(raw)!;
    expect(r).not.toBeNull();
    expect(r.player).toEqual({ x: 123, y: 99 });
    const t = r.session;
    expect(t.grid.get(60, 9)).toBe(Block.Rock);
    expect(t.grid.get(60, 8)).toBe(Block.Wood);
    expect(t.grid.get(61, 9)).toBe(Block.Dirt);
    // Lo excavado sigue excavado.
    for (let c = 70; c < 78; c++) expect(t.grid.get(c, 10)).toBe(Block.Air);
    expect([...t.placed].sort()).toEqual([...s.placed].sort());
    expect(t.supplies.mat_dirt).toBe(s.supplies.mat_dirt);
    expect(t.supplies.mat_stone).toBe(s.supplies.mat_stone);
    expect(t.supplies.mat_wood).toBe(s.supplies.mat_wood);
    expect(t.trees.standing(1)).toBe(false);
    expect(t.trees.standing(0)).toBe(true);
    // Idempotente: guardar lo cargado da el mismo guardado.
    expect(encodeSave(t, r.player)).toBe(raw);
  });

  it('un bloque colocado sin declararlo no se acepta (no se crean bloques al cargar)', () => {
    const { s } = setup();
    s.addMaterial('mat_stone', 1);
    s.placeBlock(cell(60, 9), 'mat_stone', above(60, 9), []);
    const data = JSON.parse(encodeSave(s, player));
    data.build.placed = [];
    expect(decodeSave(JSON.stringify(data))).toBeNull();
    // Una mena colocada tampoco.
    const g = JSON.parse(encodeSave(s, player));
    g.terrain.push([9 * 140 + 61, Block.Diamond]);
    expect(decodeSave(JSON.stringify(g))).toBeNull();
  });

  it('una partida anterior a la construcción carga sin bloques ni árboles talados', () => {
    const { s } = setup();
    const data = JSON.parse(encodeSave(s, player));
    delete data.build;
    const r = decodeSave(JSON.stringify(data))!;
    expect(r.session.placed.size).toBe(0);
    expect(r.session.trees.felled.size).toBe(0);
  });
});

describe('Barra rápida y herramienta en mano', () => {
  it('elegir un material conserva la herramienta; elegir otra no lo pierde de la barra', () => {
    const { s } = setup();
    const pick = s.tools.current!;
    s.addMaterial('mat_dirt', 4);
    const l = s.loadout;
    l.assignQuick(1, { type: 'tool', id: pick.id });
    const slot = l.quickbar.findIndex(
      (q) => q?.type === 'supply' && q.kind === 'mat_dirt',
    );
    expect(slot).toBeGreaterThanOrEqual(0);
    l.selectQuick(slot);
    expect(s.tools.current).toBe(pick);
    l.syncQuick();
    expect(l.selectedQuick).toBe(slot);
    // Gastar todo el material no mueve su casilla.
    s.supplies.mat_dirt = 0;
    l.sync();
    expect(l.quickbar[slot]).toEqual({ type: 'supply', kind: 'mat_dirt' });
    expect(l.describe({ type: 'supply', kind: 'mat_dirt' })[1]).toMatch(
      /MATERIAL X0/,
    );
  });

  it('la barra tiene nueve casillas', () => {
    const { s } = setup();
    expect(s.loadout.quickbar).toHaveLength(9);
    expect(s.loadout.assignQuick(8, { type: 'supply', kind: 'rail' })).toBe(
      'OBJETO NO DISPONIBLE',
    );
    s.supplies.rail = 1;
    expect(
      s.loadout.assignQuick(8, { type: 'supply', kind: 'rail' }),
    ).toBeNull();
    expect(s.loadout.assignQuick(9, { type: 'supply', kind: 'rail' })).toBe(
      'RANURA INVALIDA',
    );
  });
});
