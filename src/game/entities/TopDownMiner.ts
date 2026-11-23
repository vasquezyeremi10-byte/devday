import Phaser from 'phaser';
import { PLAYER } from '../config/constants';
import type { FoodKind } from '../config/survival';
import type { StepSurface } from '../config/actionAudio';
import { FootstepAudio, playFoodSound } from '../systems/ActionAudio';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { SPRINT } from '../config/sprint';
import { smallText } from '../ui/PixelFont';
import {
  drawMinerProp,
  MINER_TEXTURE,
  prepareMinerArt,
  workPoses,
  type MinerFacing,
  type MinerWork,
} from './TopDownMinerArt';

const ACCELERATION = 900;
const GESTURE_MS = { build: 330, food: 780, hurt: 210 } as const;

function facingTowards(
  x: number,
  y: number,
  fallback: MinerFacing,
): MinerFacing {
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right';
  if (y) return y < 0 ? 'up' : 'down';
  return fallback;
}

export class TopDownMiner extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: Record<
    'w' | 'a' | 's' | 'd',
    Phaser.Input.Keyboard.Key
  >;
  private readonly desired = new Phaser.Math.Vector2();
  private readonly velocity = new Phaser.Math.Vector2();
  private readonly change = new Phaser.Math.Vector2();
  private facing: MinerFacing = 'down';
  private sprintHeld = false;
  private readonly sprintKey: Phaser.Input.Keyboard.Key;

  private readonly prop: Phaser.GameObjects.Graphics;
  private readonly footsteps: FootstepAudio;
  private walking = false;
  private motionTimeScale = 1;
  private meal?: { kind: FoodKind; at: number };
  private building?: { facing: MinerFacing; at: number };
  private hurtAt = -Infinity;
  private previousHealth?: number;
  private propKey = '';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly stepSurface: StepSurface = 'dirt',
    private readonly reverberant = false,
  ) {
    prepareMinerArt(scene);
    super(scene, x, y, MINER_TEXTURE, 'down-idle');
    this.footsteps = new FootstepAudio(scene);
    scene.add.existing(this);
    this.prop = scene.add.graphics().setVisible(false);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1)
      .setSize(10, 6)
      .setOffset(3, 18)
      .setCollideWorldBounds(true);
    this.body.setAllowGravity(false);
    this.setDepth(y);
    const keyboard = scene.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys({
      w: 'W',
      a: 'A',
      s: 'S',
      d: 'D',
    }) as typeof this.keys;
    // Sprint con Shift izquierdo (ver SPRINT); 'SHIFT' responde a ambos.
    this.sprintKey = keyboard.addKey('SHIFT', false);
    this.sprintKey.on('down', (_k: unknown, e?: KeyboardEvent) => {
      if (e?.code === SPRINT.code) this.sprintHeld = true;
    });
    this.sprintKey.on('up', (_k: unknown, e?: KeyboardEvent) => {
      if (e?.code === SPRINT.code) this.sprintHeld = false;
    });
    this.play('top-down-idle-down');
  }

  get aim(): { x: number; y: number } {
    return {
      x: Number(this.facing === 'right') - Number(this.facing === 'left'),
      y: Number(this.facing === 'down') - Number(this.facing === 'up'),
    };
  }

  face(x: number, y: number): void {
    this.facing = facingTowards(x, y, this.facing);
  }

  step(delta: number, enabled = true, speedFactor = 1, pushing = false, cardinal = false): void {
    if (!enabled) {
      this.velocity.set(0, 0);
      this.setVelocity(0, 0);
      this.walking = pushing;
      this.motionTimeScale = 1;
      return;
    }
    const { keys, cursors } = this;
    let x =
      Number(keys.d.isDown || cursors.right.isDown) -
      Number(keys.a.isDown || cursors.left.isDown);
    const y =
      Number(keys.s.isDown || cursors.down.isDown) -
      Number(keys.w.isDown || cursors.up.isDown);
    if (cardinal && y) x = 0;
    if (cardinal && x) this.velocity.y = 0;
    if (cardinal && y) this.velocity.x = 0;
    // Sprint: solo con avance y Shift izquierdo mantenido; no cambia la aceleración.
    const sprint =
      (x || y) && this.sprintHeld && this.sprintKey.isDown ? SPRINT.factor : 1;
    this.desired
      .set(x, y)
      .normalize()
      .scale(PLAYER.speed * speedFactor * sprint);
    this.change.copy(this.desired).subtract(this.velocity);
    this.change.limit(ACCELERATION * (Math.min(delta, 50) / 1000));
    this.velocity.add(this.change);
    this.setVelocity(this.velocity.x, this.velocity.y);

    if (y) this.facing = y < 0 ? 'up' : 'down';
    else if (x) this.facing = x < 0 ? 'left' : 'right';
    const { blocked } = this.body;
    const movingX =
      this.velocity.x < -4
        ? !blocked.left
        : this.velocity.x > 4 && !blocked.right;
    const movingY =
      this.velocity.y < -4 ? !blocked.up : this.velocity.y > 4 && !blocked.down;
    this.walking = movingX || movingY;
    if (this.walking)
      this.footsteps.advance(
        Math.hypot(this.body.deltaXFinal(), this.body.deltaYFinal()),
        this.stepSurface,
        sprint !== 1,
        this.reverberant,
      );
    // Los cuadros de caminata avanzan más deprisa al correr.
    this.motionTimeScale = speedFactor * sprint;
    this.setDepth(Math.round(this.body.bottom));
  }
  eat(kind: FoodKind, now: number, message?: string): void {
    playFoodSound(this.scene, kind);
    this.meal = { kind, at: now };
    if (!message) return;
    const label = smallText(
      this.scene,
      Math.round(this.x),
      Math.round(this.y) - 25,
      message,
      kind === 'cola' ? P.gold : P.mint,
    )
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.worldUi);
    this.scene.tweens.add({
      targets: label,
      y: label.y - 10,
      duration: 680,
      onUpdate: (tween) => {
        label.setY(Math.round(label.y));
        if (tween.progress > 0.75)
          label.setAlpha(1 - (tween.progress - 0.75) * 4);
      },
      onComplete: () => label.destroy(),
    });
  }

  build(now: number, dx: number, dy: number): void {
    this.building = { facing: facingTowards(dx, dy, this.facing), at: now };
  }

  present(
    now: number,
    options: {
      work?: { kind: MinerWork; phase: number };
      tired?: boolean;
      hp?: number;
      suspended?: boolean;
    } = {},
  ): void {
    const { work, tired, hp, suspended } = options;
    if (hp !== undefined) {
      if (hp < (this.previousHealth ?? hp) && now - this.hurtAt >= 600)
        this.hurtAt = now;
      this.previousHealth = hp;
    }
    const hit = now - this.hurtAt;
    if (this.meal && now - this.meal.at >= GESTURE_MS.food)
      this.meal = undefined;
    if (this.building && now - this.building.at >= GESTURE_MS.build)
      this.building = undefined;
    if (suspended) {
      this.meal = undefined;
      this.building = undefined;
    }
    const building = suspended || work ? undefined : this.building;
    const action =
      work ??
      (building && {
        kind: 'build' as const,
        phase: [1, 1, 2, 2, 3, 0][Math.floor((now - building.at) / 55)]!,
      });
    const eating = suspended ? undefined : this.meal;
    if (!suspended && hp !== undefined && hp <= 0) this.pose('hurt');
    else if (!suspended && hit < GESTURE_MS.hurt)
      this.pose(hit < 85 ? 'flash' : 'hurt');
    else if (action)
      this.pose(
        workPoses[action.phase]!,
        action.kind,
        building?.facing ?? this.facing,
      );
    else if (eating) {
      const stage = Math.floor((now - eating.at) / 100);
      const raised = stage >= 2 && stage <= 5;
      this.pose(
        raised ? 'mouth' : 'bend',
        eating.kind,
        this.facing,
        raised && (eating.kind === 'cola' || stage % 2 === 0),
      );
    } else {
      this.prop.setVisible(false);
      this.play(
        `top-down-${this.walking ? 'walk' : tired && !suspended ? 'tired' : 'idle'}-${this.facing}`,
        true,
      );
      this.anims.timeScale = this.walking ? this.motionTimeScale : 1;
    }
  }

  private pose(
    pose: Parameters<typeof drawMinerProp>[3],
    prop?: Parameters<typeof drawMinerProp>[2],
    facing = this.facing,
    raised = false,
  ): void {
    this.stop().setFrame(`${facing}-${pose}`, false, false);
    this.prop.setVisible(!!prop && this.visible);
    if (!prop) return;
    const key = `${facing}:${prop}:${pose}:${raised}`;
    if (key !== this.propKey) {
      this.propKey = key;
      drawMinerProp(this.prop, facing, prop, pose, raised);
    }
    this.prop
      .setPosition(Math.round(this.x), Math.round(this.y))
      .setDepth(this.depth + (facing === 'up' ? -0.0001 : 0.0001));
  }
}
