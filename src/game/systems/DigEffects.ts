import Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import { mineralInfo, type MineralKey } from '../config/minerals';
import { PALETTE as P } from '../config/palette';
import { EFFECTS, SOUNDS, type EffectKey } from '../data/assets';
import { pixelText } from '../ui/PixelFont';
import { Block, mineralOf } from '../world/TerrainGrid';

/** La hoja importada trae seis menas y seis pepitas, en este orden. */
const NUGGET_FRAME: Partial<Record<MineralKey, number>> = {
  coal: 6,
  copper: 7,
  iron: 8,
  gold: 10,
};

const CHIPS: Partial<Record<Block, readonly number[]>> = {
  [Block.Dirt]: [P.earth, P.clay, P.umber, P.sand],
  [Block.Rock]: [P.stone, P.slate, P.steel],
};

/**
 * Respuesta audiovisual de la excavación. Todo es consecuencia de un bloque
 * realmente retirado por MiningSystem; nada simula mecánicas inexistentes.
 * Sin alfa parcial: los fragmentos desaparecen de golpe al terminar su vida.
 */
export class DigEffects {
  private readonly chips: Phaser.GameObjects.Particles.ParticleEmitter;

  impact(x: number, y: number, soft = false, volume = 0.25): void {
    this.chips.setParticleTint(soft ? P.clay : P.silver);
    this.chips.explode(soft ? 4 : 2, Math.round(x), Math.round(y));
    this.sound(soft ? SOUNDS.shovel : SOUNDS.pick, volume);
  }

  /** Chispas de un golpe que conecta; sin sonido (la escena elige el suyo). */
  sparks(x: number, y: number): void {
    for (const color of [P.gold, P.cream, P.silver]) {
      this.chips.setParticleTint(color);
      this.chips.explode(2, Math.round(x), Math.round(y));
    }
  }

  /** Fragmentos y polvo de galería, con alcance de un tile. */
  galleryBreak(x: number, y: number, block: Block, soft: boolean): void {
    const mineral = mineralOf(block);
    const colors = mineral ? mineralInfo(mineral).chips : CHIPS[Block.Rock]!;
    for (const color of colors) {
      this.chips.setParticleTint(color);
      this.chips.explode(2, x, y);
    }
    this.chips.setParticleTint(soft ? P.clay : P.taupe);
    this.chips.explode(3, x, y + 3);
    this.sound(soft ? SOUNDS.shovel : SOUNDS.pick, 0.42);
    if (mineral) {
      this.floatText(x, y, `+1 ${mineralInfo(mineral).label}`, P.cream);
      this.sound(SOUNDS.collect, 0.3);
    }
  }

  /** Astillas de madera y hojas (hachazo o caída de un árbol). */
  woodChips(x: number, y: number, count = 8): void {
    for (const color of [P.clay, P.amber, P.earth, P.mint]) {
      this.chips.setParticleTint(color);
      this.chips.explode(Math.ceil(count / 4), Math.round(x), Math.round(y));
    }
    this.sound(SOUNDS.shovel, 0.35);
  }

  /** Texto flotante («+8 MADERA»); desaparece de golpe, sin alfa parcial. */
  floatText(x: number, y: number, text: string, color: number = P.cream): void {
    const label = pixelText(
      this.scene,
      Math.round(x) - Math.floor((text.length * 6) / 2),
      Math.round(y) - 14,
      text,
      color,
    ).setDepth(DEPTH.foreground + 1);
    this.scene.tweens.add({
      targets: label,
      y: label.y - 12,
      duration: 700,
      ease: 'Quad.easeOut',
      onUpdate: () => label.setY(Math.round(label.y)),
      onComplete: () => label.destroy(),
    });
  }

  broken(x: number, y: number): void {
    this.chips.setParticleTint(P.silver);
    this.chips.explode(12, x, y);
    this.sound(SOUNDS.pick, 0.65);
    this.sound(SOUNDS.collect, 0.3);
  }

  constructor(
    private readonly scene: Phaser.Scene,
    /** Posición de pantalla del contador de cada mineral en el HUD. */
    private readonly inventoryTarget: (key: MineralKey) => {
      x: number;
      y: number;
    },
  ) {
    if (!scene.textures.exists('chip')) {
      const texture = scene.textures.createCanvas('chip', 2, 2)!;
      texture.context.fillStyle = '#ffffff';
      texture.context.fillRect(0, 0, 2, 2);
      texture.refresh();
    }
    for (const [key, fx] of Object.entries(EFFECTS)) {
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(key, {
          start: 0,
          end: fx.frames - 1,
        }),
        frameRate: fx.fps,
        repeat: 0,
      });
    }
    this.chips = scene.add
      .particles(0, 0, 'chip', {
        speed: { min: 40, max: 110 },
        angle: { min: 200, max: 340 },
        gravityY: 420,
        lifespan: { min: 280, max: 520 },
        quantity: 0,
        emitting: false,
      })
      .setDepth(DEPTH.foreground);
  }

  /**
   * Bloque de un derrumbe que toca fondo o se parte: fragmentos del color de
   * su material, polvo si cayó con fuerza y un golpe grave.
   */
  rubbleImpact(x: number, y: number, block: Block, volume: number, dust: boolean): void {
    const mineral = mineralOf(block);
    const colors =
      CHIPS[block] ?? (mineral ? mineralInfo(mineral).chips : CHIPS[Block.Rock]!);
    for (const color of colors) {
      this.chips.setParticleTint(color);
      this.chips.explode(2, Math.round(x), Math.round(y));
    }
    if (dust) this.play('fx-dust', x, y);
    if (volume > 0 && this.scene.cache.audio.exists(SOUNDS.shovel[0]!))
      this.scene.sound.play(SOUNDS.shovel[0]!, {
        volume,
        rate: Phaser.Math.FloatBetween(0.42, 0.6),
      });
  }

  private play(key: EffectKey, x: number, y: number): void {
    const fx = EFFECTS[key];
    const sprite = this.scene.add
      .sprite(Math.round(x), Math.round(y), key, 0)
      .setOrigin(fx.originX, fx.originY)
      .setDepth(DEPTH.foreground);
    sprite
      .play(key)
      .once(Phaser.Animations.Events.ANIMATION_COMPLETE, () =>
        sprite.destroy(),
      );
  }

  private sound(keys: readonly string[], volume: number): void {
    const key = keys[Math.floor(Math.random() * keys.length)]!;
    if (this.scene.cache.audio.exists(key))
      this.scene.sound.play(key, { volume });
  }

  /** Destello, "+1" y la pepita viaja al contador del HUD. */
  collect(mineral: MineralKey, x: number, y: number): void {
    this.play('fx-collect', x, y + 10);
    this.sound(SOUNDS.collect, 0.35);
    const plus = pixelText(
      this.scene,
      Math.round(x) - 6,
      Math.round(y) - 14,
      '+1',
      P.cream,
    ).setDepth(DEPTH.foreground + 1);
    this.scene.tweens.add({
      targets: plus,
      y: plus.y - 10,
      duration: 500,
      ease: 'Quad.easeOut',
      onUpdate: () => plus.setY(Math.round(plus.y)),
      onComplete: () => plus.destroy(),
    });
    const camera = this.scene.cameras.main;
    const target = this.inventoryTarget(mineral);
    const frame = NUGGET_FRAME[mineral];
    const nugget = this.scene.add
      .image(
        Math.round(x - camera.scrollX),
        Math.round(y - camera.scrollY),
        frame === undefined ? 'items-v3' : 'mineral-items',
        frame ?? mineral,
      )
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 2);
    this.scene.tweens.add({
      targets: nugget,
      x: target.x,
      y: target.y,
      duration: 450,
      ease: 'Cubic.easeIn',
      onComplete: () => nugget.destroy(),
    });
  }
}
