import Phaser from 'phaser';
import { PALETTE as P, cssColor } from '../../config/palette';
import { buildParts, type Brush, type Part } from './PartsTexture';

/**
 * Arte original V3 dibujado por código con la paleta de 24 colores: íconos
 * de bodega e inventario, luces instalables, equipos de ventilación,
 * y dinamita. Sin alfa parcial ni antialiasing.
 */
const icon = (name: string, draw: (b: Brush) => void): Part => ({
  name,
  w: 16,
  h: 16,
  draw,
});

const gem = (name: string, [dark, mid, light]: [number, number, number]) =>
  icon(name, (b) => {
    b.rect(5, 2, 6, 12, P.ink);
    b.rect(3, 4, 10, 8, P.ink);
    b.rect(6, 3, 4, 10, mid);
    b.rect(4, 5, 8, 6, mid);
    b.rect(6, 3, 2, 4, light);
    b.rect(4, 5, 2, 2, light);
    b.rect(9, 9, 3, 2, dark);
    b.rect(7, 11, 3, 2, dark);
  });

/** Bloque isométrico plano de 12 × 12 px con contorno de tinta (V11). */
const blockIcon = (name: string, draw: (b: Brush) => void) =>
  icon(name, (b) => {
    b.rect(2, 2, 12, 12, P.ink);
    draw(b);
  });

export const ICONS: Part[] = [
  // V11: hacha y materiales de construcción.
  icon('axe', (b) => {
    for (let i = 0; i < 9; i++) b.rect(2 + i, 12 - i, 2, 2, P.ink);
    for (let i = 0; i < 9; i++) b.px(2 + i, 12 - i, P.clay);
    b.rect(8, 1, 7, 6, P.ink);
    b.rect(9, 2, 5, 4, P.steel);
    b.rect(9, 2, 5, 1, P.silver);
    b.rect(13, 3, 1, 3, P.slate);
    b.px(10, 3, P.white);
  }),
  blockIcon('mat_dirt', (b) => {
    b.rect(3, 3, 10, 10, P.soil);
    b.rect(3, 3, 10, 3, P.sand);
    b.rect(3, 3, 10, 1, P.desertSand);
    for (const [x, y] of [
      [4, 8],
      [8, 7],
      [11, 10],
      [6, 11],
    ] as const)
      b.rect(x, y, 2, 1, P.earth);
    b.px(10, 8, P.loam);
    b.px(5, 10, P.loam);
  }),
  blockIcon('mat_stone', (b) => {
    b.rect(3, 3, 10, 10, P.stone);
    b.rect(3, 3, 10, 1, P.steel);
    b.rect(3, 3, 1, 10, P.steel);
    b.rect(12, 4, 1, 9, P.slate);
    b.rect(4, 12, 9, 1, P.slate);
    b.rect(6, 6, 4, 1, P.slate);
    b.rect(9, 7, 1, 3, P.slate);
    b.px(5, 5, P.silver);
  }),
  blockIcon('mat_wood', (b) => {
    for (let i = 0; i < 3; i++) {
      const y = 3 + i * 3;
      b.rect(3, y, 10, 3, P.umber);
      b.rect(3, y, 10, 2, P.clay);
      b.rect(3, y, 10, 1, P.amber);
      b.px(4, y + 1, P.ink);
      b.px(11, y + 1, P.ink);
      b.rect(i % 2 ? 6 : 9, y, 1, 2, P.umber);
    }
  }),
  icon('drill', (b) => {
    b.rect(2, 5, 9, 6, P.ink);
    b.rect(3, 6, 7, 4, P.gold);
    b.rect(3, 6, 7, 1, P.cream);
    b.rect(4, 10, 3, 4, P.ink);
    b.rect(5, 10, 1, 3, P.umber);
    b.rect(10, 7, 5, 2, P.ink);
    b.rect(11, 7, 3, 1, P.silver);
    b.px(14, 8, P.steel);
  }),
  icon('wood_beam', (b) => {
    b.rect(2, 2, 12, 3, P.ink);
    b.rect(3, 3, 10, 1, P.clay);
    b.rect(3, 4, 3, 10, P.ink);
    b.rect(10, 4, 3, 10, P.ink);
    b.rect(4, 4, 1, 9, P.amber);
    b.rect(11, 4, 1, 9, P.earth);
  }),
  icon('steel_beam', (b) => {
    b.rect(2, 2, 12, 3, P.ink);
    b.rect(3, 3, 10, 1, P.silver);
    b.rect(3, 4, 3, 10, P.ink);
    b.rect(10, 4, 3, 10, P.ink);
    b.rect(4, 4, 1, 9, P.steel);
    b.rect(11, 4, 1, 9, P.slate);
    b.px(4, 6, P.white);
    b.px(11, 6, P.white);
  }),
  icon('torch', (b) => {
    b.rect(7, 7, 3, 8, P.ink);
    b.rect(8, 8, 1, 6, P.earth);
    b.rect(6, 2, 5, 6, P.ink);
    b.rect(7, 3, 3, 4, P.amber);
    b.rect(8, 3, 1, 2, P.cream);
  }),
  icon('lamp', (b) => {
    b.rect(3, 4, 10, 9, P.ink);
    b.rect(4, 5, 8, 7, P.steel);
    b.rect(5, 6, 6, 5, P.cream);
    b.rect(5, 6, 3, 2, P.white);
    b.rect(7, 2, 2, 2, P.ink);
  }),
  icon('industrial', (b) => {
    b.rect(1, 5, 14, 6, P.ink);
    b.rect(2, 6, 12, 2, P.slate);
    b.rect(2, 8, 12, 2, P.white);
    b.rect(7, 2, 2, 3, P.ink);
  }),
  icon('dynamite', (b) => {
    for (const x of [3, 7, 11]) {
      b.rect(x - 1, 4, 4, 10, P.ink);
      b.rect(x, 5, 2, 8, P.red);
      b.px(x, 5, P.peach);
    }
    b.rect(2, 8, 13, 1, P.umber);
    b.rect(8, 1, 1, 3, P.cream);
  }),
  icon('fuse', (b) => {
    b.line(2, 13, 6, 9, P.ink);
    b.line(6, 9, 10, 10, P.ink);
    b.line(10, 10, 13, 5, P.ink);
    b.line(3, 13, 7, 9, P.umber);
    b.rect(12, 2, 3, 3, P.gold);
    b.px(13, 3, P.white);
  }),
  icon('duct', (b) => {
    b.rect(0, 4, 16, 8, P.ink);
    b.rect(0, 5, 16, 6, P.steel);
    b.rect(0, 5, 16, 1, P.silver);
    b.rect(5, 4, 1, 8, P.slate);
    b.rect(11, 4, 1, 8, P.slate);
  }),
  icon('fan_aux', (b) => {
    b.rect(2, 2, 12, 12, P.ink);
    b.rect(3, 3, 10, 10, P.slate);
    b.rect(7, 3, 2, 10, P.silver);
    b.rect(3, 7, 10, 2, P.silver);
    b.rect(7, 7, 2, 2, P.gold);
  }),
  icon('fan_main', (b) => {
    b.rect(1, 1, 14, 14, P.ink);
    b.rect(2, 2, 12, 12, P.ochre);
    b.rect(2, 2, 12, 1, P.gold);
    b.rect(4, 4, 8, 8, P.ink);
    b.line(4, 4, 11, 11, P.silver);
    b.line(11, 4, 4, 11, P.silver);
    b.rect(7, 7, 2, 2, P.gold);
  }),
  icon('rail', (b) => {
    b.rect(0, 8, 16, 3, P.ink);
    b.rect(0, 8, 16, 1, P.silver);
    for (const x of [2, 7, 12]) b.rect(x, 11, 3, 3, P.earth);
  }),
  icon('rescue', (b) => {
    b.rect(2, 4, 12, 10, P.ink);
    b.rect(3, 5, 10, 8, P.cream);
    b.rect(7, 6, 2, 6, P.red);
    b.rect(5, 8, 6, 2, P.red);
  }),
  // V9: batería de repuesto para la linterna del casco.
  icon('battery', (b) => {
    b.rect(3, 3, 9, 11, P.ink);
    b.rect(6, 1, 3, 2, P.ink);
    b.rect(4, 4, 7, 9, P.slate);
    b.rect(4, 4, 7, 1, P.steel);
    b.rect(5, 6, 3, 5, P.lime);
    b.rect(8, 6, 2, 5, P.mint);
    b.px(5, 6, P.white);
    b.rect(11, 5, 2, 2, P.silver);
    b.rect(11, 9, 2, 2, P.steel);
  }),
  // EPP: casco con lámpara, gafas, chaleco, guantes, botas y protector.
  icon('ppe_helmet', (b) => {
    b.rect(3, 5, 10, 7, P.ink);
    b.rect(2, 10, 12, 3, P.ink);
    b.rect(4, 6, 8, 5, P.gold);
    b.rect(3, 11, 10, 1, P.amber);
    b.rect(5, 6, 3, 1, P.cream);
    b.rect(10, 7, 2, 2, P.white);
  }),
  icon('ppe_goggles', (b) => {
    b.rect(1, 6, 14, 5, P.ink);
    b.rect(2, 7, 5, 3, P.mist);
    b.rect(9, 7, 5, 3, P.mist);
    b.px(2, 7, P.white);
    b.px(9, 7, P.white);
    b.rect(7, 8, 2, 1, P.slate);
  }),
  icon('ppe_vest', (b) => {
    b.rect(3, 2, 10, 13, P.ink);
    b.rect(4, 3, 8, 11, P.amber);
    b.rect(7, 3, 2, 11, P.ink);
    b.rect(4, 8, 8, 2, P.silver);
    b.rect(7, 8, 2, 2, P.ink);
  }),
  icon('ppe_gloves', (b) => {
    b.rect(3, 4, 8, 10, P.ink);
    b.rect(4, 5, 6, 8, P.sand);
    b.rect(10, 7, 3, 4, P.ink);
    b.rect(10, 8, 2, 2, P.sand);
    b.rect(4, 11, 6, 1, P.clay);
  }),
  icon('ppe_boots', (b) => {
    b.rect(3, 2, 6, 12, P.ink);
    b.rect(3, 11, 11, 4, P.ink);
    b.rect(4, 3, 4, 9, P.earth);
    b.rect(4, 12, 9, 2, P.umber);
    b.rect(10, 12, 3, 2, P.steel);
  }),
  icon('ppe_ear', (b) => {
    b.rect(3, 3, 10, 2, P.ink);
    b.rect(2, 4, 2, 5, P.ink);
    b.rect(12, 4, 2, 5, P.ink);
    b.rect(1, 8, 4, 6, P.ink);
    b.rect(11, 8, 4, 6, P.ink);
    b.rect(2, 9, 2, 4, P.red);
    b.rect(12, 9, 2, 4, P.red);
  }),
  // Kit de seguridad: caja con casco encima.
  icon('kit', (b) => {
    b.rect(1, 7, 14, 8, P.ink);
    b.rect(2, 8, 12, 6, P.amber);
    b.rect(2, 10, 12, 1, P.silver);
    b.rect(4, 2, 8, 6, P.ink);
    b.rect(5, 3, 6, 4, P.gold);
    b.rect(5, 3, 2, 1, P.cream);
  }),
  // Modos: llave inglesa (desmontar) y martillo (construir).
  icon('wrench', (b) => {
    b.rect(9, 1, 6, 6, P.ink);
    b.rect(10, 2, 4, 4, P.silver);
    b.rect(11, 1, 2, 3, P.ink);
    for (let i = 0; i < 8; i++) b.rect(2 + i, 12 - i, 3, 3, P.ink);
    for (let i = 0; i < 8; i++) b.px(3 + i, 12 - i, P.steel);
  }),
  icon('hammer', (b) => {
    b.rect(3, 2, 10, 5, P.ink);
    b.rect(4, 3, 8, 3, P.steel);
    b.rect(4, 3, 8, 1, P.silver);
    b.rect(7, 7, 3, 8, P.ink);
    b.rect(8, 7, 1, 7, P.clay);
  }),
  // Corazones del HUD (9 × 8 dentro de la celda 16 × 16).
  ...(['full', 'half', 'empty'] as const).map((kind) =>
    icon(`heart_${kind}`, (b) => {
      const rows = [
        '01101100',
        '11111110',
        '11111110',
        '11111110',
        '01111100',
        '00111000',
        '00010000',
      ];
      rows.forEach((row, y) =>
        [...row].forEach((on, x) => {
          if (on !== '1') return;
          const left = x < 4;
          const fill = kind === 'full' || (kind === 'half' && left);
          // Vacío en pizarra: se distingue sobre el panel azul marino del HUD.
          b.px(x + 1, y + 1, fill ? P.red : P.slate);
        }),
      );
      // Contorno de tinta y brillo.
      rows.forEach((row, y) =>
        [...row].forEach((on, x) => {
          if (on !== '1') return;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const nx = x + dx,
              ny = y + dy;
            if (rows[ny]?.[nx] !== '1') b.px(nx + 1, ny + 1, P.ink);
          }
        }),
      );
      if (kind !== 'empty') b.px(2, 2, P.peach);
    }),
  ),
  icon('lock', (b) => {
    b.rect(5, 2, 6, 6, P.ink);
    b.rect(6, 3, 4, 5, P.night);
    b.rect(3, 7, 10, 7, P.ink);
    b.rect(4, 8, 8, 5, P.steel);
    b.rect(7, 9, 2, 3, P.ink);
  }),
  gem('emerald', [P.pine, P.teal, P.mint]),
  gem('ruby', [P.rust, P.red, P.peach]),
  gem('sapphire', [P.sky, P.blue, P.mist]),
  gem('diamond', [P.mist, P.white, P.white]),
  icon('alien_ore', (b) => {
    b.rect(3, 3, 10, 10, P.ink);
    b.rect(4, 4, 8, 8, P.pine);
    b.rect(5, 5, 6, 6, P.mint);
    b.rect(6, 6, 4, 4, P.teal);
    b.rect(7, 7, 2, 2, P.peach);
    b.px(5, 5, P.white);
  }),
  // Cristal violeta: prisma con contorno de tinta, cara clara y sombra.
  icon('violet_crystal', (b) => {
    b.rect(6, 2, 4, 2, P.ink);
    b.rect(4, 4, 8, 9, P.ink);
    b.rect(5, 4, 6, 8, P.duskViolet);
    b.rect(7, 3, 2, 1, P.mauve);
    b.rect(5, 5, 2, 5, P.mauve);
    b.rect(9, 8, 2, 4, P.plum);
    b.px(5, 5, P.white);
    b.px(7, 3, P.white);
  }),
];

/** Piezas del mundo: luces instaladas, carga de dinamita y barreno. */
const WORLD_PARTS: Part[] = [
  {
    name: 'lamp_mine',
    w: 9,
    h: 10,
    draw(b) {
      b.rect(3, 0, 3, 2, P.ink);
      b.rect(0, 2, 9, 8, P.ink);
      b.rect(1, 3, 7, 6, P.steel);
      b.rect(2, 4, 5, 4, P.cream);
      b.rect(2, 4, 2, 2, P.white);
    },
  },
  {
    name: 'lamp_industrial',
    w: 14,
    h: 6,
    draw(b) {
      b.rect(6, 0, 2, 2, P.ink);
      b.rect(0, 2, 14, 4, P.ink);
      b.rect(1, 3, 12, 1, P.slate);
      b.rect(1, 4, 12, 1, P.white);
    },
  },
  {
    name: 'charge',
    w: 6,
    h: 8,
    draw(b) {
      b.rect(0, 2, 6, 6, P.ink);
      b.rect(1, 3, 2, 4, P.red);
      b.rect(3, 3, 2, 4, P.rust);
      b.px(1, 3, P.peach);
      b.rect(2, 0, 1, 2, P.umber);
    },
  },
  {
    name: 'drill_hole',
    w: 5,
    h: 5,
    draw(b) {
      b.rect(1, 0, 3, 5, P.night);
      b.rect(0, 1, 5, 3, P.night);
      b.rect(1, 1, 3, 3, P.ink);
      b.px(1, 1, P.slate);
    },
  },
  {
    name: 'drill_tool',
    w: 10,
    h: 5,
    draw(b) {
      b.rect(0, 0, 6, 5, P.ink);
      b.rect(1, 1, 4, 3, P.gold);
      b.rect(1, 1, 4, 1, P.cream);
      b.rect(6, 1, 4, 3, P.ink);
      b.rect(6, 2, 3, 1, P.silver);
    },
  },
];

/** Hoja 16×16 de 4 cuadros: aspas del ventilador en rotación discreta. */
function fanSheet(scene: Phaser.Scene, key: string, frame: number): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, 64, 16)!;
  const ctx = tex.context;
  const px = (x: number, y: number, w: number, h: number, c: number) => {
    ctx.fillStyle = cssColor(c);
    ctx.fillRect(x, y, w, h);
  };
  for (let f = 0; f < 4; f++) {
    const o = f * 16;
    px(o + 1, 1, 14, 14, P.ink);
    px(o + 2, 2, 12, 12, frame);
    // Carcasa industrial: canto de luz, sombra, remaches y franja de aviso.
    px(o + 2, 2, 12, 1, P.steel);
    px(o + 2, 2, 1, 12, P.steel);
    px(o + 13, 3, 1, 11, P.night);
    for (const [rx, ry] of [
      [3, 3],
      [12, 3],
      [3, 12],
      [12, 12],
    ] as const)
      px(o + rx, ry, 1, 1, P.silver);
    for (let x = 5; x < 11; x++) px(o + x, 13, 1, 1, x % 2 ? P.gold : P.ink);
    px(o + 4, 4, 8, 8, P.ink);
    const blades =
      f % 2
        ? [
            [4, 4],
            [11, 11],
            [11, 4],
            [4, 11],
          ]
        : [
            [7, 3],
            [7, 12],
            [3, 7],
            [12, 7],
          ];
    for (const [x, y] of blades) {
      // Aspa: segmento de 2 px hacia el centro.
      const cx = 7.5,
        cy = 7.5;
      for (let t = 0; t <= 1; t += 0.25)
        px(
          o + Math.round(x! + (cx - x!) * t),
          Math.round(y! + (cy - y!) * t),
          1,
          1,
          f >= 2 ? P.silver : P.white,
        );
    }
    px(o + 7, 7, 2, 2, P.gold);
    px(o + 5, 15, 6, 1, P.ink);
  }
  tex.refresh();
  for (let f = 0; f < 4; f++) tex.add(f, 0, f * 16, 0, 16, 16);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

export function createV3Art(scene: Phaser.Scene): void {
  buildParts(scene, 'items-v3', ICONS);
  buildParts(scene, 'world-v3', WORLD_PARTS);
  fanSheet(scene, 'fan-aux', P.slate);
  fanSheet(scene, 'fan-main', P.ochre);
  const anim = (key: string, sheet: string, frames: number[], rate: number) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: frames.map((frame) => ({ key: sheet, frame })),
      frameRate: rate,
      repeat: -1,
    });
  };
  anim('fan-aux-spin', 'fan-aux', [0, 1, 2, 3], 12);
  anim('fan-main-spin', 'fan-main', [0, 1, 2, 3], 16);
}
