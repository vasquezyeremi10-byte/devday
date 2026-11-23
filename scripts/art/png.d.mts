/** Tipos de png.mjs (para las pruebas en src). */
import type { RgbaImage } from './pixelate.mjs';
export function readPng(path: string): RgbaImage;
export function writePng(path: string, image: RgbaImage): void;
