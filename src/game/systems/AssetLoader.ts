import type Phaser from 'phaser';
import { ASSETS, type Asset } from '../data/assets';

function queue(scene: Phaser.Scene, asset: Asset): void {
  const url = `${import.meta.env.BASE_URL}${asset.url}`;
  if (asset.type === 'image') scene.load.image(asset.key, url);
  else if (asset.type === 'spritesheet')
    scene.load.spritesheet(asset.key, url, {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
    });
  else if (asset.type === 'atlas')
    scene.load.atlas(
      asset.key,
      url,
      `${import.meta.env.BASE_URL}${asset.atlasUrl}`,
    );
  else if (asset.type === 'audio') scene.load.audio(asset.key, url);
  else scene.load.tilemapTiledJSON(asset.key, url);
}

/** Pone en cola solo las claves indicadas (si aún no están en caché). */
export function queueKeys(scene: Phaser.Scene, keys: readonly string[]): void {
  for (const key of keys) {
    const asset = ASSETS.find((a) => a.key === key);
    if (asset && !loaded(scene, asset)) queue(scene, asset);
  }
}

/** Recursos ya presentes en las cachés globales del juego (por ejemplo tras R). */
function loaded(scene: Phaser.Scene, asset: Asset): boolean {
  if (asset.type === 'audio') return scene.cache.audio.exists(asset.key);
  if (asset.type === 'tilemap') return scene.cache.tilemap.exists(asset.key);
  return scene.textures.exists(asset.key);
}

/**
 * Solo los recursos de la escena actual que aún no estén en caché: al
 * reiniciar, la cola queda vacía y la escena se recrea en el mismo paso.
 * Los diferidos se piden con loadDeferred.
 */
export function queueAssets(scene: Phaser.Scene, extra: readonly string[] = []): void {
  for (const asset of ASSETS)
    if ((asset.preload !== false || extra.includes(asset.key)) && !loaded(scene, asset))
      queue(scene, asset);
}

/**
 * Recursos de carga inicial que no llegaron a las cachés (por ejemplo, el
 * servidor no respondió). Sin ellos Phaser dibuja su textura de reemplazo
 * `__MISSING` (un cuadro verde con una diagonal), así que la escena no debe
 * construir el mundo hasta tenerlos.
 */
export function missingAssets(scene: Phaser.Scene): string[] {
  return ASSETS.filter((a) => a.preload !== false && !loaded(scene, a)).map(
    (a) => a.key,
  );
}

/**
 * Carga bajo demanda varios recursos diferidos en una sola tanda (V9: capas
 * de un bioma al acercarse). Resuelve al terminar la tanda, aunque alguno
 * falle: quien dibuja comprueba que la textura exista.
 */
export function loadDeferredMany(
  scene: Phaser.Scene,
  keys: readonly string[],
): Promise<void> {
  const pending = keys
    .map((key) => ASSETS.find((item) => item.key === key))
    .filter((a): a is Asset => !!a && !loaded(scene, a));
  if (!pending.length) return Promise.resolve();
  return new Promise((resolve) => {
    for (const asset of pending) queue(scene, asset);
    scene.load.once('complete', () => resolve());
    if (!scene.load.isLoading()) scene.load.start();
  });
}

/** Carga bajo demanda un recurso registrado con preload: false. */
export function loadDeferred(scene: Phaser.Scene, key: string): Promise<void> {
  const asset = ASSETS.find((item) => item.key === key);
  if (!asset) return Promise.reject(new Error(`Recurso no registrado: ${key}`));
  if (loaded(scene, asset)) return Promise.resolve();
  return new Promise((resolve) => {
    queue(scene, asset);
    scene.load.once('complete', () => resolve());
    scene.load.start();
  });
}
