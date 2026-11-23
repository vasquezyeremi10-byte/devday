import Phaser from 'phaser';
import { MENU_ANCHORS as A } from '../config/menu';
import { cssColor, PALETTE as P } from '../config/palette';
import { dissolveThreshold } from '../world/Dissolve';

/**
 * Ambiente del menú sobre la ilustración: los dos faroles parpadean, un
 * medallón de promesa late sobre la madera, los cristales laten y la barrera
 * de niebla respira en capas con motas que salen del túnel. Se mantiene
 * concentrado a la derecha para no competir con el logotipo ni con los
 * controles.
 *
 * Todo es opaco y de píxeles enteros (puntos sueltos escasos, nada de alfa
 * parcial ni tramas densas). Costo: menos de una veintena de imágenes
 * estáticas y un único Graphics con pocas decenas de rectángulos por cuadro.
 */

const HALO_MIN = 2;
const HALO_MAX = 8;

function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, w, h)!;
  texture.context.imageSmoothingEnabled = false;
  paint(texture.context);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/**
 * Destello cálido junto a una luz: unos pocos puntos de la rejilla de 2 × 2,
 * dorados al centro y naranjas hacia el borde, en un radio corto (`r` cambia
 * a saltos para el parpadeo). Antes era un damero del 50 % de todo el radio
 * que sobre la ilustración nítida se leía como una cuadrícula de ruido: el
 * resplandor grande ya está pintado en el fondo. El centro queda libre para no
 * tapar la farola.
 */
function bakeHalo(scene: Phaser.Scene, r: number): string {
  const key = `menu-halo-${r}`;
  const size = 2 * r + 3;
  const reach = r * 0.62;
  bakeTexture(scene, key, size, size, (ctx) => {
    const c = r + 1;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d < 2.4 || d > reach + 0.5) continue;
        if (x % 2 !== 0 || y % 2 !== 0) continue;
        ctx.fillStyle = cssColor(d <= reach * 0.6 ? P.gold : P.orange);
        ctx.fillRect(x, y, 1, 1);
      }
  });
  return key;
}

/**
 * Brillo de cristal de radio r: damero claro adentro y trama rala afuera, en
 * violeta o cian. Cambia de radio a saltos para «latir» sin fundidos.
 */
function bakeCrystalGlow(scene: Phaser.Scene, tone: 'violet' | 'cyan', r: number): string {
  const key = `menu-crystal-${tone}-${r}`;
  const size = 2 * r + 3;
  const [inner, outer] = tone === 'cyan' ? [P.mist, P.azure] : [P.violet, P.duskViolet];
  bakeTexture(scene, key, size, size, (ctx) => {
    const c = r + 1;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d < 1.6 || d > r + 0.5) continue;
        // Un píxel de cada cuatro (rejilla de 2 × 2): puntos limpios, no damero.
        if (x % 2 !== 0 || y % 2 !== 0) continue;
        ctx.fillStyle = cssColor(d <= r * 0.5 ? inner : outer);
        ctx.fillRect(x, y, 1, 1);
      }
  });
  return key;
}

/**
 * Respiración del túnel: elipse de puntos sueltos (índigo y violeta) más
 * densa al centro. Tres densidades que se alternan a saltos.
 */
function bakeTunnelGlow(scene: Phaser.Scene, level: number): string {
  const key = `menu-tunnel-${level}`;
  const { rx, ry } = A.tunnel;
  const w = rx * 2 + 1;
  const h = ry * 2 + 1;
  bakeTexture(scene, key, w, h, (ctx) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.hypot((x - rx) / rx, (y - ry) / ry);
        if (d > 1) continue;
        // Ruido (no una matriz ordenada): puntos sueltos, sin retícula visible.
        const density = (1 - d) ** 1.5 * (0.08 + level * 0.05);
        if (dissolveThreshold('night', x * 2 + 7, y * 2 + 3) >= density * 64) continue;
        ctx.fillStyle = cssColor(d < 0.45 ? P.violet : P.indigo);
        ctx.fillRect(x, y, 1, 1);
      }
  });
  return key;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  cyan: boolean;
}
interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  phase: number;
  big: boolean;
}
interface Sparkle {
  x: number;
  y: number;
  arm: number;
  next: number;
  start: number;
}
interface Halo {
  image: Phaser.GameObjects.Image;
  r: number;
  flick: number;
  next: number;
}
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)]!;

const EMBER_COUNT = 10;

export class MenuAmbience {
  private readonly fx: Phaser.GameObjects.Graphics;
  private readonly halos: Halo[] = [];
  private readonly embers: Ember[] = [];
  private readonly sparkles: Sparkle[] = [];
  private readonly tunnel: Phaser.GameObjects.Image;
  private readonly crystalGlows: {
    image: Phaser.GameObjects.Image;
    tone: 'violet' | 'cyan';
    period: number;
    offset: number;
  }[] = [];
  private readonly motes: Mote[] = [];
  /** Profundidad: desplazamiento suavizado hacia el puntero (−1..1). */
  private readonly parallax = { x: 0, y: 0, tx: 0, ty: 0 };

  constructor(scene: Phaser.Scene, depth: number) {
    for (let r = HALO_MIN; r <= HALO_MAX; r++) bakeHalo(scene, r);
    for (let r = 3; r <= 6; r++) {
      bakeCrystalGlow(scene, 'violet', r);
      bakeCrystalGlow(scene, 'cyan', r);
    }
    for (let level = 0; level < 3; level++) bakeTunnelGlow(scene, level);

    // Brillo que respira sobre la niebla del portal.
    this.tunnel = scene.add
      .image(A.tunnel.x - A.tunnel.rx, A.tunnel.y - A.tunnel.ry, 'menu-tunnel-0')
      .setOrigin(0)
      .setDepth(depth);
    // Cristales: brillo que late (radio que sube y baja a saltos).
    for (const c of A.crystals) {
      const tone = c.color === 'cyan' ? 'cyan' : 'violet';
      this.crystalGlows.push({
        image: scene.add.image(c.x, c.y, `menu-crystal-${tone}-4`).setDepth(depth),
        tone,
        period: rand(2600, 4200),
        offset: rand(0, 4000),
      });
    }
    for (let i = 0; i < 9; i++) {
      const m = {} as Mote;
      this.spawnMote(m, true);
      this.motes.push(m);
    }

    // Halos de faroles (imágenes estáticas: solo cambian de textura).
    for (const l of A.lanterns) {
      const image = scene.add
        .image(l.x, l.y, `menu-halo-${l.r}`)
        .setDepth(depth + 1);
      this.halos.push({ image, r: l.r, flick: 0, next: rand(0, 400) });
    }

    this.fx = scene.add.graphics().setDepth(depth + 2);

    for (let i = 0; i < EMBER_COUNT; i++) {
      const e = {} as Ember;
      this.spawnEmber(e, true);
      this.embers.push(e);
    }
    for (const c of A.crystals)
      this.sparkles.push({
        x: c.x,
        y: c.y,
        arm: c.color === 'cyan' ? P.mist : P.dawnPink,
        next: rand(300, 4200),
        start: -1e6,
      });
  }

  private get statics(): Phaser.GameObjects.Components.Visible[] {
    return [
      this.fx,
      this.tunnel,
      ...this.halos.map((h) => h.image),
      ...this.crystalGlows.map((c) => c.image),
    ];
  }

  setVisible(visible: boolean): void {
    for (const o of this.statics) o.setVisible(visible);
  }

  destroy(): void {
    for (const o of this.statics)
      (o as unknown as Phaser.GameObjects.GameObject).destroy();
  }

  /**
   * Profundidad según el puntero (−1..1 en cada eje): las capas cercanas
   * (partículas) se corren hasta 2 px y las lejanas (nubes) 1 px. La
   * ilustración no se mueve. Se aplica suavizado y siempre en px enteros.
   */
  setParallax(x: number, y: number): void {
    this.parallax.tx = Phaser.Math.Clamp(x, -1, 1);
    this.parallax.ty = Phaser.Math.Clamp(y, -1, 1);
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    const p = this.parallax;
    const k = Math.min(1, dt / 600);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    const near = { x: Math.round(-p.x * 2), y: Math.round(-p.y * 1) };
    this.fx.setPosition(near.x, near.y);
    // Túnel: tres densidades que suben y bajan a saltos (ciclo de 4,8 s).
    const breath = [0, 1, 2, 1][Math.floor(time / 1200) % 4]!;
    this.tunnel.setTexture(`menu-tunnel-${breath}`);
    // Cristales: radio 3..6 según una onda lenta por cristal.
    for (const c of this.crystalGlows) {
      const wave = Math.sin(((time + c.offset) / c.period) * Math.PI * 2);
      c.image.setTexture(`menu-crystal-${c.tone}-${4 + Math.round(wave * 1.4)}`);
    }
    // Halos: parpadeo a saltos de radio ±1.
    for (const h of this.halos)
      if (time >= h.next) {
        h.flick = pick([-1, 0, 0, 1]);
        h.next = time + rand(70, 210);
        h.image.setTexture(
          `menu-halo-${Phaser.Math.Clamp(h.r + h.flick, HALO_MIN, HALO_MAX)}`,
        );
      }

    const g = this.fx;
    g.clear();
    this.drawEmbers(g, time, dt);
    this.drawPromiseRelic(g, time);
    this.drawSparkles(g, time);
    this.drawMotes(g, dt);
  }

  /** Motas violetas y cian que salen flotando del túnel y se apagan de golpe. */
  private spawnMote(m: Mote, initial: boolean): void {
    const t = A.tunnel;
    m.x = t.x + rand(-t.rx * 0.5, t.rx * 0.5);
    m.y = t.y + rand(-t.ry * 0.4, t.ry * 0.5);
    m.vx = -rand(1.5, 5);
    m.vy = -rand(0.5, 3);
    m.life = rand(2600, 5200);
    m.age = initial ? rand(0, m.life) : 0;
    m.cyan = Math.random() < 0.4;
  }

  private drawMotes(g: Phaser.GameObjects.Graphics, dt: number): void {
    // Las motas no se corren con el puntero: nacen en la boca del túnel.
    const ox = -this.fx.x;
    const oy = -this.fx.y;
    for (const m of this.motes) {
      m.age += dt;
      if (m.age >= m.life) this.spawnMote(m, false);
      const s = m.age / 1000;
      const x = Math.round(m.x + m.vx * s + Math.sin(m.age * 0.002 + m.life) * 1.5);
      const y = Math.round(m.y + m.vy * s);
      const fresh = m.age / m.life < 0.5;
      g.fillStyle(m.cyan ? (fresh ? P.mist : P.azure) : fresh ? P.violet : P.duskViolet);
      g.fillRect(x + ox, y + oy, 1, 1);
    }
  }

  private spawnEmber(e: Ember, initial: boolean): void {
    const s = pick([
      ...A.lanterns,
      ...A.lanterns,
    ]);
    e.x = s.x + rand(-5, 5);
    e.y = s.y + rand(-4, 2);
    e.vx = rand(-3, 3);
    e.vy = -rand(4, 11);
    e.life = rand(1800, 3800);
    e.age = initial ? rand(0, e.life) : 0;
    e.phase = rand(0, 10);
    e.big = Math.random() < 0.2;
  }

  private drawEmbers(
    g: Phaser.GameObjects.Graphics,
    time: number,
    dt: number,
  ): void {
    for (const e of this.embers) {
      e.age += dt;
      if (e.age >= e.life) this.spawnEmber(e, false);
      const t = e.age / e.life;
      const x =
        e.x + e.vx * (e.age / 1000) + Math.sin(e.age * 0.003 + e.phase) * 3;
      const y = e.y + e.vy * (e.age / 1000);
      // Parpadeo: se apaga un instante de cada cinco.
      if (Math.floor(time / 110 + e.phase) % 5 === 0) continue;
      g.fillStyle(t < 0.35 ? P.cream : t < 0.7 ? P.gold : P.orange);
      const size = e.big && t < 0.6 ? 2 : 1;
      g.fillRect(Math.round(x), Math.round(y), size, size);
    }
  }

  private drawSparkles(g: Phaser.GameObjects.Graphics, time: number): void {
    for (const s of this.sparkles) {
      if (time >= s.next) {
        s.start = time;
        s.next = time + rand(1800, 5200);
      }
      const k = time - s.start;
      if (k < 0 || k > 420) continue;
      const long = k > 140 && k < 280 ? 2 : 1;
      g.fillStyle(s.arm);
      g.fillRect(s.x - long, s.y, long * 2 + 1, 1).fillRect(
        s.x,
        s.y - long,
        1,
        long * 2 + 1,
      );
      g.fillStyle(P.white).fillRect(s.x, s.y, 1, 1);
    }
  }

  /**
   * Pequeño recuerdo de quien espera al minero: un medallón de cobre con dos
   * facetas unidas. La veta violeta lo cruza y late hacia el portal, de modo
   * que la historia se lee sin añadir texto ni competir con el título.
   */
  private drawPromiseRelic(g: Phaser.GameObjects.Graphics, time: number): void {
    const { x, y } = A.promise;
    const bright = Math.floor(time / 720) % 4 === 0;
    // Cordón y aro sobre la madera de la entrada.
    g.fillStyle(P.ink).fillRect(x, y - 8, 1, 4);
    g.fillStyle(P.gold).fillRect(x, y - 7, 1, 2);
    // Contorno de las dos facetas: dos vidas reunidas por una veta rota.
    g.fillStyle(P.ink)
      .fillRect(x - 5, y - 4, 4, 2)
      .fillRect(x + 2, y - 4, 4, 2)
      .fillRect(x - 6, y - 2, 13, 5)
      .fillRect(x - 4, y + 3, 9, 3)
      .fillRect(x - 2, y + 6, 5, 1);
    g.fillStyle(P.clay)
      .fillRect(x - 4, y - 3, 3, 2)
      .fillRect(x + 2, y - 3, 3, 2)
      .fillRect(x - 5, y - 1, 11, 3)
      .fillRect(x - 3, y + 2, 7, 3)
      .fillRect(x - 1, y + 5, 3, 1);
    // Centro mineral que deja una grieta entre ambas mitades.
    g.fillStyle(P.violet)
      .fillRect(x, y - 2, 1, 2)
      .fillRect(x - 1, y, 3, 2)
      .fillRect(x, y + 2, 1, 3);
    g.fillStyle(bright ? P.cream : P.mauve).fillRect(x - 3, y - 2, 1, 1);
    if (bright) {
      g.fillStyle(P.mist)
        .fillRect(x - 8, y + 1, 2, 1)
        .fillRect(x - 7, y, 1, 3)
        .fillRect(x + 7, y + 1, 2, 1)
        .fillRect(x + 8, y, 1, 3);
    }
  }

}
