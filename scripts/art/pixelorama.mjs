// Escritura mínima de proyectos .pxo de Pixelorama 1.x (ZIP, pxo_version 8)
// y exportación de hojas de sprites mediante la CLI oficial de Pixelorama.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

export const PIXELORAMA_EXE = resolve(
  import.meta.dirname,
  '../../.tools/pixelorama-1.2.4/Pixelorama-Windows-64bit/Pixelorama.exe',
);

/** ZIP sin dependencias: deflate por entrada, fecha fija para builds reproducibles. */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/**
 * layers: nombres de abajo hacia arriba.
 * frames: [{ cels: Uint8Array RGBA por capa, duration }]; duration multiplica 1/fps.
 * tags: [{ name, color: 'rrggbbaa', from, to }] con índices desde 1, como Pixelorama.
 */
export function writePxo(path, { width, height, fps, layers, frames, tags }) {
  const size = `Vector2i(${width}, ${height})`;
  const data = {
    pixelorama_version: 'v1.2.4-stable',
    pxo_version: 8,
    size_x: width,
    size_y: height,
    color_mode: 5, // Image.FORMAT_RGBA8
    tile_mode_x_basis_x: width,
    tile_mode_x_basis_y: 0,
    tile_mode_y_basis_x: 0,
    tile_mode_y_basis_y: height,
    layers: layers.map((name) => ({
      name,
      visible: true,
      locked: false,
      blend_mode: 0,
      clipping_mask: false,
      opacity: 1.0,
      use_cel_image_for_effects: false,
      parent: -1,
      effects: [],
      animated_params: '{}',
      type: 0,
      new_cels_linked: false,
      metadata: {},
    })),
    tags,
    frames: frames.map((frame) => ({
      cels: layers.map(() => ({
        opacity: 1.0,
        z_index: 0,
        image_size: size,
        metadata: {},
      })),
      duration: frame.duration,
      metadata: {},
    })),
    current_frame: 0,
    current_layer: layers.length - 1,
    fps,
    metadata: {},
  };
  const entries = [
    { name: 'data.json', data: Buffer.from(JSON.stringify(data), 'utf8') },
    { name: 'mimetype', data: Buffer.from('application/x-pixelorama', 'utf8') },
  ];
  frames.forEach((frame, f) =>
    frame.cels.forEach((pixels, l) =>
      entries.push({
        name: `image_data/frames/${f + 1}/layer_${l + 1}`,
        data: Buffer.from(pixels),
      }),
    ),
  );
  writeFileSync(path, zip(entries));
}

/** Exporta todos los cuadros en una fila mediante Pixelorama sin interfaz. */
export function exportSpritesheet(pxoPath, pngPath, scale = 1) {
  if (!existsSync(PIXELORAMA_EXE))
    throw new Error(
      'Falta Pixelorama portátil en .tools/pixelorama-1.2.4. Consulta docs/ASSET_SPEC.md.',
    );
  execFileSync(
    PIXELORAMA_EXE,
    [
      '--headless',
      '--quit',
      '--',
      resolve(pxoPath),
      '--export',
      '--spritesheet',
      '--scale',
      String(scale),
      '--output',
      resolve(pngPath),
    ],
    { stdio: 'pipe', timeout: 120000 },
  );
  if (!existsSync(pngPath)) throw new Error(`Pixelorama no generó ${pngPath}`);
}
