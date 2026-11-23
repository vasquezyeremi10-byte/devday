import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import { surfaceRow, TUNNEL, type Cell } from './TerrainGrid';
import { CART } from '../config/cart';
import { createFloraParts, swaysInBreeze, type FloraPart } from './structures/Flora';
import type { DayNightCycle } from '../systems/DayNightCycle';
import { createCartParts } from './structures/MineCart';
import {
  createMineEntrance,
  createMineParts,
  LANTERN,
} from './structures/MineEntrance';
import { createWarehouse, createWarehouseParts } from './structures/Warehouse';
import { biomeDecor } from './BiomeDecor';

type Prop = 'crate' | 'barrel' | 'barrel_band';

/** V9: decoración generada de los monolitos y de los biomas del este. */
const DECOR = biomeDecor();

/** Plantas fijas del campamento y sus alrededores, ancladas a una celda. */
const TALL_PLANTS: readonly (readonly [FloraPart, number, number])[] = [
  ['brea', 1, -2],
  ['cachiyuyo', 29, 2],
  ['cojin_atacameno', 40, 4],
  ['cachiyuyo', 52, 6],
  ['brea', 66, 0],
  ['cachiyuyo', 75, 0],
  ['cachiyuyo', -38, 0],
  ['brea', -34, 4],
  ['copao_joven', -40, 6],
  ['cachiyuyo', 84, 2],
  ['cojin_atacameno', 92, 0],
  ['brea', 99, 4],
  ['cachiyuyo', 120, 6],
  ['cojin_atacameno', 125, 0],
  ['cachiyuyo', 136, 2],
  ...DECOR.trees,
];
const PLANTS: readonly (readonly [FloraPart, number, number])[] = [
  ['grama_salada', 2, 4],
  ['cachiyuyo', 8, 2],
  ['grama_salada', 16, 0],
  ['brea', 19, 4],
  ['cojin_atacameno', 24, 6],
  ['cachiyuyo', 30, 0],
  ['grama_salada', 34, 3],
  ['cojin_atacameno', 39, 1],
  ['grama_salada', 45, 5],
  ['cachiyuyo', 54, 0],
  ['grama_salada', 60, 3],
  ['brea', 67, 9],
  ['grama_salada', 73, 1],
  ['cachiyuyo', 77, 6],
  ['grama_salada', -39, 2],
  ['cachiyuyo', -36, 0],
  ['grama_salada', -32, 6],
  ['brea', -13, 2],
  ['grama_salada', -7, 4],
  ['grama_salada', 82, 3],
  ['cachiyuyo', 87, 0],
  ['grama_salada', 90, 6],
  ['cojin_atacameno', 97, 2],
  ['grama_salada', 101, 0],
  ['cachiyuyo', 108, 4],
  ['grama_salada', 113, 1],
  ['brea', 118, 6],
  ['grama_salada', 123, 3],
  ['cachiyuyo', 129, 0],
  ['grama_salada', 134, 5],
  ['brea', 138, 0],
  ...DECOR.plants,
];
const ROCKS: readonly (readonly [FloraPart, number, number])[] = [
  ['desert_rock_small', 22, 2],
  ['desert_rock_large', 27, 0],
  ['desert_rock_small', 36, 6],
  ['desert_rock_small', 43, 9],
  ['desert_rock_large', 55, 2],
  ['desert_rock_small', 61, 0],
  ['desert_rock_large', 70, 6],
  ['desert_rock_large', -37, 6],
  ['desert_rock_small', -31, 2],
  ['desert_rock_large', 89, 0],
  ['desert_rock_small', 95, 6],
  ['desert_rock_large', 106, 2],
  ['desert_rock_small', 117, 0],
  ['desert_rock_large', 126, 4],
  ['desert_rock_small', 131, 6],
  ...DECOR.rocks,
];

/**
 * Fuente de luz del escenario. `decor`: farol con emisión mínima
 * (LIGHTING.decorLamp). `torch`: antorcha encendida, 5 × 5 bloques (LAMPS.torch). `industrial`:
 * reservada para lámparas que el jugador podrá comprar e instalar; aún no hay
 * electrificación ni compra, así que ninguna fuente usa ese tipo todavía.
 */
export interface LightSource {
  x: number;
  y: number;
  /** Radio del halo nocturno previsto (px); la emisión real la limita LIGHTING. */
  radius: number;
  kind: 'decor' | 'torch' | 'industrial';
  nightOnly?: boolean;
  /** Titileo sutil (farol de la cabaña, ventanas habitadas). */
  flicker?: boolean;
}

/**
 * Escenografía sin colisión: bodega, bocamina, utilería importada (Kenney y
 * Minery, CC0), vegetación y sombras. Lo que depende del juego reacciona al
 * estado real: el carro muestra carga y lo apoyado en un bloque desaparece
 * cuando ese bloque se excava.
 */
export class Scenery {
  private readonly anchored = new Map<
    string,
    Phaser.GameObjects.GameObject[]
  >();
  readonly cart: Phaser.GameObjects.Image;
  /** Luces de la escena; LightingSystem las usa con emisión mínima. */
  readonly lights: LightSource[] = [];
  /** V7: plantas con cuadro de brisa y sombras que siguen al sol. */
  private readonly swaying: {
    image: Phaser.GameObjects.Image;
    name: FloraPart;
    phase: number;
  }[] = [];
  private readonly shadows: { image: Phaser.GameObjects.Image; x: number }[] =
    [];

  constructor(
    private readonly scene: Phaser.Scene,
    wideEntrance = false,
  ) {
    createWarehouseParts(scene);
    createMineParts(scene);
    createFloraParts(scene);
    const ground = (column: number) => surfaceRow(column) * TILE_SIZE;
    const cellOf = (column: number): Cell => ({
      column,
      row: surfaceRow(column),
    });
    const flora = (
      name: FloraPart,
      column: number,
      dx: number,
      depth: number,
    ) => {
      const image = this.scene.add
        .image(column * TILE_SIZE + dx, ground(column), 'flora', name)
        .setOrigin(0, 1)
        .setDepth(depth);
      // Centrado en la celda + desplazamiento, siempre en píxel entero.
      image.setX(column * TILE_SIZE + 8 + dx - Math.floor(image.width / 2));
      this.anchor(cellOf(column), image);
      if (swaysInBreeze(name))
        this.swaying.push({ image, name, phase: (column * 7 + dx) % 11 });
    };
    for (const [name, column, dx] of TALL_PLANTS) {
      const shadow = this.shadow(
        name === 'copao' ? 'shadow_wide' : 'shadow_small',
        column * TILE_SIZE + 8 + dx + 3,
        ground(column),
        cellOf(column),
      );
      this.shadows.push({ image: shadow, x: shadow.x });
      flora(name, column, dx, DEPTH.structures - 4);
    }
    for (const [name, column, dx] of ROCKS)
      flora(name, column, dx, DEPTH.structures - 2);
    for (const [name, column, dx] of PLANTS)
      flora(name, column, dx, DEPTH.structures - 1);

    // Bodega nivel 1 y suministros a su lado.
    createWarehouse(scene, 56, 160, 1);
    this.lights.push({ x: 121, y: 135, radius: 18, kind: 'decor' });
    this.lights.push({
      x: 73,
      y: 142,
      radius: 26,
      kind: 'decor',
      nightOnly: true,
    });
    this.prop('crate', 129, 160);
    this.prop('crate', 129, 144);
    this.prop('barrel', 141, 160);
    // Caja del carro artesanal; LogisticsView proyecta posición, ruedas y carga real.
    createCartParts(scene);
    this.cart = scene.add
      .image(0, CART.bodyTop, 'cart', 'cart_body')
      .setOrigin(0, 0)
      .setDepth(DEPTH.machines);

    createMineEntrance(
      scene,
      (cell, item) => this.anchor(cell, item),
      wideEntrance,
    );
    const gx = TUNNEL.fromColumn * TILE_SIZE;
    const gy = TUNNEL.topRow * TILE_SIZE;
    const floor = (TUNNEL.bottomRow + 1) * TILE_SIZE;
    this.lights.push({ x: gx + 17, y: gy + 9, radius: 19, kind: 'decor' });
    this.lights.push({ ...LANTERN, radius: 16, kind: 'decor' });
    this.torches([gx + 52, gx + 88], floor);
  }

  /** Liga un objeto a un bloque excavable: se destruye junto con él. */
  anchor({ column, row }: Cell, item: Phaser.GameObjects.GameObject): void {
    const key = `${column},${row}`;
    this.anchored.set(key, [...(this.anchored.get(key) ?? []), item]);
  }

  /** Imagen anclada al suelo por su borde inferior, en píxeles enteros. */
  private prop(
    name: Prop,
    x: number,
    groundY: number,
    anchor?: Cell,
    depth: number = DEPTH.structures,
  ): Phaser.GameObjects.Image {
    const image = this.scene.add
      .image(0, 0, 'props', name)
      .setOrigin(0, 1)
      .setDepth(depth);
    image.setPosition(x - Math.floor(image.width / 2), groundY);
    if (anchor) this.anchor(anchor, image);
    return image;
  }

  /** Sombra de tablero sobre el pasto, centrada en x. */
  private shadow(
    name: 'shadow_wide' | 'shadow_small',
    x: number,
    groundY: number,
    anchor?: Cell,
  ): Phaser.GameObjects.Image {
    const image = this.scene.add
      .image(0, groundY, 'warehouse', name)
      .setOrigin(0, 0)
      .setDepth(DEPTH.terrain + 3);
    image.setX(x - Math.floor(image.width / 2));
    if (anchor) this.anchor(anchor, image);
    return image;
  }

  /**
   * V7: brisa y sol. Los arbustos alternan un cuadro inclinado con ráfagas
   * desfasadas; las sombras de la flora se corren al lado opuesto del sol
   * (píxeles enteros) y desaparecen de noche. Solo es apariencia.
   */
  ambient(day: DayNightCycle, now: number, active: boolean): void {
    if (!active) return;
    const gust = Math.floor(now / 650);
    // De noche la brisa se calma: los arbustos quedan quietos.
    const breeze = day.sunStrength > 0.3;
    for (const s of this.swaying) {
      if (!s.image.active) continue;
      const lean = breeze && (gust + s.phase) % 5 < 2;
      s.image.setFrame(lean ? `${s.name}_w` : s.name);
    }
    const sun = day.sun;
    const offset = Math.max(-3, Math.min(3, Math.round((240 - sun.x) / 70)));
    const visible = sun.visible && day.sunStrength > 0.2;
    for (const s of this.shadows) {
      if (!s.image.active) continue;
      s.image.setVisible(visible).setX(s.x + offset);
    }
  }

  /** Antorchas animadas en los marcos interiores de la galería. */
  private torches(xs: number[], floor: number): void {
    if (!this.scene.anims.exists('torch-burn'))
      this.scene.anims.create({
        key: 'torch-burn',
        frames: this.scene.anims.generateFrameNumbers('torch', {
          start: 0,
          end: 3,
        }),
        frameRate: 8,
        repeat: -1,
      });
    xs.forEach((x, i) => {
      this.scene.add
        .sprite(x, floor - 32, 'torch', i % 4)
        .setOrigin(0, 0)
        .setDepth(DEPTH.structures + 1)
        .play({ key: 'torch-burn', startFrame: i % 4 });
      // Antorcha encendida: ilumina 5 × 5 bloques como las que se compran.
      this.lights.push({ x: x + 4, y: floor - 24, radius: 40, kind: 'torch' });
    });
  }

  /** La decoración apoyada en un bloque desaparece cuando ese bloque se excava. */
  cellRemoved({ column, row }: Cell): void {
    const key = `${column},${row}`;
    this.anchored.get(key)?.forEach((item) => item.destroy());
    this.anchored.delete(key);
  }
}
