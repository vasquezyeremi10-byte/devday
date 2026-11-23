import { describe, expect, it } from 'vitest';
import { SPLASH, shouldShowSplash, type SplashLogo } from '../config/splash';
import { coverMask, COVER_TILE_PX } from '../world/Dissolve';
import {
  buildTimeline,
  cuesBetween,
  itemAt,
  visibility,
  zoomFrame,
  type SplashConfig,
} from './SplashTimeline';

const sponsor = (key: string): SplashLogo => ({
  key,
  label: key.toUpperCase(),
  in: 400,
  hold: 1000,
  out: 400,
  sound: null,
  volume: 0.5,
});

describe('línea de tiempo de la introducción', () => {
  it('sigue el orden configurado y suma las duraciones', () => {
    const t = buildTimeline(SPLASH);
    const o = SPLASH.opening;
    const s = SPLASH.studio;
    expect(t.items.map((i) => i.kind)).toEqual(['pause', 'text', 'pause', 'logo', 'black']);
    const studioStart = o.pause + o.in + o.hold + o.out + o.gap;
    const studio = t.items[3]!;
    expect(studio.start).toBe(studioStart);
    expect(studio.end).toBe(studioStart + s.in + s.hold + s.out);
    expect(t.total).toBe(studio.end + SPLASH.transition.black);
  });

  it('el golpe del logotipo nace con su primera trama y el ambiente con el negro', () => {
    const t = buildTimeline(SPLASH);
    const studio = t.items.find((i) => i.kind === 'logo')!;
    const black = t.items.find((i) => i.kind === 'black')!;
    expect(t.cues).toEqual([
      { at: studio.start, key: SPLASH.studio.sound, volume: SPLASH.studio.volume, loop: false },
      {
        at: black.start,
        key: SPLASH.transition.ambience,
        volume: SPLASH.transition.ambienceVolume,
        loop: true,
      },
    ]);
    // Cada sonido se lanza una sola vez aunque los pasos sean irregulares.
    const fired = [-1, 16, 3249, 3251, 7000, 7760, 9000].reduce<string[]>(
      (acc, now, i, steps) =>
        i === 0 ? acc : [...acc, ...cuesBetween(t, steps[i - 1]!, now).map((c) => c.key)],
      [],
    );
    expect(fired).toEqual([SPLASH.studio.sound, SPLASH.transition.ambience]);
  });

  it('sin patrocinadores configurados la escena 3 no existe', () => {
    expect(SPLASH.sponsors).toHaveLength(0);
    const t = buildTimeline(SPLASH);
    expect(t.items.filter((i) => i.kind === 'logo' && !i.studio)).toHaveLength(0);
  });

  it('cada patrocinador real suma su etapa con su sonido o el de reserva', () => {
    const config: SplashConfig = {
      ...SPLASH,
      sponsors: [sponsor('a'), { ...sponsor('b'), sound: 'sfx-propio' }],
    };
    const t = buildTimeline(config);
    const logos = t.items.filter((i) => i.kind === 'logo' && !i.studio);
    expect(logos.map((i) => (i.kind === 'logo' ? i.logo.key : ''))).toEqual(['a', 'b']);
    expect(t.cues.map((c) => c.key)).toEqual([
      SPLASH.studio.sound,
      SPLASH.sponsorSound,
      'sfx-propio',
      SPLASH.transition.ambience,
    ]);
    expect(t.total).toBe(buildTimeline(SPLASH).total + 2 * 1800);
  });

  it('el orden de las etapas se puede cambiar', () => {
    const t = buildTimeline({ ...SPLASH, order: ['studio', 'transition'] });
    expect(t.items.map((i) => i.kind)).toEqual(['logo', 'black']);
    expect(t.cues[0]!.at).toBe(0);
    expect(cuesBetween(t, -1, 0).map((c) => c.key)).toEqual([SPLASH.studio.sound]);
  });

  it('la visibilidad sube, se mantiene y baja; pausas y negro no muestran nada', () => {
    const t = buildTimeline(SPLASH);
    const logo = t.items.find((i) => i.kind === 'logo')!;
    const s = SPLASH.studio;
    expect(visibility(logo, logo.start)).toBe(0);
    expect(visibility(logo, logo.start + s.in / 2)).toBeCloseTo(0.5);
    expect(visibility(logo, logo.start + s.in + 10)).toBe(1);
    expect(visibility(logo, logo.end - s.out / 2)).toBeCloseTo(0.5);
    expect(visibility(logo, logo.end)).toBe(0);
    expect(visibility(t.items[0]!, 100)).toBe(0);
    expect(itemAt(t, -1)).toBeNull();
    expect(itemAt(t, t.total)).toBeNull();
    expect(itemAt(t, logo.start + 1)).toBe(logo);
  });

  it('el zoom recorre todos los cuadros en orden, sin retroceder', () => {
    const t = buildTimeline(SPLASH);
    const logo = t.items.find((i) => i.kind === 'logo')!;
    const n = SPLASH.studio.logo.sizes.length;
    const frames = Array.from({ length: 200 }, (_, k) =>
      zoomFrame(logo, logo.start + ((logo.end - logo.start) * k) / 199, n),
    );
    expect(frames[0]).toBe(0);
    expect(frames.at(-1)).toBe(n - 1);
    expect(frames.every((f, i) => i === 0 || f >= frames[i - 1]!)).toBe(true);
    expect(new Set(frames).size).toBe(n);
  });

  it('cuadros del logotipo de 2 px en 2 px dentro del cuadro de la tira', () => {
    const { sizes, frame } = SPLASH.studio.logo;
    expect(Math.max(...sizes)).toBe(frame);
    expect(sizes.every((s, i) => i === 0 || s - sizes[i - 1]! === 2)).toBe(true);
  });
});

describe('cortina tramada', () => {
  it('cada nivel conserva los píxeles del anterior (sin parpadeo)', () => {
    let prev = coverMask(0);
    expect(prev.every((v) => v === 0)).toBe(true);
    for (let level = 1; level <= 64; level++) {
      const mask = coverMask(level);
      expect(mask.every((v, i) => v >= prev[i]!)).toBe(true);
      prev = mask;
    }
    expect(prev.every((v) => v === 1)).toBe(true);
    expect(prev).toHaveLength(COVER_TILE_PX * COVER_TILE_PX);
  });
});

describe('cuándo se muestra la introducción', () => {
  it('siempre en producción; en desarrollo salvo navegador automatizado', () => {
    expect(shouldShowSplash(false, true, '?splash=off')).toBe(true);
    expect(shouldShowSplash(true, false, '')).toBe(true);
    expect(shouldShowSplash(true, true, '')).toBe(false);
    expect(shouldShowSplash(true, true, '?splash=on')).toBe(true);
    expect(shouldShowSplash(true, false, '?splash=off')).toBe(false);
  });
});
