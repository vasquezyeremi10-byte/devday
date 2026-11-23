import Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import { TILE_SIZE, WORLD } from '../config/constants';
import { PALETTE as P, cssColor } from '../config/palette';
import { createPixelFont } from '../ui/PixelFont';
import { USE_PLACEHOLDER_BACKGROUNDS } from '../data/assets';
import { drawBackdrop } from './Backdrop';
import { createTerrainTexture } from './TerrainArt';
import { surfaceRow } from './TerrainGrid';

/** Texturas creadas por código: fuente bitmap y tileset geológico. */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  createPixelFont(scene);
  createTerrainTexture(scene);
}

function drawPlaceholderBackgrounds(scene: Phaser.Scene): void {
  const width = WORLD.columns * TILE_SIZE,
    height = WORLD.rows * TILE_SIZE;
  // Cielo, sol, nubes y tres cordilleras con parallax (V6).
  drawBackdrop(scene);

  // Pared trasera de roca: sigue la ladera, para que un hueco no muestre cielo.
  // Sin luz pintada: a oscuras la cubre LightingSystem y el casco la revela.
  undergroundWall(scene, width, height);
}

/**
 * Pared del fondo detrás de lo excavado: hiladas irregulares de piedra
 * oscura con juntas de tinta y canto de luz arriba-izquierda. Con el mundo
 * de biomas (V9) el ancho supera el límite de textura del GPU, así que se
 * trocea en lienzos de a lo sumo 4000 px y cada trozo es una imagen.
 */
function undergroundWall(
  scene: Phaser.Scene,
  width: number,
  height: number,
): void {
  const CHUNK = 4000;
  for (let x0 = 0; x0 < width; x0 += CHUNK) {
    const chunk = Math.min(CHUNK, width - x0);
    const key = `underground-wall-${x0}`;
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(key, chunk, height)!;
      const ctx = texture.context;
      const fill = (
        color: number,
        x: number,
        y: number,
        w: number,
        h: number,
      ) => {
        ctx.fillStyle = cssColor(color);
        ctx.fillRect(x - x0, y, w, h);
      };
      const first = Math.floor(x0 / TILE_SIZE);
      const last = Math.ceil((x0 + chunk) / TILE_SIZE);
      for (let column = first; column < last; column++) {
        const top = surfaceRow(column) * TILE_SIZE + 4;
        fill(P.ink, column * TILE_SIZE, top, TILE_SIZE, height - top);
      }
      ctx.save();
      ctx.beginPath();
      for (let column = first; column < last; column++) {
        const top = surfaceRow(column) * TILE_SIZE + 4;
        ctx.rect(column * TILE_SIZE - x0, top, TILE_SIZE, height - top);
      }
      ctx.clip();
      for (let band = 0; band * 8 < height; band++) {
        const y = band * 8;
        // El patrón de hiladas es continuo entre trozos: la secuencia de
        // piedras se recorre desde el borde del mundo y solo se dibuja la
        // parte que cae dentro del trozo.
        let x = -((band * 7) % 12),
          i = 0;
        while (x < width) {
          const w = 9 + ((band * 31 + i * 17) % 6);
          if (x + w > x0 && x < x0 + chunk) {
            // Hiladas de roca azul acero con piedras violáceas y pardas.
            const k = (band * 5 + i * 3) % 7;
            const [base, lit] =
              k === 0
                ? [P.plum, P.mauve]
                : k === 3
                  ? [P.earth, P.taupe]
                  : (band + i) % 3
                    ? [P.slate, P.stone]
                    : [P.night, P.slate];
            fill(base, x + 1, y + 1, w - 1, 7);
            fill(lit, x + 1, y + 1, Math.min(3, w - 2), 1);
            fill(P.night, x + 1, y + 7, w - 1, 1);
            if ((band + i) % 5 === 0) fill(lit, x + 3, y + 4, 1, 1);
          }
          x += w;
          i++;
        }
      }
      ctx.restore();
      texture.refresh();
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    scene.add
      .image(x0, 0, key)
      .setOrigin(0, 0)
      .setDepth(DEPTH.background + 3);
  }
}

/**
 * Fondos provisionales. La bodega, el punto de venta y la bocamina (con su
 * letrero MINA CERO) son estructuras por piezas en world/structures.
 */
export function drawPlaceholderWorld(scene: Phaser.Scene): void {
  if (USE_PLACEHOLDER_BACKGROUNDS) drawPlaceholderBackgrounds(scene);
}
