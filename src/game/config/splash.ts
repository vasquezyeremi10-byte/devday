/**
 * Introducción del estudio (antes del menú principal): todos los tiempos,
 * sonidos y volúmenes en un solo lugar. Ver docs/GAME_DESIGN.md, sección
 * «Introducción del estudio».
 *
 * Duraciones en milisegundos. «in» es la aparición tramada, «hold» el tiempo
 * visible y «out» la desaparición. El orden de las etapas es `order`.
 */
export interface SplashLogo {
  /** Clave de textura (registrada en data/assets.ts con `preload: false`). */
  key: string;
  /** Texto accesible y para pruebas: quién aparece. */
  label: string;
  in: number;
  hold: number;
  out: number;
  /** Sonido al empezar a aparecer (clave de audio) o null. */
  sound: string | null;
  /** Volumen del sonido (0..1), antes del silencio general del juego. */
  volume: number;
}

export type SplashStage = 'opening' | 'studio' | 'sponsors' | 'transition';

export const SPLASH = {
  order: ['opening', 'studio', 'sponsors', 'transition'] as SplashStage[],
  /** Escena 1: pantalla negra, pausa y «DESARROLLADO POR». */
  opening: {
    pause: 500,
    text: 'DESARROLLADO POR',
    in: 900,
    hold: 900,
    out: 700,
    /** Silencio breve entre el texto y el logotipo. */
    gap: 250,
  },
  /** Escena 2: logotipo THE MINERS CL (aportado por el estudio). */
  studio: {
    key: 'studio-logo',
    label: 'THE MINERS CL',
    in: 1000,
    hold: 2500,
    out: 1000,
    sound: 'sfx-intro-impact',
    volume: 0.9,
    /**
     * Tira de cuadros generada por scripts/art/build-studio-logo.mjs: cada
     * cuadro es 2 px más grande que el anterior. El zoom recorre la tira a lo
     * largo de toda la escena, en píxeles enteros.
     */
    logo: { frame: 212, sizes: [200, 202, 204, 206, 208, 210, 212] },
  },
  /**
   * Escena 3: colaboradores, patrocinadores o motor, solo reales y con
   * permiso para mostrar su marca. Vacío = la escena se omite por completo.
   * Para sumar uno: registrar su PNG en data/assets.ts (`preload: false`) y
   * añadir aquí un SplashLogo con su clave, tiempos y sonido.
   */
  sponsors: [] as SplashLogo[],
  /** Sonido por defecto de un logotipo adicional. */
  sponsorSound: 'sfx-intro-chime',
  /** Escena 4: negro con ambiente y paso al menú. */
  transition: {
    black: 900,
    ambience: 'sfx-intro-ambience',
    ambienceVolume: 0.35,
    /** Al llegar al menú el ambiente se apaga lentamente bajo la música. */
    ambienceFadeOut: 3000,
  },
  /** Entrada del menú tras la introducción completa. */
  menuEntrance: {
    background: 1400,
    titleAt: 700,
    titleStep: 220,
    buttonsAt: 1300,
    buttonStagger: 140,
    buttonSlide: 380,
    musicFadeIn: 2000,
  },
  /** Al omitir: fundido breve a negro y menú casi inmediato. */
  skip: { out: 250, menuIn: 400, musicFadeIn: 900 },
  /** Teclas que omiten (event.code); el clic o toque también omite. */
  skipKeys: ['Escape', 'Space'],
  /**
   * Las teclas o clics que llegan antes de esto no omiten: evita que la misma
   * pulsación que habilita el audio salte la introducción.
   */
  skipGuard: 300,
} as const satisfies Record<string, unknown>;

/**
 * ¿Se muestra la introducción? Siempre que el juego arranque en el menú en
 * producción. En desarrollo un navegador automatizado la salta para que las
 * pruebas existentes no esperen siete segundos; `?splash=on` / `?splash=off`
 * fuerzan el comportamiento.
 */
export function shouldShowSplash(
  developmentBuild: boolean,
  automated: boolean,
  search: string,
): boolean {
  if (!developmentBuild) return true;
  const forced = new URLSearchParams(search).get('splash');
  if (forced === 'off') return false;
  if (forced === 'on') return true;
  return !automated;
}
