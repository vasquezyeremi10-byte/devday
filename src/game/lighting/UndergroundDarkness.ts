import Phaser from 'phaser';
import { VIEW } from '../config/constants';
import { DEPTH } from '../config/layers';
import { LIGHTING } from '../config/lighting';
import { depthBand } from './DepthAmbient';
import type { ExposureMap } from './ExposureMap';
import { pixelLevel, quantLevel } from './Quantize';

/** Celda del dibujo de la luz (2 px; ver LIGHTING.renderCell). */
const C = LIGHTING.renderCell;
/** Alineación de la ventana: múltiplo de la celda y del patrón Bayer. */
const ALIGN = 8;

/** Color 0xRRGGBB → píxel RGBA opaco en un Uint32Array little-endian. */
const opaque = (color: number): number =>
  (0xff000000 |
    ((color & 0xff) << 16) |
    (color & 0xff00) |
    ((color >> 16) & 0xff)) >>>
  0;
const NEUTRAL = LIGHTING.ramp.neutral.map(opaque);
const WARM = LIGHTING.ramp.warm.map(opaque);
const GLOW = LIGHTING.glow.map(opaque);
const VIOLET = LIGHTING.violet.map(opaque);
const GLOW_VIOLET = LIGHTING.glowViolet.map(opaque);
const DEPTH_AMBIENT = LIGHTING.depthAmbient.colors.map(opaque);
const WHITE = NEUTRAL[3]!;
const BLACK = GLOW[0]!;

/**
 * Color de una celda: el ambiente azul (nivel 1 neutro) se oscurece con la
 * profundidad por franjas; el resto de niveles y rampas no cambia.
 */
function shade(ramp: number[], level: number, worldY: number): number {
  if (level !== 1 || ramp !== NEUTRAL) return ramp[level]!;
  return DEPTH_AMBIENT[depthBand(Math.floor(worldY / 16))]!;
}

/**
 * Composición de la luz del mundo en dos capas reutilizadas, a la
 * resolución nativa de la vista (celdas de 2 px, filtro NEAREST, sin
 * suavizado ni alfa parcial):
 *
 * - Sombra (mezcla multiplicativa, píxeles opacos): cada celda toma uno de
 *   4 niveles de una rampa azul fría (luz natural y ambiente) o ámbar (luces
 *   locales). Nivel 3 neutro = blanco: lo iluminado no cambia.
 * - Brillo (mezcla aditiva): ámbar cuantizado donde alumbran el casco, las
 *   antorchas y los faroles, para que muros, suelo, personajes y objetos
 *   cercanos reciban su luz. Negro (sin efecto) en el resto.
 *
 * Bandas limpias por defecto; la trama Bayer 4 × 4 es opcional
 * (`LIGHTING.dither`) y solo afecta al borde superior de cada banda. Las
 * texturas solo se suben cuando cambian, y la sombra se oculta si todo está
 * iluminado (superficie de día).
 */
export class UndergroundDarkness {
  /** Celdas de 2 px que cubren la vista con margen por lado. */
  readonly columns = Math.ceil(VIEW.width / C) + 6;
  readonly rows = Math.ceil(VIEW.height / C) + 6;
  /** Luz total 0..1 por celda, rellenada por LightingSystem cada fotograma. */
  readonly light = new Float32Array(this.columns * this.rows);
  /** Aporte 0..1 de las luces locales (casco, antorchas, faroles) por celda. */
  readonly local = new Float32Array(this.columns * this.rows);
  /** 1 si la luz local domina la celda (rampa ámbar). */
  readonly warm = new Uint8Array(this.columns * this.rows);
  /** 1 si la luz de un cristal violeta domina la celda (rampa violeta). */
  readonly violet = new Uint8Array(this.columns * this.rows);
  /** Celdas descubiertas: nunca bajan del ambiente azul. */
  readonly known = new Uint8Array(this.columns * this.rows);
  /** Brillo aditivo 0..1 de las luces locales (0 de día al aire libre). */
  readonly glowAmount = new Float32Array(this.columns * this.rows);
  /** 1 si la celda está al aire libre: el brillo cae solo sobre el primer plano. */
  readonly outdoor = new Uint8Array(this.columns * this.rows);
  /** Esquina superior izquierda en el mundo, alineada a la celda. */
  x = 0;
  y = 0;
  /** Capa de sombra (multiplicativa). */
  readonly image: Phaser.GameObjects.Image;
  /** Capa de brillo ámbar (aditiva). */
  readonly glowImage: Phaser.GameObjects.Image;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly glowTexture: Phaser.Textures.CanvasTexture;
  private readonly data: ImageData;
  private readonly glowData: ImageData;
  private readonly pixels: Uint32Array;
  private readonly glowPixels: Uint32Array;
  /** Puntos sueltos (lámpara, destellos) del último cuadro, para borrarlos. */
  private readonly dots: number[] = [];
  private shadeDirty = true;
  private glowDirty = true;

  constructor(scene: Phaser.Scene) {
    const w = this.columns * C,
      h = this.rows * C;
    const make = (key: string) => {
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const t = scene.textures.createCanvas(key, w, h)!;
      t.setFilter(Phaser.Textures.FilterMode.NEAREST);
      return t;
    };
    this.texture = make('lighting-darkness');
    this.glowTexture = make('lighting-glow');
    this.data = this.texture.context.createImageData(w, h);
    this.glowData = this.glowTexture.context.createImageData(w, h);
    this.pixels = new Uint32Array(this.data.data.buffer);
    this.glowPixels = new Uint32Array(this.glowData.data.buffer);
    this.pixels.fill(WHITE);
    this.glowPixels.fill(BLACK);
    this.image = scene.add
      .image(0, 0, 'lighting-darkness')
      .setOrigin(0, 0)
      .setDepth(DEPTH.lighting)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.glowImage = scene.add
      .image(0, 0, 'lighting-glow')
      .setOrigin(0, 0)
      .setDepth(DEPTH.lighting + 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
  }

  /** Alinea la ventana de luz con la cámara (en celdas enteras del mundo). */
  begin(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.x = Math.floor(camera.scrollX / ALIGN) * ALIGN - ALIGN;
    this.y = Math.floor(camera.scrollY / ALIGN) * ALIGN - ALIGN;
    this.light.fill(0);
    this.local.fill(0);
    this.warm.fill(0);
    this.violet.fill(0);
    this.known.fill(0);
    this.glowAmount.fill(0);
    this.outdoor.fill(0);
  }

  /** Píxel opaco adicional (punto de la lámpara, destellos) en el mundo. */
  dot(wx: number, wy: number, color: number): void {
    const px = Math.floor(wx) - this.x,
      py = Math.floor(wy) - this.y,
      w = this.columns * C;
    if (px < 0 || py < 0 || px >= w || py >= this.rows * C) return;
    // En la capa de brillo: aditivo sobre lo que haya (punto nítido).
    this.glowPixels[py * w + px] = opaque(color);
    this.dots.push(py * w + px);
    this.glowDirty = true;
  }

  /**
   * ¿El píxel del mundo quedó oscurecido en el último cuadro? La luz plena
   * (blanca o ámbar del nivel 3) no cuenta como oscuridad.
   */
  covered(wx: number, wy: number): boolean {
    const w = this.columns * C,
      px = Math.floor(wx) - this.x,
      py = Math.floor(wy) - this.y;
    if (px < 0 || py < 0 || px >= w || py >= this.rows * C) return false;
    const p = this.pixels[py * w + px];
    return this.image.visible && p !== WHITE && p !== WARM[3];
  }

  /** Convierte la luz de cada celda en las dos capas. */
  compose(
    exposure: ExposureMap | null = null,
    /** ¿Hay terreno, estructura o personaje en el píxel? (brillo al aire libre). */
    foreground: (x: number, y: number) => boolean = () => true,
  ): void {
    const w = this.columns * C,
      px = this.pixels,
      gp = this.glowPixels;
    const dither = LIGHTING.dither.enabled && LIGHTING.dither.intensity > 0;
    let lit = true,
      glow = false;
    for (const i of this.dots) gp[i] = BLACK;
    this.dots.length = 0;
    for (let cy = 0; cy < this.rows; cy++)
      for (let cx = 0; cx < this.columns; cx++) {
        const i = cy * this.columns + cx;
        const floor = this.known[i] ? LIGHTING.knownLevel : 0;
        const tinted = !this.warm[i] && this.violet[i] === 1;
        const ramp = this.warm[i] ? WARM : tinted ? VIOLET : NEUTRAL;
        const base = cy * C * w + cx * C;
        const wx = this.x + cx * C,
          wy = this.y + cy * C;
        const cellLevel = pixelLevel(this.light[i]!, floor, wx, wy);
        const g = this.glowAmount[i]!;
        const glowColor =
          g > 0 ? (tinted ? GLOW_VIOLET : GLOW)[quantLevel(g)]! : BLACK;
        if (glowColor !== BLACK) glow = true;
        // Celda uniforme: sin trama ni piezas de estructura con luz propia.
        const masked = glowColor !== BLACK && this.outdoor[i] === 1;
        const plain = !dither && !masked && !exposure?.cellOwned(wx, wy);
        if (plain) {
          const color = shade(ramp, cellLevel, wy);
          if (color !== WHITE) lit = false;
          if (C === 2) {
            // Celda de 2 × 2 (lo habitual): cuatro escrituras directas.
            px[base] = px[base + 1] = px[base + w] = px[base + w + 1] = color;
            gp[base] = gp[base + 1] = gp[base + w] = gp[base + w + 1] = glowColor;
            continue;
          }
          for (let j = 0; j < C; j++) {
            const row = base + j * w;
            for (let k = 0; k < C; k++) {
              px[row + k] = color;
              gp[row + k] = glowColor;
            }
          }
          continue;
        }
        for (let j = 0; j < C; j++)
          for (let k = 0; k < C; k++) {
            let level = dither
              ? pixelLevel(this.light[i]!, floor, wx + k, wy + j)
              : cellLevel;
            // Pieza de una estructura delante de la roca: usa la luz del aire
            // que la rodea (ExposureMap), no la de la roca de detrás.
            if (exposure) {
              const e = exposure.at(wx + k, wy + j);
              if (e >= 0) level = Math.max(level, pixelLevel(e, floor, wx + k, wy + j));
            }
            const color = shade(ramp, level, wy + j);
            if (color !== WHITE) lit = false;
            px[base + j * w + k] = color;
            gp[base + j * w + k] =
              masked && !foreground(wx + k, wy + j) ? BLACK : glowColor;
          }
      }
    this.shadeDirty = !lit;
    this.image.setVisible(!lit);
    this.glowDirty = glow || this.glowDirty;
    this.glowImage.setVisible(glow || this.dots.length > 0);
  }

  /** Sube solo las capas visibles, una vez por fotograma. */
  present(): void {
    if (this.image.visible && this.shadeDirty) {
      this.texture.context.putImageData(this.data, 0, 0);
      this.texture.refresh();
    }
    this.glowImage.setVisible(this.glowImage.visible || this.dots.length > 0);
    if (this.glowImage.visible && this.glowDirty) {
      this.glowTexture.context.putImageData(this.glowData, 0, 0);
      this.glowTexture.refresh();
      this.glowDirty = false;
    }
    this.image.setPosition(this.x, this.y);
    this.glowImage.setPosition(this.x, this.y);
  }
}
