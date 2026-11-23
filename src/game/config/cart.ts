import { BALANCE } from './balance';
import { TILE_SIZE } from './constants';

/**
 * Geometría del carro artesanal. Es la única fuente para el dibujo, los topes
 * de vía, el empuje y la proximidad: el carro no tiene cuerpo Arcade y su
 * "colisión" lógica sale de estas medidas, no de la imagen.
 *
 * Proporción: el minero en reposo ocupa 21 px visibles de su cuadro de 24; el
 * carro mide 11 px con ruedas (≈52 %) y 20 px de ancho (≈1,5–1,7 veces el
 * ancho visible del minero).
 */
/** Cabeza del riel apoyado en el piso de la fila inicial (4 px sobre el suelo). */
const RAIL_TOP = (BALANCE.railRow + 1) * TILE_SIZE - 4;
export const CART = {
  width: 20,
  /** Caja de madera con borde, interior visible y refuerzos. */
  bodyHeight: 10,
  wheelSize: 5,
  /** Centro de cada rueda respecto de `cart.x` (el cuerpo va de x-10 a x+9). */
  wheelCenters: [-6, 5],
  /** Fila superior del riel (franja plateada de rail_segment). */
  railTop: RAIL_TOP,
  /** Las ruedas apoyan su última fila sobre la cabeza del riel. */
  wheelTop: RAIL_TOP - 4,
  /** Borde superior del cuerpo: el chasis queda 1 px sobre el riel. */
  bodyTop: RAIL_TOP - 10,
  /** Altura total visible, ruedas incluidas. */
  height: 11,
  /** Desplazamientos locales respecto del punto de contacto con el riel. */
  bodyOffset: -10,
  wheelOffset: -4,
  /** Distancia del centro del carro al centro del minero mientras empuja. */
  pushOffset: 16,
  /** Por debajo de esta distancia el minero está "dentro" del carro. */
  sideClearance: 12,
  /** Margen entre el centro del carro y el extremo de la vía conectada. */
  railMargin: 10,
} as const;
