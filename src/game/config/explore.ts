import {
  WORLD_REV_EXPLORE,
  WORLD_REV_ENTRANCE_10,
  WORLD_REV_LEGACY,
  WORLD_REV_SOLID,
} from '../world/Geology';
import type { DialogPage } from './intro';

/**
 * Las partidas nuevas usan la mina sólida con entrada de 10 × 3. En desarrollo
 * se pueden probar las revisiones anteriores con `?world=1`, `2` o `3`.
 */
export function worldRevFor(
  developmentBuild: boolean,
  _automated: boolean,
  search: string,
): number {
  if (!developmentBuild) return WORLD_REV_ENTRANCE_10;
  const forced = new URLSearchParams(search).get('world');
  if (forced === '1') return WORLD_REV_LEGACY;
  if (forced === '2') return WORLD_REV_EXPLORE;
  if (forced === '3') return WORLD_REV_SOLID;
  if (forced === '4') return WORLD_REV_ENTRANCE_10;
  return WORLD_REV_ENTRANCE_10;
}

/** Revisión que usa esta ventana del navegador. */
export const worldRevDefault = (): number =>
  worldRevFor(
    import.meta.env.DEV,
    typeof navigator !== 'undefined' && navigator.webdriver === true,
    typeof window === 'undefined' ? '' : window.location.search,
  );

/** La página arrancada del abuelo, en la cámara secreta. */
export const TORN_PAGE: readonly DialogPage[] = [
  {
    speaker: 'PÁGINA ARRANCADA',
    text: 'UNA HOJA DEL DIARIO, ARRANCADA A PROPÓSITO. ES LA LETRA DEL ABUELO. ARRIBA DICE: «PÁGINA 2».',
  },
  {
    speaker: 'PÁGINA 2',
    text: '«EL CRISTAL VIOLETA NO BRILLA: RESPONDE. SE AVIVA DONDE LA ROCA ES MÁS DURA, Y POR ESO SELLÉ ESTA CÁMARA.»',
  },
  {
    speaker: 'PÁGINA 2',
    text: '«SI LEES ESTO, TU PICO YA ES MEJOR QUE EL MÍO. SIGUE LA LUZ VIOLETA HACIA EL FONDO, PERO NO BAJES CON LA LINTERNA VACÍA.»',
  },
];
