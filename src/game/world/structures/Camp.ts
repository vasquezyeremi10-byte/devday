import Phaser from 'phaser';
import { DEPTH } from '../../config/layers';
import { PALETTE as P } from '../../config/palette';
import type { LightSource } from '../Scenery';
import { buildParts, type Part } from './PartsTexture';
import { pixelText } from '../../ui/PixelFont';

/**
 * Campamento minero V8 — zona de reunión a la izquierda de la bodega.
 * El pabellón de tablas fue sustituido por la cabaña minera animada
 * (world/structures/Cabin.ts, rediseño del 11 de noviembre de 2026); aquí
 * queda el resto del sector: bancas, mesa de carrete, brasero, faroles en
 * postes, estanque de agua, utilería y letrero de dirección.
 *
 * Luz desde arriba a la izquierda; contorno de tinta de 1 px; colores de la
 * paleta, alfa 0/255. Las llamas usan nombres de cuadro con «glow» para que
 * NightTint no las tiña.
 */
const CAMP_PARTS: Part[] = [
  {
    // Banca de tablón para la zona de reunión.
    name: 'cb_bench',
    w: 28,
    h: 10,
    draw(b) {
      b.rect(0, 0, 28, 4, P.ink);
      b.rect(1, 0, 26, 1, P.ochre);
      b.rect(1, 1, 26, 2, P.clay);
      b.px(6, 2, P.earth);
      b.px(19, 1, P.earth);
      for (const x of [3, 22]) {
        b.rect(x, 4, 3, 6, P.ink);
        b.rect(x + 1, 4, 1, 6, P.earth);
      }
    },
  },
  {
    // Mesa hecha con un carrete de cable reciclado.
    name: 'cb_reel',
    w: 26,
    h: 15,
    draw(b) {
      b.rect(0, 0, 26, 4, P.ink);
      b.rect(1, 0, 24, 1, P.ochre);
      b.rect(1, 1, 24, 2, P.loam);
      b.px(12, 1, P.earth);
      b.rect(8, 4, 10, 8, P.ink);
      b.rect(9, 4, 8, 8, P.earth);
      // Cable enrollado en el núcleo.
      for (let y = 5; y < 11; y += 2) b.rect(9, y, 8, 1, P.stone);
      b.rect(2, 12, 22, 3, P.ink);
      b.rect(3, 12, 20, 2, P.soil);
      b.rect(3, 12, 20, 1, P.clay);
    },
  },
  {
    // Termo y tazones sobre la mesa.
    name: 'cb_mugs',
    w: 14,
    h: 7,
    draw(b) {
      b.rect(0, 0, 4, 7, P.ink);
      b.rect(1, 1, 2, 6, P.red);
      b.px(1, 1, P.peach);
      for (const x of [6, 10]) {
        b.rect(x, 3, 4, 4, P.ink);
        b.rect(x + 1, 4, 2, 2, x === 6 ? P.white : P.sky);
      }
    },
  },
  {
    // Brasero: tambor de acero perforado.
    name: 'cb_brazier',
    w: 14,
    h: 14,
    draw(b) {
      b.rect(0, 0, 14, 14, P.ink);
      b.rect(1, 1, 12, 12, P.stone);
      b.rect(1, 1, 3, 12, P.steel);
      b.rect(1, 1, 12, 1, P.silver);
      b.rect(1, 6, 12, 1, P.slate);
      for (const [x, y] of [[4, 3], [8, 3], [6, 9], [10, 9]] as const)
        b.rect(x, y, 2, 2, P.ember);
      b.dither(9, 2, 4, 10, P.slate);
    },
  },
  ...[0, 1].map(
    (f): Part => ({
      // Llamas del brasero (no se tiñen de noche).
      name: `cb_glow_${f}`,
      w: 12,
      h: 9,
      draw(b) {
        const h = f ? [3, 6, 8, 5, 7, 4] : [5, 8, 4, 7, 5, 3];
        h.forEach((v, i) => {
          const x = 1 + i * 2;
          b.rect(x, 9 - v, 2, v, P.orange);
          b.rect(x, 9 - v + 1, 2, Math.max(0, v - 3), P.gold);
          if (v > 5) b.px(x, 9 - v + 2, P.cream);
        });
      },
    }),
  ),
  {
    // Poste de farol con brazo.
    name: 'cb_post',
    w: 12,
    h: 38,
    draw(b) {
      b.rect(2, 2, 4, 36, P.ink);
      b.rect(3, 2, 2, 36, P.earth);
      b.rect(3, 2, 1, 36, P.clay);
      b.rect(2, 2, 10, 3, P.ink);
      b.rect(3, 3, 8, 1, P.soil);
      b.rect(0, 34, 8, 4, P.ink);
      b.rect(1, 34, 6, 1, P.khaki);
    },
  },
  {
    // Estanque de agua sobre torre de madera.
    name: 'cb_tank',
    w: 28,
    h: 44,
    draw(b) {
      // Torre con riostras.
      for (const x of [2, 23]) {
        b.rect(x, 18, 3, 26, P.ink);
        b.rect(x + 1, 18, 1, 26, P.earth);
      }
      b.line(4, 22, 23, 40, P.umber);
      b.line(23, 22, 4, 40, P.umber);
      b.rect(1, 17, 26, 3, P.ink);
      b.rect(2, 17, 24, 1, P.clay);
      // Estanque cilíndrico de acero.
      b.rect(2, 2, 24, 15, P.ink);
      b.rect(3, 3, 22, 13, P.stone);
      b.rect(3, 3, 5, 13, P.silver);
      b.rect(8, 3, 4, 13, P.steel);
      b.rect(3, 7, 22, 1, P.slate);
      b.rect(3, 12, 22, 1, P.slate);
      b.rect(4, 0, 20, 3, P.ink);
      b.rect(5, 1, 18, 1, P.steel);
      // Llave de paso.
      b.rect(24, 14, 4, 2, P.ink);
      b.px(26, 16, P.blue);
    },
  },
  {
    // Letrero de dirección hacia las cabañas.
    name: 'cb_signpost',
    w: 70,
    h: 30,
    draw(b) {
      b.rect(33, 12, 4, 18, P.ink);
      b.rect(34, 12, 2, 18, P.earth);
      b.rect(34, 12, 1, 18, P.clay);
      // Tabla con punta de flecha a la izquierda.
      for (let y = 0; y < 13; y++) {
        const inset = Math.abs(y - 6);
        b.rect(inset, y, 70 - inset, 1, P.ink);
        if (y > 0 && y < 12) b.rect(inset + 1, y, 68 - inset, 1, y === 1 ? P.ochre : P.clay);
      }
      b.rect(8, 11, 61, 1, P.earth);
    },
  },
  {
    // Camino de acceso: tierra apisonada con gravilla sobre la costra.
    name: 'cb_path',
    w: 16,
    h: 3,
    draw(b) {
      b.rect(0, 0, 16, 2, P.desertSoil);
      b.rect(0, 2, 16, 1, P.desertMountain);
      for (const [x, y, c] of [
        [1, 0, P.khaki],
        [5, 1, P.sand],
        [9, 0, P.taupe],
        [12, 1, P.khaki],
        [14, 0, P.sand],
      ] as const)
        b.px(x, y, c);
    },
  },
];

export interface CampLayout {
  /** Borde izquierdo del muro de la cabaña (px del mundo). */
  cabinX: number;
  /** Centro de la puerta (px del mundo). */
  doorX: number;
  groundY: number;
}

/** Posiciones del campamento (px del mundo; suelo en y = 160). */
export const CAMP_LAYOUT: CampLayout = {
  cabinX: -360,
  doorX: -360 + 61,
  groundY: 160,
};

export function createCampParts(scene: Phaser.Scene): void {
  buildParts(scene, 'camp', CAMP_PARTS);
  const anim = (key: string, frames: string[], rate: number) => {
    if (!scene.anims.exists(key))
      scene.anims.create({
        key,
        frames: frames.map((frame) => ({ key: 'camp', frame })),
        frameRate: rate,
        repeat: -1,
      });
  };
  anim('cb-glow', ['cb_glow_0', 'cb_glow_1'], 6);
}

/**
 * Compone el resto del campamento. Devuelve las luces (para LightingSystem);
 * la cabaña y sus luces las compone CabinSite.
 */
export class CampSite {
  readonly lights: LightSource[] = [];

  constructor(scene: Phaser.Scene) {
    createCampParts(scene);
    const { groundY } = CAMP_LAYOUT;
    const image = (frame: string, x: number, y: number, depth: number) =>
      scene.add
        .image(Math.round(x), Math.round(y), 'camp', frame)
        .setOrigin(0, 1)
        .setDepth(depth);
    // Camino de acceso: desde los escalones de la cabaña hasta la bodega.
    for (let x = CAMP_LAYOUT.doorX - 8; x < 40; x += 16)
      scene.add
        .image(x, groundY, 'camp', 'cb_path')
        .setOrigin(0, 0)
        .setDepth(DEPTH.terrain + 3);

    // Zona de reunión entre la cabaña y la bodega.
    const meet = -170;
    image('cb_bench', meet - 44, groundY, DEPTH.structures);
    image('cb_bench', meet + 22, groundY, DEPTH.structures);
    image('cb_reel', meet - 13, groundY, DEPTH.structures);
    image('cb_mugs', meet - 7, groundY - 15, DEPTH.structures + 1);
    image('cb_brazier', meet + 60, groundY, DEPTH.structures);
    scene.add
      .sprite(meet + 61, groundY - 12, 'camp', 'cb_glow_0')
      .setOrigin(0, 1)
      .setDepth(DEPTH.structures + 1)
      .play('cb-glow');
    this.lights.push({ x: meet + 67, y: groundY - 16, radius: 20, kind: 'decor' });

    // Faroles en postes a lo largo del camino.
    for (const x of [-404, -246, -84]) {
      image('cb_post', x, groundY, DEPTH.structures - 2);
      scene.add
        .sprite(x + 9, groundY - 33, 'warehouse', 'wh_lantern_0')
        .setOrigin(0, 1)
        .setDepth(DEPTH.structures - 2)
        .play({ key: 'wh-lantern', startFrame: Math.abs(x) % 2 });
      this.lights.push({ x: x + 14, y: groundY - 40, radius: 16, kind: 'decor' });
    }

    // Suministros del campamento.
    image('cb_tank', -470, groundY, DEPTH.structures - 2);
    const props = (name: 'crate' | 'barrel', x: number, y = groundY) => {
      const img = scene.add.image(0, 0, 'props', name).setOrigin(0, 1).setDepth(DEPTH.structures);
      img.setPosition(x - Math.floor(img.width / 2), y);
    };
    props('crate', -432);
    props('crate', -432, groundY - 16);
    props('barrel', -416);
    props('barrel', -206);
    props('crate', -60);

    // Letrero de dirección junto a la bodega.
    image('cb_signpost', -38, groundY, DEPTH.structures - 3);
    pixelText(scene, -38 + 6, groundY - 27, 'CABAÑAS', P.cream).setDepth(
      DEPTH.structures - 3,
    );
  }
}
