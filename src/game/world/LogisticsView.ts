import type Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { CART } from '../config/cart';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import type { GameSession } from '../systems/GameSession';
import { railTop, type RailSystem } from '../systems/RailSystem';

/**
 * Proyección de vías, pilas y carro. Ninguna imagen decide una colisión: el
 * perfil de la vía sale de RailSystem y el carro apoya ambas ruedas en él.
 */
export class LogisticsView {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly piles = new Map<number, Phaser.GameObjects.Image>();
  private readonly cartBody: Phaser.GameObjects.Container;
  private readonly detail: Phaser.GameObjects.Graphics;
  private signature = '';

  constructor(
    private readonly scene: Phaser.Scene,
    cart: Phaser.GameObjects.Image,
  ) {
    this.track = scene.add.graphics().setDepth(DEPTH.structures - 1);
    this.detail = scene.add.graphics();
    cart.setPosition(-CART.width / 2, CART.bodyOffset).setOrigin(0, 0);
    this.cartBody = scene.add
      .container(0, 0, [cart, this.detail])
      .setDepth(DEPTH.machines);
  }

  /** Riel continuo, durmientes sobre el suelo y caballetes bajo las rampas. */
  private drawTrack(rails: RailSystem): void {
    const g = this.track.clear();
    for (const s of rails.segments) {
      const x0 = s.column * TILE_SIZE,
        floor = (s.row + 1) * TILE_SIZE;
      const obstructed = !rails.supported(s.column, s.row);
      for (let x = x0; x < x0 + TILE_SIZE; x++) {
        const y = Math.round(rails.railY(x + 0.5));
        // Caballete de madera bajo la rampa hasta el piso real.
        if (floor - (y + 4) > 0 && x % 6 === 2) {
          g.fillStyle(P.ink).fillRect(x - 1, y + 3, 3, floor - y - 3);
          g.fillStyle(P.clay).fillRect(x, y + 4, 1, floor - y - 4);
        }
        // Durmiente de madera cada 5 px, apoyado bajo el riel, con canto claro.
        if (x % 5 === 1) {
          g.fillStyle(P.ink).fillRect(x - 1, y + 1, 4, 3);
          g.fillStyle(P.clay).fillRect(x, y + 2, 2, 1);
          g.fillStyle(P.loam).fillRect(x, y + 2, 1, 1);
        }
        g.fillStyle(P.ink).fillRect(x, y - 1, 1, 3);
        g.fillStyle(obstructed ? P.stone : P.silver).fillRect(x, y, 1, 1);
        g.fillStyle(P.steel).fillRect(x, y + 1, 1, 1);
        // Eclisa (unión) al inicio de cada tramo.
        if (x === x0) g.fillStyle(P.stone).fillRect(x, y, 1, 2);
      }
      // Balasto sobre el piso de los tramos planos.
      if (railTop(s.row) === rails.railY(x0 + 8))
        for (let x = x0; x < x0 + TILE_SIZE; x += 3)
          g.fillStyle((x >> 2) % 2 ? P.taupe : P.stone).fillRect(
            x,
            floor - 1,
            2,
            1,
          );
    }
  }

  update(session: GameSession, now: number): void {
    const sig = session.rails.segments
      .map(
        (s) =>
          `${s.column}:${s.row}:${session.rails.supported(s.column, s.row) ? 1 : 0}`,
      )
      .join('|');
    if (sig !== this.signature) {
      this.signature = sig;
      this.drawTrack(session.rails);
    }
    for (const p of session.piles) {
      if (!this.piles.has(p.id))
        this.piles.set(
          p.id,
          this.scene.add
            .image(
              p.x,
              p.id === 1 ? BALANCE.floorY : p.y + 7,
              'interaction-items',
              5,
            )
            .setOrigin(0.5, 1)
            .setDepth(DEPTH.structures),
        );
      const image = this.piles.get(p.id)!;
      image.setVisible(p.items.length > 0);
      const top = p.items[p.items.length - 1];
      if (top) image.setFrame(top === 'dirt' ? 5 : 6);
    }
    // El carro apoya ambas ruedas en el perfil real y se inclina con él.
    const contact = session.cart.contact();
    // El montículo crece con el peso (kg), no con la cantidad de bloques.
    const n = session.cart.inventory.weight;
    this.cartBody
      .setPosition(Math.round(contact.x), Math.round(contact.y))
      .setRotation(contact.angle);
    const g = this.detail.clear();
    const top = CART.bodyOffset;
    // Cuatro estados de carga: vacío, en el interior, montículo bajo y lleno.
    if (n) {
      const heap =
        n >= BALANCE.cartCapacity
          ? 3
          : n >= BALANCE.cartCapacity * 0.75
            ? 2
            : n >= BALANCE.cartCapacity * 0.4
              ? 1
              : 0;
      for (let i = 0; i < 6; i++) {
        const edge = i === 0 || i === 5 ? 2 : i === 1 || i === 4 ? 1 : 0;
        const rise = Math.max(0, heap - edge);
        const y = top + 1 - rise,
          sx = -CART.width / 2 + 1 + i * 3;
        if (rise) g.fillStyle(P.ink).fillRect(sx, y - 1, 3, 1);
        g.fillStyle(i % 2 ? P.stone : P.steel).fillRect(sx, y, 3, top + 3 - y);
        g.fillStyle(P.silver).fillRect(sx + 1, y, 1, 1);
        g.fillStyle(P.ink).fillRect(sx, top + 2, 1, 1);
      }
    }
    // Ruedas pequeñas de 5 px sobre la cabeza del riel; radios discretos.
    const turn =
      Math.abs(session.cart.velocity) > 1 && Math.floor(now / 90) % 2;
    const wy = CART.wheelOffset;
    for (const dx of CART.wheelCenters) {
      const cx = dx + 0.5;
      g.fillStyle(P.ink)
        .fillRect(cx - 1.5, wy, 3, 5)
        .fillRect(cx - 2.5, wy + 1, 5, 3);
      g.fillStyle(P.steel).fillRect(cx - 1.5, wy + 1, 3, 3);
      g.fillStyle(P.silver).fillRect(
        cx - (turn ? 0.5 : 1.5),
        wy + (turn ? 1 : 2),
        turn ? 1 : 3,
        turn ? 3 : 1,
      );
      g.fillStyle(P.ink).fillRect(cx - 0.5, wy + 2, 1, 1);
    }
  }
}
