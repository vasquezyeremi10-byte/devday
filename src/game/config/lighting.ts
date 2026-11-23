import { TILE_SIZE, WORLD } from './constants';
import { PALETTE as P } from './palette';

/**
 * Parámetros de iluminación, en unidades del mundo (tiles de 16 px y píxeles
 * del mundo a zoom 1), nunca en píxeles de pantalla: el escalado 2×/3× se hace
 * por CSS y no cambia estas medidas.
 */
export const LIGHTING = {
  /**
   * Celda del mapa de luz natural (SkyLightMap): 4 × 4 px. Sus pérdidas
   * (`sky.airStep`, `solidStep`…) están medidas por celda de 4 px, y la
   * galería cenital también usa este tamaño.
   */
  cell: 4,
  /**
   * Celda del dibujo de la luz en la vista lateral (18 de noviembre de 2026):
   * 2 × 2 px. La sombra y el brillo del casco, las antorchas, los faroles y
   * los cristales se calculan por celda de 2 px, así sus anillos tienen bordes
   * el doble de finos. La luz natural se sigue leyendo de su mapa de 4 px y la
   * oclusión del casco y los faroles se comparte por bloques de 4 px (el
   * borde contra la roca no cambia, porque las caras están a múltiplos de 16).
   */
  renderCell: 2,
  headlamp: {
    /**
     * V12: luz radial como la de una antorcha en la mano (Terraria): un
     * resplandor redondo alrededor del casco, igual hacia todos lados, que
     * decae suave con la distancia y se corta contra los bloques. Con la
     * cuantización de 4 niveles se ve como anillos concéntricos limpios.
     */
    radial: {
      /** Radio de luz plena alrededor de la lámpara (bloques). */
      coreTiles: 1,
      /** Radio total: más allá no ilumina (bloques). */
      radiusTiles: 6.5,
      /** Curvatura del decaimiento (1 = lineal; mayor = se apaga antes). */
      curve: 1.3,
    },
    /** Intensidad máxima dentro del haz (1 = 100 %). */
    intensity: 1,
    /** Encendido/apagado automático al cruzar la bocamina. */
    fadeMs: 280,
    /** Profundidad (px) que la luz alcanza dentro de la cara de un bloque. */
    penetration: 14,
  },
  /**
   * V9: batería de la linterna del casco. Carga 0..100; a plena intensidad
   * dura `durationMs` de uso efectivo (el haz encendido). `warnAt` es el
   * umbral (%) de la advertencia visual con parpadeo discreto.
   */
  battery: { durationMs: 900_000, warnAt: 20 },
  /**
   * Luz natural en enteros 0..max por celda de 4 px. Se propaga por aire y
   * se apaga deprisa dentro de la roca; nunca sale de un sólido hacia aire.
   */
  sky: {
    max: 64,
    /** Pérdida por celda en aire bajo la superficie natural (≈5 tiles). */
    airStep: 3,
    /**
     * Pérdida por celda dentro de un sólido: la luz del día solo muestra la
     * cara expuesta (≈1 bloque). Las capas subterráneas quedan ocultas.
     */
    solidStep: 16,
    /**
     * Solo para dibujar: pérdida por celda sólida del mapa suave. La luz del
     * día baja ≈3 bloques en franjas (plena, penumbra, ambiente) en vez de
     * cortar a negro bajo el primer bloque; el descubrimiento sigue usando
     * `solidStep` (lo oculto no se revela).
     */
    softStep: 5,
    /** Oscurecimiento de las caras de roca que dan a galerías oscuras. */
    faceStep: 6,
  },
  /**
   * Luz ambiental subterránea: 4 % bajo la superficie que baja de forma
   * continua hasta 2 % en la zona profunda (sin escalones visibles).
   */
  ambient: {
    shallow: 0.04,
    deep: 0.02,
    /** Desde esta fila comienza la zona D (excavación profunda). */
    deepRow: WORLD.surfaceRow + 7,
  },
  /** Umbrales de luz natural en la cabeza del minero para clasificar la zona. */
  zones: { surface: 0.8, entrance: 0.12 },
  /**
   * Faroles y ventanas: emisión baja de día; de noche su luz ámbar alcanza
   * el suelo, los muros y al minero cercanos (radio × nightRadius).
   */
  decorLamp: { radius: 10, intensity: 0.5, nightRadius: 1.7 },
  /**
   * Iluminación cuantizada (corrección de iluminación, 11 de noviembre de
   * 2026). La luz de cada celda de 4 px se reduce a 4 niveles limpios
   * (0 oscuridad, 1 ambiente azul, 2 penumbra, 3 luz plena), sin trama
   * salvo que se active `dither`. Umbrales: luz ≥ t[k] → nivel k + 1.
   */
  quantize: { thresholds: [0.1, 0.38, 0.7] as const },
  /**
   * Trama Bayer 4 × 4 opcional en el borde superior de cada banda.
   * `intensity` 0..1: fracción de la banda que se tramea (0 = bandas limpias).
   */
  dither: { enabled: false, intensity: 0.35 },
  /**
   * Colores de la capa de sombra (multiplicativa, opaca): luz natural en
   * azul frío; luces locales (casco, antorchas, faroles) en ámbar. El nivel 3
   * neutro es blanco: lo iluminado por el sol no cambia.
   */
  ramp: {
    neutral: [0x07091a, 0x1b2446, 0x6a7cb0, 0xffffff],
    warm: [0x07091a, 0x3a2216, 0xb7773f, 0xffe2b8],
  },
  /**
   * Capa aditiva ámbar de las luces locales por nivel (0..3): da brillo a lo
   * que alumbran (muros, suelo, personajes y objetos) sin halos de puntos.
   */
  glow: [0x000000, 0x1c0f02, 0x3c2208, 0x603a10],
  /**
   * V10: luz de los cristales violeta. Rampa multiplicativa y brillo aditivo
   * propios (violeta frío): muros y suelo junto a un cristal se tiñen de
   * violeta. Nivel 3 de la rampa es casi blanco: no deslava lo iluminado.
   */
  violet: [0x07091a, 0x2a1850, 0x9a6ad8, 0xf0e0ff],
  glowViolet: [0x000000, 0x100628, 0x240c48, 0x3a1470],
  crystal: {
    /** Alcance (px) y fuerza de la luz de un cristal descubierto. */
    radius: 34,
    intensity: 0.78,
  },
  /**
   * V10: oscuridad progresiva. Lo descubierto bajo tierra (nivel 1, ambiente
   * azul) se oscurece por franjas de `step` filas desde `fromRow`, de azul
   * marino a casi negro en la zona profunda. Sin degradados: un color plano
   * por franja. La franja 0 es el ambiente original.
   */
  depthAmbient: {
    fromRow: 14,
    step: 4,
    colors: [0x1b2446, 0x172040, 0x121a36, 0x0e1429, 0x0a0f1e],
  },
  /** Las celdas descubiertas nunca bajan del ambiente azul (nivel 1). */
  knownLevel: 1,
  colors: {
    /** Destello de mena alcanzada por el haz. */
    sparkle: P.cream,
    /** Punto luminoso de la lámpara. */
    lamp: P.white,
  },
} as const;

/** Alcance total (px) de la luz del casco desde la lámpara. */
export const HEADLAMP_RANGE = LIGHTING.headlamp.radial.radiusTiles * TILE_SIZE;
