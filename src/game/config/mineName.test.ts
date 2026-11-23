import { describe, expect, it } from 'vitest';
import { createInitialTerrain } from '../world/Geology';
import { GameSession } from '../systems/GameSession';
import { decodeSave, encodeSave } from '../systems/SaveSystem';
import {
  DEFAULT_MINE_NAME,
  MINE_NAME_MAX,
  nameChar,
  sanitizeMineName,
} from './mineName';

describe('Nombre de la mina', () => {
  it('admite letras, Ñ, tildes y espacio; rechaza dígitos y símbolos', () => {
    expect(nameChar('a')).toBe('A');
    expect(nameChar('ñ')).toBe('Ñ');
    expect(nameChar('é')).toBe('É');
    expect(nameChar(' ')).toBe(' ');
    expect(nameChar('1')).toBeNull();
    expect(nameChar('$')).toBeNull();
    expect(nameChar('Enter')).toBeNull();
  });
  it('nunca supera 10 caracteres y vacío vuelve a MINA CERO', () => {
    expect(MINE_NAME_MAX).toBe(10);
    expect(sanitizeMineName('la esperanza del norte')).toBe('LA ESPERAN');
    expect(sanitizeMineName('  el   cobre ')).toBe('EL COBRE');
    expect(sanitizeMineName('')).toBe(DEFAULT_MINE_NAME);
    expect(sanitizeMineName('123')).toBe(DEFAULT_MINE_NAME);
    expect(sanitizeMineName(42)).toBe(DEFAULT_MINE_NAME);
    for (const raw of ['ABCDEFGHIJKLMNOP', 'Ñandú Ñandú Ñandú'])
      expect(sanitizeMineName(raw).length).toBeLessThanOrEqual(10);
  });
  it('se guarda y se recupera con la partida', () => {
    const s = new GameSession(createInitialTerrain());
    s.mineName = 'SAN JOSÉ';
    const back = decodeSave(encodeSave(s, { x: 208, y: 148 }))!;
    expect(back.session.mineName).toBe('SAN JOSÉ');
  });
  it('una partida guardada sin nombre conserva MINA CERO', () => {
    const s = new GameSession(createInitialTerrain());
    const data = JSON.parse(encodeSave(s, { x: 208, y: 148 }));
    delete data.v4.mineName;
    expect(decodeSave(JSON.stringify(data))!.session.mineName).toBe(
      DEFAULT_MINE_NAME,
    );
  });
});
