/**
 * Composición del aspecto del minero con su EPP (lógica pura, sin Phaser).
 *
 * `scripts/art/build-hero.mjs` dibuja al minero sin EPP en una hoja por
 * herramienta (`miner`, `miner-unarmed`, `miner-shovel`…) y exporta, aparte,
 * una capa por pieza de EPP (`hero_ppe.png`, bloques apilados en vertical en
 * el orden de `PPE_LAYERS`). Cada capa contiene solo los píxeles que la pieza
 * cambia sobre el minero sin herramienta, contorno incluido.
 *
 * Para vestir una hoja: se copian las capas equipadas en ese orden y, al
 * final, se vuelve a estampar la herramienta (los píxeles en que la hoja con
 * herramienta difiere de la hoja sin herramienta), que va delante del cuerpo.
 * El resultado es idéntico al dibujo completo salvo en contados píxeles de
 * contorno; el generador lo comprueba al exportar.
 */

/** Orden de las capas en `hero_ppe.png` y orden de estampado. */
export const PPE_LAYERS = ['boots', 'gloves', 'vest', 'goggles', 'helmet'] as const;
export type PPELayer = (typeof PPE_LAYERS)[number];

/** Cuadros de 32 × 32 en una hoja de 9 × 6 (54 cuadros). */
export const HERO_FRAME = 32;
export const HERO_COLUMNS = 9;
export const HERO_FRAMES = 54;
export const HERO_SHEET = {
  width: HERO_COLUMNS * HERO_FRAME,
  height: Math.ceil(HERO_FRAMES / HERO_COLUMNS) * HERO_FRAME,
} as const;

type Pixels = Uint8Array | Uint8ClampedArray;

/**
 * Viste una hoja RGBA. `base` es la hoja con herramienta, `bare` la misma sin
 * herramienta y `layers` las capas de EPP equipadas, en el orden de
 * `PPE_LAYERS`. Solo copia píxeles opacos (alfa 0/255, sin mezclas).
 */
export function composeLook(
  base: Pixels,
  bare: Pixels,
  layers: readonly Pixels[],
  out: Pixels = new Uint8ClampedArray(base.length),
): Pixels {
  if (bare.length !== base.length || out.length !== base.length)
    throw new Error('Hojas de distinto tamaño');
  out.set(base);
  for (const layer of layers) {
    if (layer.length !== base.length) throw new Error('Capa de distinto tamaño');
    for (let i = 0; i < layer.length; i += 4)
      if (layer[i + 3]) {
        out[i] = layer[i]!;
        out[i + 1] = layer[i + 1]!;
        out[i + 2] = layer[i + 2]!;
        out[i + 3] = 255;
      }
  }
  // La herramienta va delante del EPP: se recupera de la hoja base.
  if (base !== bare)
    for (let i = 0; i < base.length; i += 4)
      if (
        base[i] !== bare[i] ||
        base[i + 1] !== bare[i + 1] ||
        base[i + 2] !== bare[i + 2] ||
        base[i + 3] !== bare[i + 3]
      ) {
        out[i] = base[i]!;
        out[i + 1] = base[i + 1]!;
        out[i + 2] = base[i + 2]!;
        out[i + 3] = base[i + 3]!;
      }
  return out;
}
