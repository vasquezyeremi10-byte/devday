import type Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import { TILE_SIZE, WORLD } from '../config/constants';

/** Bocetos originales por píxeles; sustituibles por PNG con las mismas claves. */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('terrain')) {
    const texture = scene.textures.createCanvas('terrain', 48, 16)!;
    const ctx = texture.context;
    const colors = [
      ['#795443', '#8c634b', '#674438'],
      ['#49434a', '#5d5258', '#37343e'],
      ['#30313b', '#53515a', '#21232e'],
    ];
    colors.forEach(([base, light, dark], index) => {
      const x = index * 16;
      ctx.fillStyle = base!;
      ctx.fillRect(x, 0, 16, 16);
      ctx.fillStyle = light!;
      ctx.fillRect(x, 0, 16, 1);
      ctx.fillRect(x + 2, 4, 4, 1);
      ctx.fillRect(x + 10, 10, 3, 2);
      ctx.fillStyle = dark!;
      ctx.fillRect(x, 15, 16, 1);
      ctx.fillRect(x + 15, 1, 1, 15);
      ctx.fillRect(x + 7, 5, 1, 5);
      ctx.fillRect(x + 5, 9, 3, 1);
      ctx.fillRect(x + 2, 12, 2, 1);
    });
    texture.refresh();
  }
  if (!scene.textures.exists('miner')) {
    const texture = scene.textures.createCanvas('miner', 64, 24)!;
    const ctx = texture.context;
    const rect = (
      x: number,
      y: number,
      w: number,
      h: number,
      color: string,
    ) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    for (let frame = 0; frame < 4; frame++) {
      const x = frame * 16;
      const stride = frame === 1 ? 1 : frame === 3 ? -1 : 0;
      rect(x + 4, 1, 9, 8, '#282a32');
      rect(x + 4, 2, 8, 4, '#d6a45c');
      rect(x + 3, 5, 11, 2, '#edc77e');
      rect(x + 11, 3, 3, 3, '#fff1bf');
      rect(x + 5, 7, 7, 5, '#b87c52');
      rect(x + 10, 8, 1, 1, '#242734');
      rect(x + 3, 12, 9, 7, '#32616b');
      rect(x + 5, 12, 3, 6, '#71a3a0');
      rect(x + 2, 12, 3, 6, '#bb8a60');
      rect(x + 11, 12, 2, 6, '#c69b6c');
      rect(x + 4, 18, 3, 5 - Math.max(0, stride), '#2c3545');
      rect(x + 9, 18, 3, 5 + Math.min(0, stride), '#2c3545');
      rect(x + 3, 22 - Math.max(0, stride), 4, 2, '#24242c');
      rect(x + 9, 22 + Math.min(0, stride), 4, 2, '#24242c');
      rect(x + 13, 11, 1, 10, '#b08455');
      rect(x + 10, 11, 6, 2, '#a7b3ad');
      texture.add(frame, 0, x, 0, 16, 24);
    }
    texture.refresh();
  }
}

export function drawPlaceholderWorld(scene: Phaser.Scene): void {
  const width = WORLD.columns * TILE_SIZE;
  const height = WORLD.rows * TILE_SIZE;
  const back = scene.add.graphics().setDepth(DEPTH.background);
  back.fillStyle(0xd8ac78).fillRect(0, 0, width, height);
  back.fillStyle(0xe8c48e).fillRect(0, 0, width, 58);
  back.fillStyle(0xf7dda5).fillRect(82, 42, 23, 23);
  // Siluetas geométricas provisionales, sin recursos interactivos dibujados.
  back.fillStyle(0xb78e6d);
  for (let x = -30; x < width; x += 180) {
    back.fillTriangle(x, 132, x + 80, 52, x + 190, 132);
  }
  back.fillStyle(0x907765);
  for (let x = -70; x < width; x += 160) {
    back.fillTriangle(x, 151, x + 90, 85, x + 190, 151);
  }
  back.fillStyle(0x6e6758).fillRect(0, 144, width, 16);
  back
    .fillStyle(0x2a2932)
    .fillRect(0, 160, width, height - 160)
    .fillRect(288, 96, width - 288, 64);
  back.fillStyle(0x39313a);
  for (let y = 166; y < height; y += 28) {
    for (let x = (y % 3) * 13; x < width; x += 47) back.fillRect(x, y, 22, 1);
  }

  const structure = scene.add.graphics().setDepth(DEPTH.structures);
  structure
    .fillStyle(0xb39156)
    .fillRect(0, 158, 288, 2)
    .fillRect(288, 94, width - 288, 2);
  // Entrada y puntales dentro de la galería inicial.
  for (const x of [286, 346, 406]) {
    structure.fillStyle(0x49392e).fillRect(x, 123, 7, 37);
    structure.fillStyle(0xa2724b).fillRect(x + 1, 125, 4, 35);
    structure.fillStyle(0xd09b60).fillRect(x + 1, 126, 1, 32);
  }
  structure.fillStyle(0x9a6b46).fillRect(282, 123, 134, 5);
  structure.fillStyle(0xc39760).fillRect(282, 123, 134, 1);
  structure.fillStyle(0x5d5552).fillRect(230, 158, 184, 2);
  for (let x = 230; x < 416; x += 12)
    structure.fillStyle(0x987452).fillRect(x, 157, 5, 2);
  for (const x of [300, 360]) {
    structure.fillStyle(0x84613f).fillRect(x - 1, 130, 8, 10);
    structure.fillStyle(0xf5c577).fillRect(x, 132, 5, 6);
    structure.fillStyle(0xffe8ad).fillRect(x + 1, 133, 3, 4);
  }
  structure
    .fillStyle(0x6b4e39)
    .fillRect(165, 133, 2, 27)
    .fillRect(157, 127, 26, 13);
  scene.add
    .text(161, 130, 'MINA', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#edd3a3',
    })
    .setDepth(DEPTH.structures);
  // Pala apoyada al lado del acceso.
  structure.fillStyle(0xba9660).fillRect(275, 139, 2, 15);
  structure.fillStyle(0x929c95).fillRect(273, 151, 6, 6);
  structure.fillStyle(0xc0c2a5).fillRect(274, 152, 1, 4);

  const cart = scene.add.graphics().setDepth(DEPTH.machines);
  cart.fillStyle(0x232a32).fillRect(239, 139, 27, 12);
  cart.fillStyle(0x738184).fillRect(241, 140, 23, 9);
  cart.fillStyle(0xa5aca0).fillRect(239, 138, 27, 3);
  cart.fillStyle(0x4b5a61).fillRect(244, 143, 1, 6).fillRect(255, 143, 1, 6);
  cart.fillStyle(0x222632).fillRect(242, 151, 6, 6).fillRect(258, 151, 6, 6);
  cart.fillStyle(0x8e9a92).fillRect(244, 153, 2, 2).fillRect(260, 153, 2, 2);
}
