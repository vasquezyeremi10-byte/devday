/**
 * Primera secuencia jugable: «La herencia del abuelo».
 * Textos y reglas de arranque. Todo en mayúsculas porque la fuente bitmap del
 * juego es de mayúsculas (con tildes y Ñ).
 */

/** Orden fijo de la secuencia; `done` significa «sin tutorial». */
export const INTRO_STEPS = [
  'welcome',
  'tools',
  'kit',
  'mine',
  'dig',
  'home',
  'board',
  'book',
  'done',
] as const;
export type IntroStep = (typeof INTRO_STEPS)[number];

/**
 * ¿Arranca la secuencia en una partida nueva? Siempre en producción. En
 * desarrollo, un navegador automatizado la omite para no alterar las pruebas
 * e2e anteriores; `?intro=on` / `?intro=off` lo fuerzan.
 */
export function introEnabled(
  developmentBuild: boolean,
  automated: boolean,
  search: string,
): boolean {
  if (!developmentBuild) return true;
  const forced = new URLSearchParams(search).get('intro');
  if (forced === 'off') return false;
  if (forced === 'on') return true;
  return !automated;
}

/** Una página de diálogo: quién habla y qué dice. */
export interface DialogPage {
  speaker: string;
  text: string;
}

/** Objetivo de una línea que muestra la guía (vacío = sin guía). */
export const INTRO_OBJECTIVES: Record<IntroStep, string> = {
  welcome: '',
  tools: 'BUSCA LA PICOTA Y LA PALA EN LA BODEGA: EL CAJÓN DE HERRAMIENTAS',
  kit: 'RETIRA EL KIT DE SEGURIDAD EN BODEGA Y EQUÍPATE CON TAB',
  mine: 'INSPECCIONA LA ENTRADA DE LA MINA',
  dig: 'ENTRA A LA MINA Y EXCAVA UN BLOQUE: MANTÉN EL CLIC CON LA PICOTA',
  home: 'VUELVE A LA CABAÑA',
  board: 'EXAMINA LA TABLA SUELTA DEL PISO',
  book: 'LEE EL LIBRO DEL ABUELO',
  done: '',
};

/** Dónde apunta la flecha de la guía en cada paso. */
export type IntroTarget =
  'toolbox' | 'warehouse' | 'mine' | 'cabinDoor' | 'board' | null;
export const INTRO_TARGETS: Record<IntroStep, IntroTarget> = {
  welcome: null,
  tools: 'toolbox',
  kit: 'warehouse',
  mine: 'mine',
  dig: null,
  home: 'cabinDoor',
  board: 'board',
  book: 'board',
  done: null,
};

export const INTRO_DIALOGS = {
  welcome: [
    {
      speaker: 'CABAÑA DEL ABUELO',
      text: 'LA ESTUFA AÚN GUARDA UN POCO DE CALOR. HACE MESES QUE NADIE VIVE AQUÍ.',
    },
    {
      speaker: 'CARTA DEL ABUELO',
      text: '«LA MINA ES TUYA. CAVA CON CABEZA, Y SI ALGÚN DÍA OYES A LA ROCA RESPIRAR, NO BAJES SOLO.»',
    },
    {
      speaker: 'TÚ',
      text: 'UNA CABAÑA, UNA MINA Y UN MONTÓN DE POLVO. ES TODO LO QUE QUEDA.',
    },
    {
      speaker: 'TÚ',
      text: 'SUS HERRAMIENTAS DEBEN SEGUIR EN LA BODEGA. ES HORA DE PONERSE A TRABAJAR.',
    },
  ],
  tools: [
    {
      speaker: 'CAJÓN DE HERRAMIENTAS',
      text: 'DEBAJO DE UNOS TRAPOS: UNA PICOTA Y UNA PALA CON LAS INICIALES DEL ABUELO.',
    },
    { speaker: 'TÚ', text: 'SIGUEN EN BUEN ESTADO. AHORA SON TUYAS.' },
  ],
  mine: [
    {
      speaker: 'BOCAMINA',
      text: 'EL AIRE QUE SALE DEL TÚNEL ES FRÍO Y HUELE A PIEDRA MOJADA.',
    },
    {
      speaker: 'TÚ',
      text: 'AQUÍ EMPEZÓ TODO PARA ÉL. PARA ENTRAR NECESITO MI EQUIPO PUESTO Y LA PICOTA EN LA MANO.',
    },
  ],
  home: [
    {
      speaker: 'CABAÑA',
      text: '(CRRRC...) ESA TABLA DEL PISO SE MOVIÓ BAJO TUS BOTAS.',
    },
    { speaker: 'TÚ', text: 'ESTÁ SUELTA. ¿QUÉ HABRÁ DEBAJO?' },
  ],
  board: [
    {
      speaker: 'BAJO LA TABLA',
      text: 'UN LIBRO ENVUELTO EN TELA ENCERADA. LA TAPA TIENE LA LETRA DEL ABUELO.',
    },
  ],
} as const satisfies Record<string, readonly DialogPage[]>;

/** Primera página del libro del abuelo (un mensaje por línea, ≤ 40 caracteres). */
export const BOOK_PAGE = {
  title: 'DIARIO DEL ABUELO',
  page: 'PÁGINA 1',
  lines: [
    'SI LEES ESTO, LA MINA YA ES TUYA.',
    '',
    'CAVÉ CUARENTA AÑOS Y CREÍ CONOCERLA:',
    'CARBÓN, HIERRO, COBRE, UN POCO DE ORO.',
    '',
    'PERO HAY MINERALES QUE NO FIGURAN EN',
    'NINGÚN CATÁLOGO. BRILLAN SIN LUZ Y',
    'TIBIAN LA MANO COMO UN PAN RECIÉN',
    'SALIDO DEL HORNO.',
    '',
    'NO LOS VENDAS. NO LOS NOMBRES.',
    'BUSCA SOLO CUANDO ESTÉS LISTO.',
  ],
  footer: 'LAS PÁGINAS SIGUIENTES ESTÁN PEGADAS POR LA HUMEDAD.',
} as const;

/** Frases cortas de los objetos de la cabaña (E). */
export const CABIN_NOTES = {
  calendar:
    'UN CALENDARIO CON LOS DÍAS TACHADOS. EL ÚLTIMO TACHÓN ES DE HACE MESES.',
  stove:
    'LA ESTUFA AÚN GUARDA UN POCO DE CALOR. ALGUIEN LA ENCENDIÓ HACE POCO.',
  window: 'AFUERA, EL CERRO Y LA BOCAMINA. EL ABUELO LA MIRABA CADA MAÑANA.',
  shelf: 'UNA RADIO VIEJA, TRES LIBROS Y UN TERMO. LA RADIO SOLO DA ESTÁTICA.',
} as const;
