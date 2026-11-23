/**
 * Menú principal: constantes de disposición y reglas de arranque.
 * Todas las coordenadas están en píxeles nativos (480 × 270).
 */
/**
 * Nombre del juego. Las claves de localStorage conservan el prefijo
 * `mina-cero.` de las versiones anteriores para no perder partidas guardadas.
 */
export const MENU_TITLE_LINES = ['HASTA QUE', 'LA VETA', 'NOS SEPARE'] as const;
export const GAME_TITLE = MENU_TITLE_LINES.join(' ');
export const MENU_TITLE_TEXTURE = 'menu-title-veta';

export const MENU_SETTINGS_KEY = 'mina-cero.menu';

/**
 * Música de la pantalla de inicio («Carta de Descoberta», aportada por el
 * usuario). Se carga diferida para no alargar la barra de carga, suena en
 * bucle y se apaga con un fundido al entrar a la partida. «Sonido» en
 * Configuración la silencia junto con los efectos.
 */
export const MENU_MUSIC = {
  key: 'music-menu',
  volume: 0.5,
  fadeOutMs: 600,
} as const;

/**
 * Escala entera máxima del lienzo mientras el menú ocupa toda la ventana.
 * Durante el juego se conserva el límite 3× (ver main.ts).
 */
export const MENU_MAX_SCALE = 5;

/**
 * Partida (modo inmersivo): el lienzo usa toda la ventana con la mayor escala
 * entera que cabe; el resto queda en bandas negras. El tope solo evita
 * valores absurdos. La vista cenital de desarrollo (?view=top-down) conserva
 * la página con su marco y el límite histórico de 3×.
 */
export const GAME_MAX_SCALE = 12;
export const PAGE_MAX_SCALE = 3;

/**
 * ¿Arranca el juego en el menú? Siempre en producción. En desarrollo,
 * `?menu=off` / `?menu=on` fuerzan el comportamiento, y un navegador
 * automatizado (Playwright) entra directo a la mina para que las pruebas e2e
 * existentes no dependan del menú.
 */
export function shouldShowMenu(
  developmentBuild: boolean,
  automated: boolean,
  search: string,
): boolean {
  if (!developmentBuild) return true;
  const forced = new URLSearchParams(search).get('menu');
  if (forced === 'off') return false;
  if (forced === 'on') return true;
  return !automated;
}

/**
 * Sonido, descripción contextual, transición y profundidad del menú. Los
 * sonidos son originales (scripts/audio/build-intro-sfx.mjs).
 */
export const MENU_FX = {
  sounds: {
    move: { key: 'sfx-ui-move', volume: 0.45 },
    confirm: { key: 'sfx-ui-confirm', volume: 0.55 },
    back: { key: 'sfx-ui-back', volume: 0.45 },
  },
  /** Un mismo sonido no se repite antes de esto (ms): sin ráfagas al navegar. */
  soundGap: 70,
  /** Viento de galería de fondo, por debajo de la música. */
  ambience: { key: 'sfx-intro-ambience', volume: 0.12, fadeIn: 1500 },
  /** La descripción del botón elegido se ve este tiempo tras navegar (ms). */
  tipMs: 3200,
  /** Fundido a negro tramado al entrar a la partida (ms). */
  startFade: 480,
  /** Sin mover el puntero, la profundidad deriva sola tras este tiempo (ms). */
  idleDrift: 4000,
  /** Composición del título en la cuadrícula nativa del menú. */
  titleY: 7,
  subtitle: 'PARA SALVAR SU AMOR, DEBERÁ OLVIDARLO.',
} as const;

/** Disposición del menú principal (botones y panel de información). */
export const MENU_LAYOUT = {
  main: { x: 32, y: 88, w: 144, h: 22, pitch: 28 },
  info: { x: 32, y: 202, w: 144, h: 36 },
} as const;

/** Puntos del fondo de portal (menu-bg-portal.png) donde viven los efectos. */
export const MENU_ANCHORS = {
  /** Faroles de la bocamina: halo cálido con parpadeo. */
  lanterns: [
    { x: 345, y: 80, r: 7 },
    { x: 413, y: 229, r: 6 },
  ],
  /** Cristales de la veta que destellan alrededor del portal. */
  crystals: [
    { x: 220, y: 185, color: 'violet' },
    { x: 235, y: 203, color: 'violet' },
    { x: 327, y: 210, color: 'cyan' },
    { x: 446, y: 160, color: 'violet' },
    { x: 452, y: 195, color: 'cyan' },
    { x: 471, y: 254, color: 'violet' },
  ],
  /** Medallón de promesa: dos facetas unidas por una veta agrietada. */
  promise: { x: 428, y: 116 },
  /** Barrera de niebla: brillo que respira y motas que salen flotando. */
  tunnel: { x: 373, y: 153, rx: 59, ry: 51 },
} as const;
