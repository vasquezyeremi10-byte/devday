import { describe, expect, it } from 'vitest';
import { SPAWN } from '../config/constants';
import { introEnabled, INTRO_OBJECTIVES, INTRO_STEPS } from '../config/intro';
import { createInitialTerrain } from '../world/Geology';
import { GameSession } from './GameSession';
import { IntroProgress, type IntroContext } from './IntroProgress';
import { decodeSave, encodeSave } from './SaveSystem';

const none: IntroContext = { hasTools: false, kitReady: false, mined: 0 };

describe('Arranque de la secuencia', () => {
  it('en producción siempre; en desarrollo la omite un navegador automatizado', () => {
    expect(introEnabled(false, true, '?intro=off')).toBe(true);
    expect(introEnabled(true, true, '')).toBe(false);
    expect(introEnabled(true, false, '')).toBe(true);
    expect(introEnabled(true, true, '?intro=on')).toBe(true);
    expect(introEnabled(true, false, '?intro=off')).toBe(false);
  });
  it('un progreso nuevo no tiene tutorial hasta que start() lo inicia', () => {
    const p = new IntroProgress();
    expect(p.active).toBe(false);
    p.start();
    expect(p.step).toBe('welcome');
    expect(p.active).toBe(true);
  });
  it('cada paso tiene objetivo de una línea salvo bienvenida y final', () => {
    for (const step of INTRO_STEPS) {
      const text = INTRO_OBJECTIVES[step];
      if (step === 'welcome' || step === 'done') expect(text).toBe('');
      else expect(text.length).toBeGreaterThan(10);
      expect(text.length).toBeLessThanOrEqual(70);
    }
  });
});

describe('Avance de «La herencia del abuelo»', () => {
  it('recorre la secuencia completa en orden', () => {
    const p = new IntroProgress();
    p.start();
    expect(p.welcomeDone()).toBe(true);
    expect(p.step).toBe('tools');
    expect(p.toolsFound()).toBe(true);
    expect(p.step).toBe('kit');
    expect(p.update({ ...none, hasTools: true, kitReady: true })).toBe('mine');
    expect(p.mineInspected(3)).toBe(true);
    expect(p.step).toBe('dig');
    // Excavar lo ya excavado antes no cuenta: se mide desde que se inspeccionó.
    expect(p.update({ ...none, mined: 3 })).toBeNull();
    expect(p.update({ ...none, mined: 4 })).toBe('home');
    expect(p.cabinEntered()).toBe(true);
    expect(p.step).toBe('board');
    expect(p.boardExamined()).toBe(true);
    expect(p.step).toBe('book');
    expect(p.bookRead()).toBe(true);
    expect(p.step).toBe('done');
    expect(p.active).toBe(false);
    expect(p.completed).toBe(true);
  });
  it('la tabla del piso sigue el progreso y solo queda abierta si se jugó', () => {
    const p = new IntroProgress();
    expect(p.boardState).toBe('hidden');
    p.start();
    for (const step of [
      'welcome',
      'tools',
      'kit',
      'mine',
      'dig',
      'home',
    ] as const) {
      p.step = step;
      expect(p.boardState).toBe('hidden');
    }
    p.step = 'board';
    expect(p.boardState).toBe('loose');
    p.step = 'book';
    expect(p.boardState).toBe('open');
    p.bookRead();
    expect(p.boardState).toBe('open');
    const back = new IntroProgress();
    back.restore(JSON.parse(JSON.stringify(p.snapshot())));
    expect(back.boardState).toBe('open');
    // Una partida sin tutorial no muestra la tabla.
    const legacy = new IntroProgress();
    legacy.restore(undefined);
    expect(legacy.boardState).toBe('hidden');
  });
  it('los eventos fuera de orden no hacen nada', () => {
    const p = new IntroProgress();
    p.start();
    expect(p.boardExamined()).toBe(false);
    expect(p.bookRead()).toBe(false);
    expect(p.cabinEntered()).toBe(false);
    expect(p.mineInspected(0)).toBe(false);
    expect(p.step).toBe('welcome');
  });
  it('si ya tiene herramientas y equipo salta esos pasos de una vez', () => {
    const p = new IntroProgress();
    p.start();
    p.welcomeDone();
    expect(p.update({ hasTools: true, kitReady: true, mined: 0 })).toBe('mine');
  });
  it('un equipo completo sin herramientas se queda esperando el cajón', () => {
    const p = new IntroProgress();
    p.start();
    p.welcomeDone();
    expect(p.update({ ...none, kitReady: true })).toBeNull();
    expect(p.step).toBe('tools');
  });
  it('reached() compara posiciones en la secuencia', () => {
    const p = new IntroProgress();
    p.start();
    p.welcomeDone();
    expect(p.reached('welcome')).toBe(true);
    expect(p.reached('tools')).toBe(true);
    expect(p.reached('kit')).toBe(false);
  });
  it('la guía se puede ocultar y volver a mostrar', () => {
    const p = new IntroProgress();
    p.start();
    expect(p.toggleHints()).toBe(false);
    expect(p.hintsOff).toBe(true);
    expect(p.toggleHints()).toBe(true);
  });
});

describe('Guardado del tutorial', () => {
  it('snapshot y restore conservan paso, base de excavación y guía', () => {
    const a = new IntroProgress();
    a.start();
    a.welcomeDone();
    a.toolsFound();
    a.update({ hasTools: true, kitReady: true, mined: 0 });
    a.mineInspected(7);
    a.toggleHints();
    const b = new IntroProgress();
    b.restore(JSON.parse(JSON.stringify(a.snapshot())));
    expect(b.snapshot()).toEqual({
      step: 'dig',
      minedBase: 7,
      hintsOff: true,
      completed: false,
    });
  });
  it('datos ausentes o dañados significan sin tutorial', () => {
    for (const bad of [undefined, null, 5, {}, { step: 'nada' }, { step: 7 }]) {
      const p = new IntroProgress();
      p.start();
      p.restore(bad);
      expect(p.step).toBe('done');
    }
    const p = new IntroProgress();
    p.restore({ step: 'book', minedBase: -3, hintsOff: 'sí' });
    expect(p.snapshot()).toEqual({
      step: 'book',
      minedBase: 0,
      hintsOff: false,
      completed: false,
    });
  });
  it('viaja dentro de la partida guardada', () => {
    const s = new GameSession(createInitialTerrain());
    s.intro.start();
    s.intro.welcomeDone();
    const back = decodeSave(encodeSave(s, SPAWN))!;
    expect(back.session.intro.step).toBe('tools');
  });
  it('una partida guardada sin el campo (versión anterior) no inicia tutorial', () => {
    const s = new GameSession(createInitialTerrain());
    const data = JSON.parse(encodeSave(s, SPAWN));
    delete data.intro;
    expect(decodeSave(JSON.stringify(data))!.session.intro.step).toBe('done');
  });
});
