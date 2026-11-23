import { describe, expect, it } from 'vitest';
import { biomeSpan } from '../config/biomes';
import { VIEW } from '../config/constants';
import {
  LANDSCAPE,
  landscapeBounds,
  landscapeColumn,
  SEA_TOP,
} from './Landscape';

describe('Continuidad del paisaje del desierto', () => {
  it('las crestas no saltan al cruzar una región, una textura o el inicio del cabo', () => {
    for (const [layer, plane] of LANDSCAPE.entries()) {
      const [first, end] = landscapeBounds(plane);
      let maxStep = 0;
      let previous = Math.round(landscapeColumn(plane, layer, first).crest);
      for (let x = first + 1; x < end; x++) {
        const crest = Math.round(landscapeColumn(plane, layer, x).crest);
        maxStep = Math.max(maxStep, Math.abs(crest - previous));
        previous = crest;
      }
      expect(maxStep, plane.key).toBeLessThanOrEqual(4);
    }
  });

  it('el horizonte queda cubierto tierra adentro y las laderas bajan más allá de su base', () => {
    for (const [layer, plane] of LANDSCAPE.entries()) {
      const [, end] = landscapeBounds(plane);
      const start = end - plane.coast[1];
      let ended = false;
      for (let x = start; x <= end; x++) {
        const { crest } = landscapeColumn(plane, layer, x);
        const visible = Math.round(crest) < plane.bottom;
        if (ended) expect(visible, plane.key).toBe(false);
        ended ||= !visible;
      }
      expect(ended, plane.key).toBe(true);
      expect(landscapeColumn(plane, layer, end).crest).toBeGreaterThan(plane.bottom);
    }
    const far = LANDSCAPE[0]!;
    const [, end] = landscapeBounds(far);
    const shore = landscapeColumn(far, 0, end - far.coast[1]);
    expect(shore.crest).toBeLessThan(SEA_TOP);
  });

  it('el salitre aparece progresivamente al entrar en la pampa y disminuye al salir', () => {
    const layer = 2;
    const plane = LANDSCAPE[layer]!;
    const [start, end] = biomeSpan('pampa');
    const salt = (worldX: number) =>
      landscapeColumn(
        plane,
        layer,
        VIEW.width / 2 + (worldX - VIEW.width / 2) * plane.factor,
      ).salt;
    const center = salt((start + end) / 2);
    expect(salt(start)).toBeGreaterThan(salt(start - 300));
    expect(center).toBeGreaterThan(salt(start));
    expect(center).toBeGreaterThan(salt(end));
    expect(salt(end)).toBeGreaterThan(salt(end + 300));
  });
});
