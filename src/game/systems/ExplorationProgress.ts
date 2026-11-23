/**
 * Progreso de la exploración subterránea (V10). Hoy solo recuerda si el
 * jugador ya leyó la página arrancada de la cámara secreta; viaja en el campo
 * `explore` de la partida (sin el campo = sin leer).
 */
export interface ExplorationSnapshot {
  pageRead: boolean;
}

export class ExplorationProgress {
  /** La página arrancada del abuelo (cámara secreta) ya se leyó. */
  pageRead = false;

  /** Marca la página como leída; true solo la primera vez. */
  readPage(): boolean {
    if (this.pageRead) return false;
    this.pageRead = true;
    return true;
  }

  snapshot(): ExplorationSnapshot {
    return { pageRead: this.pageRead };
  }

  restore(data: unknown): void {
    const d = data as Partial<ExplorationSnapshot> | null | undefined;
    this.pageRead = !!d && typeof d === 'object' && d.pageRead === true;
  }
}
