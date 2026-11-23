/** Estado independiente de XP, etapas y logros: compras e inventario de desarrollo. */
export class DeveloperCommands {
  private money = false;
  private stacks = false;
  constructor(readonly enabled = false) {}

  get infiniteMoney(): boolean {
    return this.enabled && this.money;
  }

  get fullStacks(): boolean {
    return this.enabled && this.stacks;
  }

  execute(input: string): { message: string; changed: boolean } {
    if (!this.enabled)
      return { message: 'CONSOLA SOLO EN MODO DESARROLLADOR', changed: false };
    switch (input.trim().toLowerCase()) {
      case 'money':
        this.money = !this.money;
        return {
          message: `DINERO INFINITO: ${this.money ? 'ACTIVADO' : 'DESACTIVADO'}`,
          changed: true,
        };
      case 'fullstacks': {
        const changed = !this.stacks;
        this.stacks = true;
        return {
          message: changed
            ? 'TIENDA DESBLOQUEADA PERMANENTEMENTE'
            : 'LA TIENDA YA ESTA DESBLOQUEADA',
          changed,
        };
      }
      default:
        return {
          message: 'COMANDO DESCONOCIDO: MONEY / FULLSTACKS',
          changed: false,
        };
    }
  }

  snapshot(): { infiniteMoney: boolean; fullStacks: boolean } | undefined {
    return this.enabled
      ? {
          infiniteMoney: this.money,
          fullStacks: this.stacks,
        }
      : undefined;
  }

  restore(value: unknown): void {
    if (!this.enabled || !value || typeof value !== 'object') return;
    this.money = 'infiniteMoney' in value && value.infiniteMoney === true;
    this.stacks = 'fullStacks' in value && value.fullStacks === true;
  }
}
