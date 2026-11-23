/**
 * Pantalla completa y modo de juego inmersivo.
 *
 * Hay dos pantallas completas distintas:
 * - la de la aplicación (Fullscreen API, `document.fullscreenElement`), que el
 *   juego puede pedir y cerrar;
 * - la del navegador (su propio F11), que la página no controla: solo se nota
 *   porque la ventana pasa a medir lo mismo que la pantalla.
 *
 * F11 pide o cierra la de la aplicación cuando el navegador entrega la tecla
 * y la API está disponible. Si el navegador ya está en su propia pantalla
 * completa (o no hay API), la tecla se deja pasar sin tocarla: no se simula
 * controlar algo que pertenece al navegador.
 */
export type F11Action = 'enter' | 'exit' | 'browser';

export interface FullscreenState {
  /** La API existe y el documento puede pedirla. */
  supported: boolean;
  /** Pantalla completa pedida por la aplicación. */
  app: boolean;
  /** Pantalla completa del navegador (su F11), sin la API. */
  browser: boolean;
}

/** Qué hacer con un F11 recibido por la página (lógica pura). */
export function f11Action(state: FullscreenState): F11Action {
  if (state.app) return 'exit';
  if (!state.supported || state.browser) return 'browser';
  return 'enter';
}

/**
 * ¿La ventana ocupa toda la pantalla sin la API? Es la huella de la pantalla
 * completa del navegador (margen de 1 px por redondeos de escala).
 */
export function looksLikeBrowserFullscreen(
  inner: { width: number; height: number },
  screen: { width: number; height: number },
  appFullscreen: boolean,
): boolean {
  return (
    !appFullscreen &&
    inner.width >= screen.width - 1 &&
    inner.height >= screen.height - 1
  );
}

export function fullscreenState(): FullscreenState {
  const app = !!document.fullscreenElement;
  return {
    supported: document.fullscreenEnabled === true,
    app,
    browser: looksLikeBrowserFullscreen(
      { width: window.innerWidth, height: window.innerHeight },
      { width: window.screen.width, height: window.screen.height },
      app,
    ),
  };
}

/** ¿Se ve a pantalla completa (por la aplicación o por el navegador)? */
export function isFullscreen(): boolean {
  const s = fullscreenState();
  return s.app || s.browser;
}

export type FullscreenResult =
  | 'entered'
  | 'exited'
  | 'unsupported'
  | 'browser'
  | 'denied';

/**
 * Alterna la pantalla completa de la aplicación (opción de Configuración y
 * F11). Debe llamarse dentro de un gesto del usuario (tecla o clic).
 */
export async function toggleFullscreen(): Promise<FullscreenResult> {
  const action = f11Action(fullscreenState());
  if (action === 'browser')
    return document.fullscreenEnabled ? 'browser' : 'unsupported';
  try {
    if (action === 'exit') {
      await document.exitFullscreen();
      return 'exited';
    }
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    return 'entered';
  } catch {
    return 'denied';
  }
}

/**
 * Escucha F11 y los cambios de pantalla completa (de la aplicación o del
 * navegador) para reajustar el lienzo. Devuelve la función que lo desmonta.
 */
export function installFullscreen(onChange: () => void): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.code !== 'F11' || event.repeat) return;
    // Pantalla completa del navegador o sin API: la tecla es suya.
    if (f11Action(fullscreenState()) === 'browser') return;
    event.preventDefault();
    void toggleFullscreen();
  };
  // Fase de captura: antes que las escenas que detienen las teclas.
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('fullscreenchange', onChange);
  return () => {
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('fullscreenchange', onChange);
  };
}

/**
 * Texto del estado para Configuración; `compact` para botones angostos (la
 * pausa), donde caben unos 22 caracteres.
 */
export function fullscreenLabel(compact = false): string {
  const s = fullscreenState();
  const name = compact ? 'PANT. COMPLETA' : 'PANTALLA COMPLETA';
  if (s.app) return `${name}: SÍ`;
  if (s.browser) return compact ? `${name}: F11` : `${name}: NAVEGADOR (F11)`;
  if (!s.supported) return compact ? `${name}: NO DISP.` : `${name}: NO DISPONIBLE`;
  return `${name}: NO`;
}

/** Aviso breve tras pulsar la opción, o null si no hace falta decir nada. */
export function fullscreenNotice(result: FullscreenResult): string | null {
  if (result === 'browser') return 'SAL CON F11 DEL NAVEGADOR';
  if (result === 'unsupported') return 'ESTE NAVEGADOR NO LO PERMITE';
  if (result === 'denied') return 'EL NAVEGADOR LO RECHAZÓ';
  return null;
}
