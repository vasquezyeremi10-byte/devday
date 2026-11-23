/**
 * Controles configurables. Los valores son `KeyboardEvent.code` del
 * navegador. Nota: los navegadores no distinguen una Tab izquierda de una
 * derecha (ambas informan `code: 'Tab'`), así que el inventario usa `Tab`.
 *
 * Se pueden cambiar guardando un JSON parcial en localStorage bajo
 * `mina-cero.controls`, por ejemplo `{"inventory":"KeyI"}`.
 */
export const DEFAULT_CONTROLS = {
  inventory: 'Tab',
  dismantle: 'KeyX',
  /** Retirar carga del carro (antes X). */
  withdraw: 'KeyV',
  /** V9: encender/apagar la linterna del casco (V11: F; L sigue de alias). */
  headlamp: 'KeyF',
  /** V11: guardar la partida a mano (antes F, que ahora es la linterna). */
  save: 'KeyG',
  /** V9: reemplazar la batería del casco por un repuesto. */
  battery: 'KeyB',
  /** Celular con la tienda minera (abre y cierra). */
  phone: 'KeyU',
} as const;
/** L conserva la linterna por compatibilidad con la versión V9. */
export const HEADLAMP_ALIAS = 'KeyL';
export type ControlAction = keyof typeof DEFAULT_CONTROLS;
export type Controls = Record<ControlAction, string>;
export const CONTROLS_KEY = 'mina-cero.controls';

const VALID =
  /^(Key[A-Z]|Digit[0-9]|Tab|Backquote|Backslash|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Minus|Equal|F[1-9]|F1[0-2])$/;

export function loadControls(): Controls {
  const controls: Controls = { ...DEFAULT_CONTROLS };
  try {
    const raw = JSON.parse(localStorage.getItem(CONTROLS_KEY) ?? '{}');
    for (const key of Object.keys(DEFAULT_CONTROLS) as ControlAction[])
      if (typeof raw[key] === 'string' && VALID.test(raw[key]))
        controls[key] = raw[key];
  } catch {
    // Sin almacenamiento o JSON inválido: controles por defecto.
  }
  return controls;
}

/** Nombre corto de una tecla para el HUD. */
export const keyLabel = (code: string) =>
  code === 'Tab' ? 'TAB' : code.replace(/^(Key|Digit)/, '');
