import type Phaser from 'phaser';
import { CART } from '../../config/cart';
import { PALETTE as P } from '../../config/palette';
import { buildParts, type Part } from './PartsTexture';

/**
 * Caja del carro artesanal (20 × 10): borde trasero de acero, interior visible
 * donde se acumula la carga, fleje delantero remachado y dos tablas de madera
 * con esquineros metálicos. Las ruedas y la carga las proyecta LogisticsView según
 * el estado real del carro, para que giren y se llenen sin cambiar la textura.
 */
const CART_BODY: Part = {
  name: 'cart_body',
  w: CART.width,
  h: CART.bodyHeight,
  draw(b) {
    const w = CART.width;
    // Borde trasero y boca de la caja.
    b.rect(0, 0, w, 5, P.ink);
    b.rect(1, 1, w - 2, 1, P.steel);
    // Interior en sombra: tablas del fondo vistas desde arriba.
    b.rect(1, 2, w - 2, 1, P.umber);
    b.px(6, 2, P.ink);
    b.px(13, 2, P.ink);
    // Borde delantero: fleje fino con remaches.
    b.rect(1, 3, w - 2, 1, P.silver);
    b.px(3, 3, P.steel);
    b.px(w - 4, 3, P.steel);
    // Costado de tablas que se estrecha hacia el chasis.
    for (let y = 4; y < 9; y++) {
      const inset = y < 7 ? 1 : 2;
      b.rect(inset - 1, y, w - 2 * (inset - 1), 1, P.ink);
      b.rect(
        inset,
        y,
        w - 2 * inset,
        1,
        y === 4 ? P.loam : y === 8 ? P.earth : y === 7 ? P.soil : P.clay,
      );
      b.px(inset, y, P.ochre);
    }
    // Junta entre las dos tablas y vetas.
    for (let x = 3; x < w - 3; x += 2) b.px(x, 6, P.earth);
    b.px(8, 5, P.soil);
    b.px(12, 7, P.earth);
    // Esquineros de acero azul con remache y fleje central.
    for (const x of [4, w - 5]) {
      b.rect(x, 4, 1, 5, P.slate);
      b.px(x, 5, P.silver);
      b.px(x, 7, P.steel);
    }
    b.rect(9, 4, 2, 5, P.slate);
    b.px(9, 4, P.steel);
    // Chasis.
    b.rect(3, 9, w - 6, 1, P.ink);
  },
};

/** Textura del carro (idempotente). */
export function createCartParts(scene: Phaser.Scene): void {
  buildParts(scene, 'cart', [CART_BODY]);
}
