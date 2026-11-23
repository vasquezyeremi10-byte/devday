import Phaser from 'phaser';
import { biomeDef, type BiomeId } from '../config/biomes';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { CRITTER, CritterBrain, type CritterAnim } from '../systems/CritterBrain';
import { probeAhead, type SolidAt } from '../systems/GnomeSenses';

/**
 * Chinchillas del desierto (18 de noviembre de 2026): decoración en
 * movimiento, sin interacción, sin daño y sin guardado. Más chicas que el
 * minero (cuadros de 16 × 12, cuerpo físico de 8 × 6), dibujadas por código
 * con la paleta a partir de la referencia del usuario
 * (art/chinchilla/reference.webp): pelaje gris lavanda, orejas grandes y
 * rosadas, cola tupida, vientre claro y bigotes. Contorno de tinta de 1 px,
 * luz arriba-izquierda, sin alfa parcial.
 *
 * Solo se simulan cerca de la cámara; lejos quedan quietas e invisibles.
 */
const KEY = 'critter-chinchilla';
const FW = 16;
const FH = 12;

/** Cuadros de la hoja por animación (y su velocidad en cuadros/s). */
const ANIMS: Record<CritterAnim, { frames: number[]; fps: number }> = {
  idle: { frames: [0, 0, 0, 1, 0, 0], fps: 3 },
  sniff: { frames: [2, 3], fps: 6 },
  hop: { frames: [4, 5, 6, 7], fps: 9 },
  run: { frames: [8, 9, 10, 11], fps: 16 },
};

/**
 * Chinchilla en reposo, píxel a píxel (mirando a la derecha), 16 × 12:
 * k tinta, g pelaje, l luz, d sombra y cola, w vientre, p rosado (oreja,
 * nariz, patas), e ojo, s bigote. Los demás cuadros salen de este dibujo con
 * desplazamientos enteros (FRAMES).
 */
const BASE = [
  '..........kkk...',
  '.........kgppk..',
  '.........kgppk..',
  '.........kggpk..',
  '.....kkkkkggkkk.',
  '...kkgllgggggggk',
  '.kkdkgglgggggegk',
  'kdgdkggggggggggp',
  'kdgddkgdggggwwws',
  'kgdgdgggggggwwk.',
  '.kdgkdggggwwwwk.',
  '..kk.kpkkkkkpk..',
];

const COLORS: Record<string, number> = {
  k: P.ink,
  g: P.mauve,
  l: P.silver,
  d: P.plum,
  w: P.silver,
  p: P.dawnPink,
  e: P.ink,
  s: P.stone,
};

type Pixels = string[][];
const grid = (rows: readonly string[]): Pixels => rows.map((r) => [...r]);
const blank = (): Pixels => Array.from({ length: FH }, () => Array<string>(FW).fill('.'));

/** Copia desplazada (dx, dy) de unas filas y columnas del dibujo. */
function shifted(src: Pixels, dx: number, dy: number, from = 0, to = FH - 1, x0 = 0, x1 = FW - 1): Pixels {
  const out = src.map((r, y) => r.map((c, x) => (y >= from && y <= to && x >= x0 && x <= x1 ? '.' : c)));
  for (let y = from; y <= to; y++)
    for (let x = x0; x <= x1; x++) {
      const c = src[y]![x]!;
      const ty = y + dy,
        tx = x + dx;
      if (c !== '.' && ty >= 0 && ty < FH && tx >= 0 && tx < FW) out[ty]![tx] = c;
    }
  return out;
}

/** Cuerpo levantado `up` px con las patas según el tramo del salto. */
function hop(src: Pixels, up: number, legs: 'stand' | 'push' | 'tuck'): Pixels {
  const body = shifted(src, 0, -up, 0, FH - 2);
  const out = blank();
  for (let y = 0; y < FH - 1; y++) out[y] = [...body[y]!];
  const feet = out[FH - 1]!;
  if (up === 0) out[FH - 1] = [...src[FH - 1]!];
  else if (legs === 'push') {
    // Patas traseras estiradas hacia atrás, delanteras recogidas.
    feet[4] = 'p';
    feet[5] = 'k';
    out[FH - 2]![12] = 'p';
  } else if (legs === 'tuck') out[FH - 1 - up]![6] = 'p';
  return out;
}

/** Carrera: orejas pegadas atrás y cuerpo estirado un píxel. */
function stretched(src: Pixels): Pixels {
  const out = src.map((r) => {
    const row = [...r];
    row.splice(8, 0, row[8]!);
    row.shift();
    return row;
  });
  // Oreja inclinada hacia atrás (baja un píxel).
  return shifted(out, -1, 1, 0, 3, 8, 13);
}

const IDLE = grid(BASE);
const RUN = stretched(IDLE);
const FRAMES: Pixels[] = [
  IDLE,
  // Oreja que se mueve.
  shifted(IDLE, -1, 0, 0, 3, 8, 13),
  // Olfateo: la nariz se esconde y vuelve, el bigote tiembla.
  (() => {
    const f = grid(BASE);
    f[7]![15] = 'k';
    f[8]![15] = '.';
    return f;
  })(),
  IDLE,
  // Saltitos: agazapada, impulso, en el aire, aterrizaje.
  shifted(IDLE, 0, 1, 0, FH - 2),
  hop(IDLE, 1, 'push'),
  hop(IDLE, 2, 'tuck'),
  IDLE,
  // Carrera.
  shifted(RUN, 0, 1, 0, FH - 2),
  hop(RUN, 2, 'push'),
  hop(RUN, 3, 'tuck'),
  RUN,
];

function makeSheet(scene: Phaser.Scene): void {
  if (scene.textures.exists(KEY)) return;
  const texture = scene.textures.createCanvas(KEY, FW * FRAMES.length, FH)!;
  const ctx = texture.context;
  const data = ctx.createImageData(FW * FRAMES.length, FH);
  FRAMES.forEach((frame, f) => {
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const color = COLORS[frame[y]![x]!];
        if (color === undefined) continue;
        const i = (y * FW * FRAMES.length + f * FW + x) * 4;
        data.data[i] = (color >>> 16) & 255;
        data.data[i + 1] = (color >>> 8) & 255;
        data.data[i + 2] = color & 255;
        data.data[i + 3] = 255;
      }
    texture.add(f, 0, f * FW, 0, FW, FH);
  });
  ctx.putImageData(data, 0, 0);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Casas de las chinchillas: columna central por zona del desierto. */
export const CRITTER_HOMES: readonly { biome: BiomeId; column: number }[] = [
  { biome: 'hand', column: -104 },
  { biome: 'hand', column: -60 },
  { biome: 'desert', column: 96 },
  { biome: 'desert', column: 124 },
  { biome: 'pampa', column: 156 },
  { biome: 'pampa', column: 206 },
  { biome: 'fcab', column: 232 },
  { biome: 'fcab', column: 272 },
  { biome: 'huanchaca', column: 296 },
  { biome: 'huanchaca', column: 340 },
  { biome: 'hills', column: 366 },
  { biome: 'hills', column: 402 },
];

/** Distancia (px) a la cámara dentro de la que se simulan. */
const ACTIVE_RANGE = 640;

interface Critter {
  sprite: Phaser.Physics.Arcade.Sprite;
  brain: CritterBrain;
  clock: number;
  anim: CritterAnim;
}

export class Critters {
  private readonly list: Critter[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    colliders: Phaser.Tilemaps.TilemapLayer[],
    solid: SolidAt,
    private readonly puff: (x: number, y: number) => void,
  ) {
    makeSheet(scene);
    for (const home of CRITTER_HOMES) {
      // Dentro de su zona (con un bloque de margen) y sobre el suelo real.
      const zone = biomeDef(home.biome);
      const column = Math.max(zone.from + 1, Math.min(zone.to - 1, home.column));
      let row = 0;
      while (row < 40 && !solid(column, row)) row++;
      const x = column * TILE_SIZE + 8;
      const sprite = scene.physics.add.sprite(x, row * TILE_SIZE - FH / 2, KEY, 0);
      sprite
        .setDepth(DEPTH.characters - 0.5)
        .setSize(8, 6)
        .setOffset(4, FH - 6)
        .setDragX(600)
        .setCollideWorldBounds(true);
      for (const layer of colliders) scene.physics.add.collider(sprite, layer);
      this.list.push({ sprite, brain: new CritterBrain(x), clock: 0, anim: 'idle' });
    }
  }

  /** Cuántas hay y cuántas se ven (diagnóstico para pruebas). */
  get state(): { x: number; y: number; state: string; visible: boolean }[] {
    return this.list.map((c) => ({
      x: Math.round(c.sprite.x),
      y: Math.round(c.sprite.y),
      state: c.brain.state,
      visible: c.sprite.visible,
    }));
  }

  /** Detiene a todas (ventanas abiertas, pausa). */
  freeze(): void {
    for (const c of this.list) c.sprite.setVelocityX(0);
  }

  update(dtMs: number, miner: { x: number; y: number }, solid: SolidAt): void {
    const cam = this.scene.cameras.main;
    const center = cam.scrollX + cam.width / 2;
    for (const c of this.list) {
      const s = c.sprite;
      const body = s.body as Phaser.Physics.Arcade.Body;
      const active = Math.abs(s.x - center) < ACTIVE_RANGE;
      if (!active) {
        // Lejos de la cámara no se simulan: quietas, sin gravedad ni dibujo.
        if (body.enable) {
          body.setVelocity(0, 0);
          body.enable = false;
          s.setVisible(false);
        }
        continue;
      }
      if (!body.enable) {
        body.enable = true;
        s.setVisible(c.brain.state !== 'hidden');
      }
      const rect = { x: body.x, y: body.y, width: body.width, height: body.height };
      const out = c.brain.tick({
        dt: dtMs,
        x: body.center.x,
        grounded: body.blocked.down,
        miner: { dx: miner.x - body.center.x, dy: miner.y - body.bottom },
        left: probeAhead(solid, rect, -1),
        right: probeAhead(solid, rect, 1),
      });
      if (out.vanished) this.puff(body.center.x, body.bottom - 2);
      s.setVisible(out.visible);
      s.setVelocityX(out.visible ? out.vx : 0);
      if (out.jump && body.blocked.down) s.setVelocityY(CRITTER.jumpVelocity);
      s.setFlipX(out.facing < 0);
      if (out.anim !== c.anim) {
        c.anim = out.anim;
        c.clock = 0;
      }
      c.clock += dtMs;
      const a = ANIMS[out.anim];
      s.setFrame(a.frames[Math.floor((c.clock * a.fps) / 1000) % a.frames.length]!);
    }
  }
}
