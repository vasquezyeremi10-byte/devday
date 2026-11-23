import type { SplashLogo, SplashStage } from '../config/splash';

/**
 * Línea de tiempo pura de la introducción del estudio: arma la secuencia de
 * etapas a partir de la configuración y responde, para cualquier instante,
 * qué se ve y cuánto. La escena solo dibuja lo que esto calcula a partir del
 * tiempo transcurrido, así las animaciones no dependen de los FPS.
 */
export interface SplashConfig {
  order: readonly SplashStage[];
  opening: {
    pause: number;
    text: string;
    in: number;
    hold: number;
    out: number;
    gap: number;
  };
  studio: SplashLogo;
  sponsors: readonly SplashLogo[];
  sponsorSound: string;
  transition: { black: number; ambience: string; ambienceVolume: number };
}

interface Span {
  start: number;
  end: number;
}
interface Fading extends Span {
  in: number;
  hold: number;
  out: number;
}
export type SplashItem =
  | (Span & { kind: 'pause' })
  | (Fading & { kind: 'text'; text: string })
  | (Fading & { kind: 'logo'; logo: SplashLogo; studio: boolean })
  | (Span & { kind: 'black' });

/** Sonido que debe empezar en el instante `at` (una sola vez). */
export interface SplashCue {
  at: number;
  key: string;
  volume: number;
  loop: boolean;
}

export interface SplashTimeline {
  items: SplashItem[];
  cues: SplashCue[];
  total: number;
}

export function buildTimeline(config: SplashConfig): SplashTimeline {
  const items: SplashItem[] = [];
  const cues: SplashCue[] = [];
  let t = 0;
  const fading = (d: { in: number; hold: number; out: number }) => {
    const span = { start: t, end: t + d.in + d.hold + d.out, ...d };
    t = span.end;
    return span;
  };
  const logo = (l: SplashLogo, studio: boolean, fallback: string | null) => {
    const item: SplashItem = { kind: 'logo', logo: l, studio, ...fading(l) };
    const sound = l.sound ?? fallback;
    // El sonido nace con la primera trama del logotipo.
    if (sound) cues.push({ at: item.start, key: sound, volume: l.volume, loop: false });
    items.push(item);
  };
  for (const stage of config.order) {
    if (stage === 'opening') {
      const o = config.opening;
      items.push({ kind: 'pause', start: t, end: t + o.pause });
      t += o.pause;
      items.push({ kind: 'text', text: o.text, ...fading(o) });
      if (o.gap > 0) {
        items.push({ kind: 'pause', start: t, end: t + o.gap });
        t += o.gap;
      }
    } else if (stage === 'studio') logo(config.studio, true, null);
    else if (stage === 'sponsors')
      // Sin logotipos configurados la escena no existe: no se inventa nada.
      for (const s of config.sponsors) logo(s, false, config.sponsorSound);
    else {
      const tr = config.transition;
      cues.push({
        at: t,
        key: tr.ambience,
        volume: tr.ambienceVolume,
        loop: true,
      });
      items.push({ kind: 'black', start: t, end: t + tr.black });
      t += tr.black;
    }
  }
  return { items, cues, total: t };
}

/** Etapa en curso en el instante t (null antes del inicio o tras el final). */
export function itemAt(timeline: SplashTimeline, t: number): SplashItem | null {
  if (t < 0 || t >= timeline.total) return null;
  return timeline.items.find((i) => t >= i.start && t < i.end) ?? null;
}

/** Visibilidad 0..1: sube durante `in`, se mantiene y baja durante `out`. */
export function visibility(item: SplashItem, t: number): number {
  if (item.kind === 'pause' || item.kind === 'black') return 0;
  const local = t - item.start;
  if (local < 0 || local >= item.end - item.start) return 0;
  if (local < item.in) return item.in > 0 ? local / item.in : 1;
  if (local < item.in + item.hold) return 1;
  return Math.max(0, 1 - (local - item.in - item.hold) / Math.max(1, item.out));
}

/** Cuadro del zoom (0..frames−1) según el avance de toda la etapa. */
export function zoomFrame(item: SplashItem, t: number, frames: number): number {
  const length = Math.max(1, item.end - item.start);
  const progress = Math.max(0, Math.min(0.999999, (t - item.start) / length));
  return Math.min(frames - 1, Math.floor(progress * frames));
}

/** Cues que caen en (from, to]: los sonidos a lanzar en este paso. */
export function cuesBetween(
  timeline: SplashTimeline,
  from: number,
  to: number,
): SplashCue[] {
  return timeline.cues.filter((c) => c.at > from && c.at <= to);
}
