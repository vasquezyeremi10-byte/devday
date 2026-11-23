/** Tipos de pixelate.mjs (para sus pruebas en src). */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}
export function areaResample(src: RgbaImage, dw: number, dh: number): RgbaImage;
export function sharpen(img: RgbaImage, amount: number): RgbaImage;
export function colorDist(a: number[], b: number[]): number;
export function buildPalette(img: RgbaImage, size: number, iterations?: number): number[][];
export function quantize(img: RgbaImage, palette: number[][], alphaCut?: number): RgbaImage;
export function removeSpeckles(img: RgbaImage, maxDist: number, passes?: number): RgbaImage;
export function countColors(img: { data: Uint8Array }): number;
export function upscaleNearest(img: RgbaImage, n: number): RgbaImage;
