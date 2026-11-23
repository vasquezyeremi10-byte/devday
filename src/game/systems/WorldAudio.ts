import Phaser from 'phaser';
import { BIOMES, biomeBlend } from '../config/biomes';
import {
  OUTDOOR_AUDIO,
  WORLD_AUDIO,
  WORLD_AUDIO_LOOPS,
  worldAudioKey,
} from '../config/worldAudio';
import { loadDeferredMany } from './AssetLoader';

type Track = (typeof WORLD_AUDIO_LOOPS)[number];
type Sound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

export class WorldAudio {
  private readonly loops = new Map<Track, Sound>();
  private chirps?: Phaser.Sound.BaseSound;
  private untilChirp = 5500;

  constructor(private readonly scene: Phaser.Scene) {
    void loadDeferredMany(scene, WORLD_AUDIO.map(worldAudioKey));
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.pause, this);
    scene.events.on(Phaser.Scenes.Events.RESUME, this.resume, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(
    delta: number,
    x: number,
    sunStrength: number,
    zone: 'outdoors' | 'cabin' | 'mine',
  ): void {
    if (this.scene.sound.locked) return;
    const { a, t } = biomeBlend(x);
    const left = OUTDOOR_AUDIO[BIOMES[a]!.id];
    const right = OUTDOOR_AUDIO[BIOMES[a + 1]?.id ?? BIOMES[a]!.id];
    const outdoors = zone === 'outdoors' ? 1 : 0;
    const sun = Phaser.Math.SmoothStep(sunStrength, 0.15, 0.8);
    const targets: Record<Track, number> = {
      surface: zone === 'mine' ? 0 : zone === 'cabin' ? 0.18 : 0.26,
      mine: zone === 'mine' ? 0.31 : 0,
      birds: Phaser.Math.Linear(left[1], right[1], t) * sun * outdoors,
      wind: Phaser.Math.Linear(left[0], right[0], t) * outdoors,
      cave: zone === 'mine' ? 0.11 : 0,
      surf: Phaser.Math.Linear(left[2], right[2], t) * outdoors,
    };

    const blend = 1 - Math.exp(-Math.min(delta, 100) / 460);
    for (const track of WORLD_AUDIO_LOOPS) {
      const target = targets[track];
      const key = worldAudioKey(track);
      let sound = this.loops.get(track);
      if (!sound && target > 0.002 && this.scene.cache.audio.exists(key)) {
        sound = this.scene.sound.add(key, { loop: true, volume: 0 }) as Sound;
        this.loops.set(track, sound);
      }
      if (!sound) continue;
      const volume = Phaser.Math.Linear(sound.volume, target, blend);
      if (target === 0 && volume < 0.002) {
        if (sound.isPlaying) sound.stop();
        sound.setVolume(0);
      } else {
        if (!sound.isPlaying) sound.play({ volume });
        else sound.setVolume(volume);
      }
    }

    const chirpKey = worldAudioKey('chirps');
    if (!outdoors || sun < 0.3 || targets.birds > 0.1) {
      if (this.chirps?.isPlaying) this.chirps.stop();
      return;
    }
    this.untilChirp -= delta;
    if (this.untilChirp > 0 || !this.scene.cache.audio.exists(chirpKey)) return;
    this.chirps ??= this.scene.sound.add(chirpKey);
    this.chirps.play({ volume: 0.17 * sun });
    this.untilChirp = Phaser.Math.Between(17000, 30000);
  }

  private pause(): void {
    for (const sound of this.loops.values()) sound.pause();
    this.chirps?.stop();
  }

  private resume(): void {
    for (const sound of this.loops.values()) if (sound.isPaused) sound.resume();
  }

  private destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.pause, this);
    this.scene.events.off(Phaser.Scenes.Events.RESUME, this.resume, this);
    for (const sound of this.loops.values()) sound.destroy();
    this.loops.clear();
    this.chirps?.destroy();
  }
}
