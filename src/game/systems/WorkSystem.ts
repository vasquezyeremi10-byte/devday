/** Reloj absoluto: no acumula frames ni permite arrastrar sobrantes a otro bloque. */
export class WorkSystem {
  key = '';
  started = 0;
  progress = 0;
  private completed = '';
  cancel(): void {
    this.key = '';
    this.progress = 0;
    this.completed = '';
  }
  advance(key: string, now: number, duration: number): boolean {
    if (key === this.completed) return false;
    if (key !== this.key) {
      this.key = key;
      this.started = now;
      this.progress = 0;
    }
    this.progress = Math.min(1, Math.max(0, (now - this.started) / duration));
    if (this.progress < 1) return false;
    this.completed = key;
    return true;
  }
}
