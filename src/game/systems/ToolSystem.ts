import { TOOL_KEYS, TOOLS, type ToolKind } from '../config/balance';

export interface Tool {
  id: number;
  kind: ToolKind;
  durability: number;
}
export class ToolSystem {
  items: Tool[] = [];
  equipped = 0;
  nextId = 1;
  get current(): Tool | undefined {
    return this.items.find((t) => t.id === this.equipped);
  }
  add(kind: ToolKind): Tool {
    const tool = {
      id: this.nextId++,
      kind,
      durability: TOOLS[kind].durability,
    };
    this.items.push(tool);
    this.equipped = tool.id;
    return tool;
  }
  equip(kind: ToolKind): boolean {
    const candidates = this.items.filter(
      (t) => t.kind === kind && t.durability > 0,
    );
    const current = candidates.findIndex((t) => t.id === this.equipped);
    const tool = candidates[(current + 1) % candidates.length];
    if (!tool) return false;
    this.equipped = tool.id;
    return true;
  }
  usable(kind: ToolKind): Tool | undefined {
    return this.items.find((t) => t.kind === kind && t.durability > 0);
  }
  wear(tool = this.current): boolean {
    if (!tool || tool.durability <= 0) return false;
    tool.durability--;
    return true;
  }
  state(tool = this.current): string {
    if (!tool || tool.durability === 0) return 'ROTA';
    const ratio = tool.durability / TOOLS[tool.kind].durability;
    return ratio > 0.5 ? 'BUENA' : ratio > 0.2 ? 'DESGASTADA' : 'POR ROMPER';
  }
  hasPick(): boolean {
    return TOOL_KEYS.some((k) => TOOLS[k].type === 'pick' && this.usable(k));
  }
}
