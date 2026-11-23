/**
 * Nombre de la mina: el jugador lo escribe al empezar cada partida y aparece
 * en el letrero luminoso de la bocamina. Máximo 10 caracteres.
 *
 * Caracteres permitidos: letras A–Z, Ñ, vocales con tilde (todas existen en
 * la fuente PixelFont) y espacio. Los dígitos no se usan porque 1 y 2 eligen
 * la modalidad en la misma pantalla.
 */
export const MINE_NAME_MAX = 10;
export const DEFAULT_MINE_NAME = 'MINA CERO';
const ALLOWED = /^[A-ZÑÁÉÍÓÚ ]$/;

/** Carácter de teclado → carácter del nombre (o null si no se admite). */
export function nameChar(key: string): string | null {
  if (key.length !== 1) return null;
  const upper = key.toUpperCase();
  return ALLOWED.test(upper) ? upper : null;
}

/** Normaliza un nombre: mayúsculas, caracteres válidos, espacios y largo. */
export function sanitizeMineName(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_MINE_NAME;
  const clean = [...raw]
    .map((c) => nameChar(c) ?? '')
    .join('')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, MINE_NAME_MAX)
    .trim();
  return clean || DEFAULT_MINE_NAME;
}
