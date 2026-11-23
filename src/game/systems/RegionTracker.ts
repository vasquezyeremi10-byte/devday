import { BIOME_IDS, normalizeBiomeId, type BiomeId } from '../config/biomes';

/**
 * Regiones del mundo (V9): bioma donde está el minero y biomas ya
 * visitados. El mundo de cada región sale siempre igual de la semilla
 * (terreno, decoración y fondos no tienen azar al cargar), así que la
 * partida solo guarda qué regiones se conocen y dónde quedó el jugador; lo
 * excavado y construido viaja en las diferencias del terreno de siempre.
 */
export interface RegionSnapshot {
  current: BiomeId;
  visited: BiomeId[];
}

export class RegionTracker {
  current: BiomeId = 'desert';
  /** El desierto, con el campamento y la mina, se conoce desde el inicio. */
  private readonly visited = new Set<BiomeId>(['desert']);

  /** Entrar a una región. Devuelve el bioma si es la primera visita. */
  enter(biome: BiomeId): BiomeId | null {
    this.current = biome;
    if (this.visited.has(biome)) return null;
    this.visited.add(biome);
    return biome;
  }

  has(biome: BiomeId): boolean {
    return this.visited.has(biome);
  }

  /** Visitadas en el orden del mundo (de oeste a este). */
  get list(): BiomeId[] {
    return BIOME_IDS.filter((id) => this.visited.has(id));
  }

  snapshot(): RegionSnapshot {
    return { current: this.current, visited: this.list };
  }

  /**
   * Partidas sin el dato (anteriores a V9): solo el desierto conocido. Los
   * identificadores de V9 (valle, bosque…) pasan a la zona desértica que
   * ocupa sus mismas columnas.
   */
  restore(value: unknown): void {
    const v = value as { visited?: unknown; current?: unknown } | null | undefined;
    if (Array.isArray(v?.visited))
      for (const raw of v.visited) {
        const id = normalizeBiomeId(raw);
        if (id) this.visited.add(id);
      }
    const current = normalizeBiomeId(v?.current);
    if (current) {
      this.current = current;
      this.visited.add(current);
    }
  }
}
