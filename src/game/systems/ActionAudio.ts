import Phaser from 'phaser';
import {
  JUMP_SOUNDS,
  STEP_SOUNDS,
  actionAudioKey,
  type StepSurface,
} from '../config/actionAudio';
import { BALANCE } from '../config/balance';
import { FOODS, type FoodKind } from '../config/survival';

export function playFoodSound(scene: Phaser.Scene, kind: FoodKind): void {
  const drink = FOODS[kind].drink;
  const key = actionAudioKey(drink ? 'drink' : 'eat');
  if (!scene.sound.locked && scene.cache.audio.exists(key))
    scene.sound.play(key, { volume: drink ? 0.54 : 0.48 });
}

const STEP_VOLUME: Record<StepSurface, number> = {
  dirt: 0.28,
  gravel: 0.25,
  stone: 0.23,
  metal: 0.2,
  wood: 0.24,
  leaves: 0.23,
};

export class FootstepAudio {
  private distance = 14;
  private step = 0;
  private jumpIndex = 0;
  private readonly active = new Set<Phaser.Sound.BaseSound>();
  private readonly echo?: { input: GainNode; nodes: AudioNode[] };

  constructor(private readonly scene: Phaser.Scene) {
    const manager = scene.sound;
    if (manager instanceof Phaser.Sound.WebAudioSoundManager) {
      const { context, destination } = manager;
      const input = context.createGain();
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1700;
      input.connect(filter);
      const nodes: AudioNode[] = [input, filter];
      // Reflexiones cortas de galería; el sonido directo conserva su ataque.
      for (const [time, level] of [
        [0.083, 0.2],
        [0.157, 0.12],
        [0.266, 0.07],
      ] as const) {
        const delay = context.createDelay(0.4);
        const gain = context.createGain();
        delay.delayTime.value = time;
        gain.gain.value = level;
        filter.connect(delay);
        delay.connect(gain);
        gain.connect(destination);
        nodes.push(delay, gain);
      }
      this.echo = { input, nodes };
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private play(key: string, volume: number, rate: number, mine: boolean): void {
    if (this.scene.sound.locked || !this.scene.cache.audio.exists(key)) return;
    const sound = this.scene.sound.add(key, { volume, rate });
    if (mine && this.echo && sound instanceof Phaser.Sound.WebAudioSound)
      sound.volumeNode.connect(this.echo.input);
    this.active.add(sound);
    sound.once(Phaser.Sound.Events.COMPLETE, () => {
      this.active.delete(sound);
      sound.destroy();
    });
    if (!sound.play()) {
      this.active.delete(sound);
      sound.destroy();
    }
  }

  advance(
    pixels: number,
    surface: StepSurface,
    running = false,
    mine = false,
  ): void {
    // Un salto de posición por rescate o transición no cuenta como una zancada.
    if (pixels <= 0 || pixels > 24 || this.scene.sound.locked) return;
    const stride = running ? 52 : 44;
    this.distance += pixels;
    if (this.distance < stride) return;
    this.distance -= stride;
    const clips = STEP_SOUNDS[surface];
    const key = actionAudioKey(clips[this.step++ % clips.length]!);
    this.play(
      key,
      STEP_VOLUME[surface] + (running ? 0.07 : 0),
      Phaser.Math.FloatBetween(0.97, 1.03),
      mine,
    );
  }

  jump(mine: boolean): void {
    const clip = JUMP_SOUNDS[this.jumpIndex++ % JUMP_SOUNDS.length]!;
    this.play(actionAudioKey(clip), 0.38, 1, mine);
  }

  private destroy(): void {
    for (const sound of this.active) sound.destroy();
    this.active.clear();
    for (const node of this.echo?.nodes ?? []) node.disconnect();
  }
}

type CartSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
const CART_KEY = actionAudioKey('cart-rolling');

export class CartRollingAudio {
  private sound?: CartSound;
  private gain = 0;

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.stop, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.PAUSE, this.stop, this);
      this.sound?.destroy();
    });
  }

  update(deltaMs: number, travelled: number): void {
    if (
      deltaMs <= 0 ||
      this.scene.sound.locked ||
      !this.scene.cache.audio.exists(CART_KEY)
    )
      return;
    const speed = Math.abs(travelled) / (deltaMs / 1000);
    const motion = Math.min(speed / BALANCE.cartSpeed, 1);
    const target = speed > 2 ? 0.12 + motion * 0.22 : 0;
    this.gain = Phaser.Math.Linear(
      this.gain,
      target,
      1 - Math.exp(-deltaMs / 65),
    );
    if (!target && this.gain < 0.006) {
      this.stop();
      return;
    }
    this.sound ??= this.scene.sound.add(CART_KEY, {
      loop: true,
      volume: 0,
    }) as CartSound;
    // Una rueda lenta conserva el tono de su último movimiento mientras se apaga.
    const rate = target ? 0.76 + motion * 0.3 : this.sound.rate;
    if (this.sound.isPlaying) this.sound.setVolume(this.gain).setRate(rate);
    else this.sound.play({ volume: this.gain, rate });
  }

  stop(): void {
    this.gain = 0;
    if (this.sound?.isPlaying) this.sound.stop();
  }
}
