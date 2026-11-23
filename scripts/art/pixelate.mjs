// Herramientas para convertir una ilustración de tono continuo en pixel art
// nítido a la resolución del juego, sin dependencias: remuestreo por áreas,
// realce de bordes, paleta limitada (corte por medianas + k-means) sin
// tramado y limpieza de píxeles sueltos. Las usan build-menu-bg.mjs y
// build-studio-logo.mjs.
//
// Una imagen es { width, height, data: Uint8Array RGBA }.

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/**
 * Reduce por promedio de áreas (cada píxel de destino es el promedio exacto de
 * la región de origen que cubre, con pesos fraccionarios en los bordes). Es el
 * remuestreo más fiel a la ilustración; el suavizado que deja se recupera
 * después con `sharpen`. El alfa se promedia ponderado por sí mismo.
 */
export function areaResample(src, dw, dh) {
  const { width: sw, height: sh, data } = src;
  const sx = sw / dw;
  const sy = sh / dh;
  // Paso horizontal: (dw × sh) en coma flotante premultiplicada.
  const mid = new Float64Array(dw * sh * 4);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < dw; x++) {
      const a = x * sx;
      const b = (x + 1) * sx;
      let r = 0, g = 0, bl = 0, al = 0, wsum = 0;
      for (let i = Math.floor(a); i < Math.ceil(b) && i < sw; i++) {
        const w = Math.min(i + 1, b) - Math.max(i, a);
        const o = (y * sw + i) * 4;
        const alpha = data[o + 3] / 255;
        r += data[o] * alpha * w;
        g += data[o + 1] * alpha * w;
        bl += data[o + 2] * alpha * w;
        al += alpha * w;
        wsum += w;
      }
      const m = (y * dw + x) * 4;
      mid[m] = r / wsum;
      mid[m + 1] = g / wsum;
      mid[m + 2] = bl / wsum;
      mid[m + 3] = al / wsum;
    }
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const a = y * sy;
      const b = (y + 1) * sy;
      let r = 0, g = 0, bl = 0, al = 0, wsum = 0;
      for (let j = Math.floor(a); j < Math.ceil(b) && j < sh; j++) {
        const w = Math.min(j + 1, b) - Math.max(j, a);
        const m = (j * dw + x) * 4;
        r += mid[m] * w;
        g += mid[m + 1] * w;
        bl += mid[m + 2] * w;
        al += mid[m + 3] * w;
        wsum += w;
      }
      const alpha = al / wsum;
      const o = (y * dw + x) * 4;
      if (alpha > 0.0001) {
        out[o] = clamp(r / wsum / alpha);
        out[o + 1] = clamp(g / wsum / alpha);
        out[o + 2] = clamp(bl / wsum / alpha);
      }
      out[o + 3] = clamp(alpha * 255);
    }
  return { width: dw, height: dh, data: out };
}

/**
 * Máscara de enfoque (unsharp): realza bordes restando una versión
 * desenfocada (núcleo gaussiano 3 × 3). Solo toca el color, no el alfa, y
 * ignora vecinos transparentes para no manchar los contornos.
 */
export function sharpen(img, amount) {
  const { width: w, height: h, data } = img;
  const out = new Uint8Array(data);
  const K = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (data[o + 3] === 0) continue;
      const blur = [0, 0, 0];
      let wsum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.min(w - 1, Math.max(0, x + dx));
          const ny = Math.min(h - 1, Math.max(0, y + dy));
          const n = (ny * w + nx) * 4;
          if (data[n + 3] === 0) continue;
          const k = K[(dy + 1) * 3 + dx + 1];
          blur[0] += data[n] * k;
          blur[1] += data[n + 1] * k;
          blur[2] += data[n + 2] * k;
          wsum += k;
        }
      for (let c = 0; c < 3; c++)
        out[o + c] = clamp(data[o + c] + amount * (data[o + c] - blur[c] / wsum));
    }
  return { width: w, height: h, data: out };
}

/** Distancia de color con pesos perceptuales baratos (verde pesa más). */
export const colorDist = (a, b) => {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
};

/**
 * Paleta de `size` colores: corte por medianas sobre el histograma de colores
 * únicos (ponderado por frecuencia) y afinado con k-means.
 */
export function buildPalette(img, size, iterations = 8) {
  const { data } = img;
  const hist = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    hist.set(k, (hist.get(k) ?? 0) + 1);
  }
  const colors = [...hist.entries()].map(([k, n]) => ({
    c: [k >> 16, (k >> 8) & 255, k & 255],
    n,
  }));
  let boxes = [colors];
  while (boxes.length < size) {
    // Se parte la caja con más rango × población.
    let best = -1;
    let bestScore = -1;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const lo = [255, 255, 255];
      const hi = [0, 0, 0];
      let pop = 0;
      for (const { c, n } of box) {
        pop += n;
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], c[k]);
          hi[k] = Math.max(hi[k], c[k]);
        }
      }
      const range = Math.max(hi[0] - lo[0], (hi[1] - lo[1]) * 1.3, hi[2] - lo[2]);
      const score = range * Math.sqrt(pop);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best < 0) break;
    const box = boxes[best];
    const lo = [255, 255, 255];
    const hi = [0, 0, 0];
    for (const { c } of box)
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], c[k]);
        hi[k] = Math.max(hi[k], c[k]);
      }
    const ranges = [hi[0] - lo[0], (hi[1] - lo[1]) * 1.3, hi[2] - lo[2]];
    const axis = ranges.indexOf(Math.max(...ranges));
    box.sort((a, b) => a.c[axis] - b.c[axis]);
    const total = box.reduce((s, e) => s + e.n, 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < box.length - 1; i++) {
      acc += box[i].n;
      cut = i + 1;
      if (acc >= total / 2) break;
    }
    boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
  }
  let palette = boxes.map((box) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const e of box) {
      r += e.c[0] * e.n;
      g += e.c[1] * e.n;
      b += e.c[2] * e.n;
      n += e.n;
    }
    return [r / n, g / n, b / n];
  });
  for (let it = 0; it < iterations; it++) {
    const sums = palette.map(() => [0, 0, 0, 0]);
    for (const { c, n } of colors) {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < palette.length; i++) {
        const d = colorDist(c, palette[i]);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      const s = sums[bi];
      s[0] += c[0] * n;
      s[1] += c[1] * n;
      s[2] += c[2] * n;
      s[3] += n;
    }
    palette = palette.map((p, i) =>
      sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : p,
    );
  }
  return palette.map((p) => p.map(Math.round));
}

/** Cada píxel pasa al color más cercano de la paleta: sin tramado, alfa binario. */
export function quantize(img, palette, alphaCut = 128) {
  const { width, height, data } = img;
  const out = new Uint8Array(data.length);
  const cache = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < alphaCut) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let c = cache.get(key);
    if (!c) {
      let bi = 0;
      let bd = Infinity;
      const col = [data[i], data[i + 1], data[i + 2]];
      for (let p = 0; p < palette.length; p++) {
        const d = colorDist(col, palette[p]);
        if (d < bd) {
          bd = d;
          bi = p;
        }
      }
      c = palette[bi];
      cache.set(key, c);
    }
    out[i] = c[0];
    out[i + 1] = c[1];
    out[i + 2] = c[2];
    out[i + 3] = 255;
  }
  return { width, height, data: out };
}

/**
 * Quita píxeles sueltos: uno sin ningún vecino (de 8) de su mismo color y
 * parecido al color mayoritario de su entorno pasa a ese color. Los destellos
 * de alto contraste (estrellas, luces) se conservan: solo se corrige el ruido
 * que deja la cuantización en las zonas casi planas.
 */
export function removeSpeckles(img, maxDist, passes = 1) {
  const { width: w, height: h } = img;
  let data = img.data;
  for (let pass = 0; pass < passes; pass++) {
    const out = new Uint8Array(data);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const o = (y * w + x) * 4;
        if (data[o + 3] === 0) continue;
        const here = [data[o], data[o + 1], data[o + 2]];
        const votes = new Map();
        let same = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const n = ((y + dy) * w + x + dx) * 4;
            if (data[n + 3] === 0) continue;
            const key = (data[n] << 16) | (data[n + 1] << 8) | data[n + 2];
            if (data[n] === here[0] && data[n + 1] === here[1] && data[n + 2] === here[2]) same++;
            votes.set(key, (votes.get(key) ?? 0) + 1);
          }
        if (same > 0) continue;
        let bestKey = -1;
        let bestN = 0;
        for (const [k, n] of votes)
          if (n > bestN) {
            bestN = n;
            bestKey = k;
          }
        if (bestKey < 0 || bestN < 3) continue;
        const target = [bestKey >> 16, (bestKey >> 8) & 255, bestKey & 255];
        if (colorDist(here, target) > maxDist) continue;
        out[o] = target[0];
        out[o + 1] = target[1];
        out[o + 2] = target[2];
      }
    data = out;
  }
  return { width: w, height: h, data };
}

/** Cuántos colores distintos tiene la imagen. */
export function countColors(img) {
  const set = new Set();
  for (let i = 0; i < img.data.length; i += 4)
    if (img.data[i + 3]) set.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
  return set.size;
}

/** Amplía por vecino más próximo (vista previa a 1:n para revisar a ojo). */
export function upscaleNearest(img, n) {
  const { width, height, data } = img;
  const out = new Uint8Array(width * n * height * n * 4);
  for (let y = 0; y < height * n; y++)
    for (let x = 0; x < width * n; x++) {
      const s = (Math.floor(y / n) * width + Math.floor(x / n)) * 4;
      const o = (y * width * n + x) * 4;
      out[o] = data[s];
      out[o + 1] = data[s + 1];
      out[o + 2] = data[s + 2];
      out[o + 3] = data[s + 3];
    }
  return { width: width * n, height: height * n, data: out };
}
