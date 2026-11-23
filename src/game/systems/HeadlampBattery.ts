import { LIGHTING } from '../config/lighting';

export interface HeadlampSnapshot {
  /** Carga 0..100, con dos decimales de precisión al guardar. */
  charge: number;
  /** Interruptor manual de la linterna (tecla configurable). */
  on: boolean;
}

/**
 * V9: batería de la linterna del casco (lógica pura, sin Phaser). La carga
 * baja solo con el haz encendido y en proporción al tiempo transcurrido
 * (delta), sin importar los FPS; los menús y pausas no la consumen porque
 * la escena no la hace avanzar. Al llegar a 0 el haz se apaga del todo y
 * con un repuesto se restaura a 100 (un repuesto exacto por cambio).
 */
export class HeadlampBattery {
  charge: number = 100;
  /** La linterna se enciende sola al entrar a la mina; apagada a mano se queda apagada. */
  on = true;
  /** Avisos pendientes (los consume la escena, uno por cruce de umbral). */
  private lowPending = false;
  private drainedPending = false;

  /** Sin carga: el haz se apaga por completo, aunque el interruptor siga en «on». */
  get empty(): boolean {
    return this.charge <= 0;
  }
  /** Carga en el umbral de advertencia o menos, sin estar agotada. */
  get low(): boolean {
    return this.charge > 0 && this.charge <= LIGHTING.battery.warnAt;
  }
  /** Fracción 0..1 para indicadores y barras. */
  get fraction(): number {
    return Math.max(0, Math.min(1, this.charge / 100));
  }
  /** Porcentaje entero mostrado en el HUD (0..100). */
  get percent(): number {
    return Math.round(this.fraction * 100);
  }

  /**
   * Uso efectivo: `burning` significa haz encendido de verdad. Con la
   * linterna apagada, sin casco o a plena luz del día, no gasta nada.
   */
  tick(dtMs: number, burning: boolean): void {
    if (!(dtMs > 0) || !burning || this.charge <= 0) return;
    const before = this.charge;
    this.charge = Math.max(
      0,
      this.charge - (dtMs / LIGHTING.battery.durationMs) * 100,
    );
    if (before > LIGHTING.battery.warnAt && this.low) this.lowPending = true;
    if (before > 0 && this.empty) this.drainedPending = true;
  }

  /** Un aviso por cruce del umbral de advertencia (se rearma al reemplazar). */
  takeLowNotice(): boolean {
    if (!this.lowPending) return false;
    this.lowPending = false;
    return true;
  }
  /** Un aviso al agotarse del todo. */
  takeDrainedNotice(): boolean {
    if (!this.drainedPending) return false;
    this.drainedPending = false;
    return true;
  }

  /** Reemplazo: consume exactamente un repuesto y vuelve al 100 %. */
  replace(): void {
    this.charge = 100;
    this.lowPending = false;
    this.drainedPending = false;
  }

  snapshot(): HeadlampSnapshot {
    return {
      charge: Math.round(this.charge * 100) / 100,
      on: this.on,
    };
  }

  /** Datos guardados; lo ausente o inválido queda en su valor inicial. */
  restore(data: unknown): void {
    const d = (data ?? {}) as Partial<HeadlampSnapshot>;
    this.charge =
      typeof d.charge === 'number' && Number.isFinite(d.charge)
        ? Math.max(0, Math.min(100, d.charge))
        : 100;
    this.on = d.on !== false;
    this.lowPending = false;
    this.drainedPending = false;
  }
}
