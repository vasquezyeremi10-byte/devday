/** Doble cierre: solo servidor de desarrollo y activación explícita por URL. */
export function developerMode(
  developmentBuild: boolean,
  search: string,
): boolean {
  return developmentBuild && new URLSearchParams(search).get('dev') === '1';
}

export const DEVELOPER_MODE = developerMode(
  import.meta.env.DEV,
  typeof window === 'undefined' ? '' : window.location.search,
);

/** Nunca se escribe sobre la partida normal desde la consola. */
export const DEVELOPER_SAVE_KEY = 'mina-cero.developer.save.v5';
