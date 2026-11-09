import Phaser from 'phaser';
import { PLAYER, SPAWN } from '../config/constants';
import { DEPTH } from '../config/layers';

export class Miner extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private jumpRequested = false;
  private readonly keys: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    jump: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene) {
    super(scene, SPAWN.x, SPAWN.y, 'miner', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.characters)
      .setSize(10, 18)
      .setOffset(3, 6)
      .setCollideWorldBounds(true)
      .setMaxVelocity(PLAYER.speed, 280);
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('El prototipo requiere teclado');
    this.keys = keyboard.addKeys({
      left: 'LEFT',
      right: 'RIGHT',
      jump: 'SPACE',
      a: 'A',
      d: 'D',
      w: 'W',
      up: 'UP',
    }) as typeof this.keys;
    // DOWN conserva pulsaciones que comienzan y terminan entre dos frames.
    // Los Key se destruyen con KeyboardPlugin al cerrar/reiniciar la escena.
    for (const key of [this.keys.jump, this.keys.w, this.keys.up]) {
      key.on('down', () => {
        this.jumpRequested = true;
      });
    }
    if (!scene.anims.exists('miner-walk')) {
      scene.anims.create({
        key: 'miner-walk',
        frames: scene.anims.generateFrameNumbers('miner', {
          frames: [0, 1, 2, 3],
        }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  step(): void {
    const left = this.keys.left.isDown || this.keys.a.isDown;
    const right = this.keys.right.isDown || this.keys.d.isDown;
    const direction = Number(right) - Number(left);
    this.setVelocityX(direction * PLAYER.speed);
    if (this.jumpRequested && this.body.blocked.down)
      this.setVelocityY(-PLAYER.jumpSpeed);
    this.jumpRequested = false;
    if (direction !== 0) this.setFlipX(direction < 0);
    if (direction !== 0 && this.body.blocked.down)
      this.play('miner-walk', true);
    else {
      this.anims.stop();
      this.setFrame(0);
    }
  }
}
