import Phaser from 'phaser';
import { PALETTE as P, cssColor } from '../config/palette';
import type { FoodKind } from '../config/survival';

export const MINER_TEXTURE = 'top-down-miner';
export const DIRECTIONS = ['down', 'up', 'left', 'right'] as const;
export type MinerFacing = (typeof DIRECTIONS)[number];
export type MinerWork = 'pick' | 'shovel' | 'build';
type BodyPose =
  | 'idle'
  | 'pass-a'
  | 'step-a'
  | 'pass-b'
  | 'step-b'
  | 'ready'
  | 'lift'
  | 'reach'
  | 'bend'
  | 'mouth'
  | 'tired'
  | 'breath'
  | 'hurt'
  | 'flash';
const poses: readonly BodyPose[] = [
  'idle',
  'pass-a',
  'step-a',
  'pass-b',
  'step-b',
  'ready',
  'lift',
  'reach',
  'bend',
  'mouth',
  'tired',
  'breath',
  'hurt',
  'flash',
];
type Pixel = readonly [number, number];
type Rect = (color: number, x: number, y: number, w: number, h: number) => void;
const WIDTH = 16;
const HEIGHT = 24;

function hand(facing: MinerFacing, pose: BodyPose): Pixel {
  if (pose === 'mouth') {
    if (facing === 'up') return [11, 9];
    if (facing === 'down') return [9, 11];
    return [12, 10];
  }
  if (facing === 'up') {
    if (pose === 'lift') return [12, 5];
    if (pose === 'reach') return [9, 5];
    return [12, 12];
  }
  if (facing === 'down') {
    if (pose === 'lift') return [12, 8];
    if (pose === 'reach') return [8, 17];
    return [11, 16];
  }
  if (pose === 'lift') return [10, 7];
  if (pose === 'reach') return [14, 13];
  return [12, 15];
}

function pixelLine(
  rect: Rect,
  color: number,
  start: Pixel,
  end: Pixel,
  size = 1,
): void {
  const [x, y] = start;
  const dx = end[0] - x,
    dy = end[1] - y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let n = 0; n <= steps; n++)
    rect(
      color,
      x + Math.round((dx * n) / steps),
      y + Math.round((dy * n) / steps),
      size,
      size,
    );
}

function drawBody(rect: Rect, facing: MinerFacing, pose: BodyPose): void {
  const front = facing === 'down',
    back = facing === 'up',
    side = !front && !back;
  const hurt = pose === 'hurt' || pose === 'flash';
  const lean = pose === 'reach' || pose === 'bend';
  const crouch = lean || pose === 'tired' || pose === 'breath' || hurt;
  const step =
    pose === 'step-a'
      ? 2
      : pose === 'step-b'
        ? -2
        : pose === 'pass-a'
          ? 1
          : pose === 'pass-b'
            ? -1
            : 0;
  const sx = side ? (hurt ? -1 : lean ? 1 : 0) : 0;
  const sy =
    hurt && front
      ? -1
      : pose === 'breath' || (hurt && back)
        ? 2
        : crouch || Math.abs(step) === 1
          ? 1
          : 0;
  const paint: Rect = (color, x, y, w, h) =>
    rect(
      pose === 'flash' && color !== P.ink ? P.cream : color,
      x + sx,
      y + sy,
      w,
      h,
    );
  const arm = (from: Pixel, to: Pixel) => {
    pixelLine(paint, P.ink, from, to, 3);
    pixelLine(paint, P.sky, [from[0] + 1, from[1]], [to[0] + 1, to[1]], 2);
    paint(P.peach, to[0] + 1, to[1] + 1, 2, 2);
  };
  // El suelo y las botas mantienen su ancla mientras se inclina el torso.
  rect(P.slate, 3, 22, 10, 1);
  for (const [x, stride, far] of [
    [4, step, side],
    [9, -step, false],
  ] as const) {
    const bx = x + (side ? stride : 0);
    const by =
      (far ? 17 : 18) + (side ? 0 : Math.min(0, back ? -stride : stride));
    rect(P.ink, bx, by, 4, 4);
    rect(far ? P.stone : P.steel, bx + 1, by + 1, 2, 1);
  }
  const active =
    pose === 'ready' ||
    pose === 'lift' ||
    pose === 'reach' ||
    pose === 'bend' ||
    pose === 'mouth';
  const [hx, hy] = hand(facing, pose);
  if (back && active) arm([9, 12], [hx - sx - 1, hy - sy - 1]);
  if (!back) arm([4, 12], [side ? 4 - step : 2, 15 - (side ? 0 : step)]);
  paint(P.ink, 4, 11, side ? 8 : 9, 8);
  paint(P.sky, 5, 12, side ? 6 : 7, 6);
  paint(P.blue, 6, 12, side ? 3 : 5, 2);
  if (back) {
    paint(P.ink, 5, 12, 6, 6);
    paint(P.steel, 6, 13, 4, 4);
  }
  paint(P.ink, 3, 4, 11, 8);
  paint(P.ink, 5, 2, 7, 3);
  paint(P.sky, 4, 4, 9, 4);
  paint(P.blue, 5, 3, 6, 3);
  paint(P.mist, 5, 4, 3, 1);
  paint(P.blue, 3, 7, 11, 1);
  if (back) paint(P.sky, 5, 8, 7, 3);
  else {
    paint(P.peach, front ? 5 : 8, 9, front ? 7 : 5, 3);
    paint(P.ink, front ? 6 : 11, 9, 1, 1);
    if (front) paint(P.ink, 10, 9, 1, 1);
    if (pose === 'mouth') paint(P.ink, front ? 8 : 12, 11, 1, 1);
  }
  if (!back && active) arm([10, 12], [hx - sx - 1, hy - sy - 1]);
  else if (!active)
    arm([10, 12], [side ? 8 + step : 11, 14 + (side ? 0 : step)]);
}

export function prepareMinerArt(scene: Phaser.Scene): void {
  if (scene.textures.exists(MINER_TEXTURE)) return;
  const texture = scene.textures.createCanvas(
    MINER_TEXTURE,
    WIDTH * poses.length,
    HEIGHT * 4,
  )!;
  const ctx = texture.context;
  DIRECTIONS.forEach((facing, row) => {
    poses.forEach((pose, col) => {
      const x = col * WIDTH,
        y = row * HEIGHT;
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.rect(0, 0, WIDTH, HEIGHT);
      ctx.clip();
      if (facing === 'left') {
        ctx.translate(WIDTH, 0);
        ctx.scale(-1, 1);
      }
      drawBody(
        (color, left, top, w, h) => {
          ctx.fillStyle = cssColor(color);
          ctx.fillRect(left, top, w, h);
        },
        facing,
        pose,
      );
      ctx.restore();
      texture.add(`${facing}-${pose}`, 0, x, y, WIDTH, HEIGHT);
    });
    const frame = (pose: BodyPose) => ({
      key: MINER_TEXTURE,
      frame: `${facing}-${pose}`,
    });
    scene.anims.create({
      key: `top-down-idle-${facing}`,
      frames: [frame('idle')],
    });
    scene.anims.create({
      key: `top-down-walk-${facing}`,
      frames: (['step-a', 'pass-a', 'step-b', 'pass-b'] as const).map(frame),
      frameRate: 10,
      repeat: -1,
    });
    scene.anims.create({
      key: `top-down-tired-${facing}`,
      frames: [frame('tired'), frame('breath')],
      frameRate: 2,
      repeat: -1,
    });
  });
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

export const workPoses = ['ready', 'lift', 'reach', 'bend'] as const;

export function drawMinerProp(
  g: Phaser.GameObjects.Graphics,
  facing: MinerFacing,
  action: MinerWork | FoodKind,
  pose: BodyPose,
  raised = false,
): void {
  const rect: Rect = (color, x, y, w, h) => {
    g.fillStyle(color).fillRect(
      (facing === 'left' ? 16 - x - w : x) - 8,
      y - 24,
      w,
      h,
    );
  };
  g.clear();
  const [x, y] = hand(facing, pose);
  if (action === 'cola') {
    const angle = raised ? 1 : 0;
    rect(P.ink, x - 1, y - 4 + angle, 4, 6 - angle);
    rect(P.red, x, y - 3 + angle, 2, 4 - angle);
    rect(P.silver, x, y - 4 + angle, 2, 1);
    if (raised) rect(P.silver, x - 1, y - 3, 1, 1);
  } else if (
    action === 'sandwich' ||
    action === 'empanada' ||
    action === 'completo'
  ) {
    rect(P.ink, x - 2, y - 3, 5, 4);
    rect(P.gold, x - 1, y - 2, raised ? 2 : 3, 2);
    if (action === 'sandwich') rect(P.earth, x - 1, y - 1, 3, 1);
    if (action === 'completo') rect(P.mint, x - 1, y - 2, 3, 1);
  } else if (action === 'suavecilla' || action === 'terremoto') {
    // Paleta de helado o vaso, como la lata: se lleva a la boca.
    const top = action === 'suavecilla' ? P.dawnPink : P.gold;
    rect(P.ink, x - 1, y - 4, 4, 6);
    rect(top, x, y - 3, 2, 2);
    rect(action === 'suavecilla' ? P.cream : P.silver, x, y - 1, 2, 2);
  } else if (action === 'medkit') {
    rect(P.ink, x - 2, y - 3, 6, 5);
    rect(P.white, x - 1, y - 2, 4, 3);
    rect(P.red, x, y - 2, 2, 3);
  } else {
    const up = facing === 'up',
      down = facing === 'down';
    const length = action === 'build' ? 4 : action === 'shovel' ? 6 : 8;
    const lift = pose === 'lift';
    const dx = down ? (lift ? 4 : 0) : up ? (lift ? 3 : -1) : length;
    const dy =
      lift || up
        ? -length
        : down
          ? length
          : pose === 'reach'
            ? action === 'shovel'
              ? 2
              : 0
            : -3;
    const head: Pixel = [x + dx, y + dy];
    pixelLine(rect, P.ink, [x, y], head, 2);
    pixelLine(rect, P.clay, [x, y], head);
    const horizontal = up || down || lift;
    const [tx, ty] = head;
    const offset = action === 'pick' ? 3 : 2;
    const bx = tx - (horizontal ? offset : 1);
    const by = ty - (horizontal ? 1 : offset);
    rect(
      P.ink,
      bx,
      by,
      horizontal ? offset * 2 + 1 : 3,
      horizontal ? 3 : offset * 2 + 1,
    );
    rect(
      P.steel,
      bx + 1,
      by + 1,
      horizontal ? offset * 2 - 1 : 2,
      horizontal ? 2 : offset * 2 - 1,
    );
    rect(
      P.silver,
      bx + 1,
      by + 1,
      horizontal ? offset * 2 - 2 : 1,
      horizontal ? 1 : 2,
    );
    if (action === 'pick')
      rect(P.steel, horizontal ? bx : bx + 1, horizontal ? by + 2 : by, 1, 1);
    else if (action === 'shovel') {
      rect(
        P.steel,
        horizontal ? bx + 1 : bx + 2,
        horizontal ? by + 3 : by + 1,
        horizontal ? 3 : 2,
        horizontal ? 2 : 3,
      );
      rect(
        P.silver,
        horizontal ? bx + 2 : bx + 3,
        horizontal ? by + 3 : by + 2,
        1,
        1,
      );
    }
  }
  if (facing !== 'up') rect(P.peach, x, y, 2, 2);
}
