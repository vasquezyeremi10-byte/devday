import { VIEW } from '../config/constants';

/**
 * Zoom CSS del lienzo que da un escalado entero en píxeles físicos.
 *
 * Con la escala de pantalla de Windows (125 %, 150 %…) un zoom entero en
 * píxeles CSS no es entero en píxeles reales: con 125 % y 2× cada píxel del
 * juego medía 2,5 píxeles y el vecino más próximo alternaba columnas de 2 y 3
 * (bordes irregulares, pérdida de nitidez). Aquí se elige el mayor múltiplo
 * entero de píxeles físicos que cabe y se convierte a CSS. Con
 * devicePixelRatio 1 el resultado es el de siempre (1×, 2×, 3×…).
 *
 * `maxScale` es el tope en píxeles CSS (3 en el juego, MENU_MAX_SCALE en el
 * menú). El mínimo es 1 píxel físico por píxel del juego redondeado al
 * múltiplo más cercano del devicePixelRatio: en pantallas estrechas el
 * contenedor se desplaza en vez de reducir la imagen.
 *
 * `slack` (en píxeles del juego, 0 por defecto): cuánto puede sobrar el lienzo
 * respecto del espacio disponible para elegir un escalón más. Sirve para no
 * perder un escalón entero por una diferencia mínima. Un monitor de
 * 1920 × 1080 al 175 % ofrece 617 px CSS de alto, o sea 1079,75 px físicos:
 * a 4× faltan 0,25 px y, sin holgura, el juego bajaba a 3× y usaba solo el
 * 75 % de la pantalla. Con `slack` 1 se elige 4× y el borde inferior se
 * recorta en esa fracción de píxel (invisible; el contenedor no se desplaza).
 */
export function integerZoom(
  availableWidth: number,
  availableHeight: number,
  maxScale: number,
  dpr: number,
  slack = 0,
): number {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const cap = Math.floor(maxScale * ratio + 1e-6);
  const widthPx = availableWidth * ratio;
  const heightPx = availableHeight * ratio;
  // Mayor factor entero que cabe exactamente.
  let device = Math.min(
    cap,
    Math.floor(widthPx / VIEW.width + 1e-6),
    Math.floor(heightPx / VIEW.height + 1e-6),
  );
  // Un escalón más si solo se pasa por menos de `slack` píxeles del juego.
  const next = device + 1;
  if (
    slack > 0 &&
    next <= cap &&
    next * VIEW.width <= widthPx + slack * next + 1e-6 &&
    next * VIEW.height <= heightPx + slack * next + 1e-6
  )
    device = next;
  return Math.max(Math.max(1, Math.round(ratio)), device) / ratio;
}

/**
 * ¿El lienzo a este zoom sobra del espacio disponible (por la holgura de
 * `integerZoom`)? Si es así, el contenedor recorta ese margen en lugar de
 * mostrar barras de desplazamiento por una fracción de píxel.
 */
export function overflowsSlightly(
  zoom: number,
  availableWidth: number,
  availableHeight: number,
  dpr: number,
): boolean {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const over =
    VIEW.width * zoom > availableWidth + 1e-6 ||
    VIEW.height * zoom > availableHeight + 1e-6;
  // En el mínimo (ventana más chica que el juego) se desplaza, no se recorta.
  const atMinimum = zoom * ratio <= Math.max(1, Math.round(ratio)) + 1e-9;
  return over && !atMinimum;
}
