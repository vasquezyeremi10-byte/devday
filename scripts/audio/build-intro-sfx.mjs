// Sintetiza los sonidos originales de la introducción del estudio (WAV PCM
// de 16 bits, mono). No usa muestras de terceros: todo sale de osciladores,
// ruido con semilla fija y una reverberación Schroeder sencilla, así que el
// resultado es el mismo en cada ejecución.
//   node scripts/audio/build-intro-sfx.mjs
// Salidas en public/assets/audio/:
//   intro-impact.wav   golpe de picota sobre roca con eco de galería (logo)
//   intro-chime.wav    tintineo metálico breve (logotipos adicionales)
//   intro-ambience.wav viento de desierto y galería, en bucle (transición y menú)
//   ui-move.wav        tic al cambiar de opción en el menú
//   ui-confirm.wav     golpe ligero de picota al confirmar
//   ui-back.wav        dos tics que bajan al volver o cancelar
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = join(ROOT, 'public/assets/audio');

/** Generador pseudoaleatorio con semilla (mulberry32): ruido reproducible. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reverberación Schroeder: cuatro peines en paralelo y dos pasatodos. */
function reverb(input, rate, { wet, feedback, damp = 0.25 }) {
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((s) => ({
    buf: new Float32Array(Math.round(s * rate)),
    i: 0,
    low: 0,
  }));
  const alls = [0.005, 0.0017].map((s) => ({
    buf: new Float32Array(Math.round(s * rate)),
    i: 0,
  }));
  const out = new Float32Array(input.length);
  for (let n = 0; n < input.length; n++) {
    let sum = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.low = y * (1 - damp) + c.low * damp;
      c.buf[c.i] = input[n] + c.low * feedback;
      c.i = (c.i + 1) % c.buf.length;
      sum += y;
    }
    let y = sum / combs.length;
    for (const a of alls) {
      const b = a.buf[a.i];
      const v = y + b * 0.7;
      a.buf[a.i] = v;
      a.i = (a.i + 1) % a.buf.length;
      y = b - v * 0.7;
    }
    out[n] = input[n] * (1 - wet) + y * wet;
  }
  return out;
}

/** Normaliza al pico indicado y suaviza el final para que no haga clic. */
function finish(samples, rate, peak, tailMs = 60) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  const gain = max > 0 ? peak / max : 1;
  const tail = Math.round((tailMs / 1000) * rate);
  return samples.map((s, n) => {
    const fade = n > samples.length - tail ? (samples.length - n) / tail : 1;
    return s * gain * fade;
  });
}

function writeWav(name, samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, n) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), n * 2),
  );
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  const path = join(OUT, name);
  writeFileSync(path, Buffer.concat([head, data]));
  console.log(`${name}: ${(samples.length / rate).toFixed(2)} s, ${rate} Hz`);
}

/**
 * Picota contra roca: chasquido de ruido, parciales metálicos inarmónicos
 * que se apagan rápido, golpe grave de la roca y retumbo de galería con eco.
 */
function impact() {
  const rate = 44100;
  const length = Math.round(2.6 * rate);
  const random = rng(0x51ce);
  const dry = new Float32Array(length);
  const partials = [
    [1180, 0.34, 0.34],
    [1937, 0.2, 0.22],
    [2613, 0.13, 0.15],
    [3391, 0.07, 0.09],
  ];
  let rumble = 0;
  for (let n = 0; n < length; n++) {
    const t = n / rate;
    const noise = random() * 2 - 1;
    // Chasquido del metal al tocar la piedra (pocos milisegundos).
    let s = noise * 0.55 * Math.exp(-t / 0.0045);
    for (const [f, a, d] of partials)
      s += a * Math.sin(2 * Math.PI * f * t * (1 + 0.0006 * Math.sin(t * 31))) *
        Math.exp(-t / d);
    // Golpe grave: la roca recibe el impacto (tono que cae de 78 a 52 Hz).
    const f0 = 52 + 26 * Math.exp(-t / 0.08);
    s += 0.62 * Math.sin(2 * Math.PI * f0 * t) * Math.exp(-t / 0.24);
    // Retumbo de galería: ruido muy filtrado que se apaga lento.
    rumble += (noise - rumble) * 0.012;
    s += rumble * 1.4 * Math.exp(-t / 0.7) * Math.min(1, t / 0.02);
    dry[n] = s;
  }
  const wet = reverb(dry, rate, { wet: 0.32, feedback: 0.8, damp: 0.35 });
  return { samples: finish(wet, rate, 0.82, 200), rate };
}

/** Tintineo metálico suave y corto para cada logotipo adicional. */
function chime() {
  const rate = 44100;
  const length = Math.round(1.3 * rate);
  const random = rng(0xc41e);
  const dry = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    const t = n / rate;
    const noise = random() * 2 - 1;
    dry[n] =
      noise * 0.18 * Math.exp(-t / 0.003) +
      0.3 * Math.sin(2 * Math.PI * 2093 * t) * Math.exp(-t / 0.32) +
      0.16 * Math.sin(2 * Math.PI * 3136 * t) * Math.exp(-t / 0.2) +
      0.08 * Math.sin(2 * Math.PI * 4699 * t) * Math.exp(-t / 0.12);
  }
  const wet = reverb(dry, rate, { wet: 0.25, feedback: 0.72 });
  return { samples: finish(wet, rate, 0.55, 150), rate };
}

/**
 * Viento de desierto que entra a la galería: ruido filtrado con un filtro que
 * respira lento y un zumbido grave muy bajo. Se cierra en bucle cruzando el
 * último segundo con el principio.
 */
function ambience() {
  const rate = 22050;
  const loop = 8 * rate;
  const overlap = rate;
  const random = rng(0xa7b1);
  const raw = new Float32Array(loop + overlap);
  let lp1 = 0,
    lp2 = 0;
  for (let n = 0; n < raw.length; n++) {
    const t = n / rate;
    const noise = random() * 2 - 1;
    // Las ráfagas: el corte del filtro sube y baja con dos LFO lentos.
    const gust =
      0.5 + 0.3 * Math.sin(2 * Math.PI * 0.125 * t) + 0.2 * Math.sin(2 * Math.PI * 0.31 * t + 1.3);
    const k = 0.012 + 0.03 * gust;
    lp1 += (noise - lp1) * k;
    lp2 += (lp1 - lp2) * k;
    const hum = 0.05 * Math.sin(2 * Math.PI * 48 * t) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.07 * t));
    raw[n] = lp2 * (0.6 + 0.4 * gust) * 6 + hum;
  }
  const out = new Float32Array(loop);
  for (let n = 0; n < loop; n++) {
    if (n < overlap) {
      const w = n / overlap;
      out[n] = raw[n] * w + raw[loop + n] * (1 - w);
    } else out[n] = raw[n];
  }
  // Sin cola: el bucle debe empalmar sin silencio.
  return { samples: finish(out, rate, 0.5, 0), rate };
}

/** Menú: tic metálico muy corto y suave al cambiar de opción. */
function uiMove() {
  const rate = 44100;
  const length = Math.round(0.14 * rate);
  const random = rng(0x0e01);
  const out = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    const t = n / rate;
    out[n] =
      (random() * 2 - 1) * 0.12 * Math.exp(-t / 0.002) +
      0.32 * Math.sin(2 * Math.PI * 2637 * t) * Math.exp(-t / 0.03) +
      0.14 * Math.sin(2 * Math.PI * 3951 * t) * Math.exp(-t / 0.018);
  }
  return { samples: finish(out, rate, 0.32, 30), rate };
}

/** Menú: golpe ligero de picota con un tono que sube al confirmar. */
function uiConfirm() {
  const rate = 44100;
  const length = Math.round(0.7 * rate);
  const random = rng(0x0e02);
  const dry = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    const t = n / rate;
    const noise = random() * 2 - 1;
    const f0 = 98 + 30 * Math.exp(-t / 0.05);
    dry[n] =
      noise * 0.4 * Math.exp(-t / 0.003) +
      0.26 * Math.sin(2 * Math.PI * 1568 * t) * Math.exp(-t / 0.16) +
      0.18 * Math.sin(2 * Math.PI * 2349 * t) * Math.exp(-t / 0.1) +
      (t > 0.06 ? 0.16 * Math.sin(2 * Math.PI * 3136 * (t - 0.06)) * Math.exp(-(t - 0.06) / 0.12) : 0) +
      0.45 * Math.sin(2 * Math.PI * f0 * t) * Math.exp(-t / 0.08);
  }
  const wet = reverb(dry, rate, { wet: 0.22, feedback: 0.7 });
  return { samples: finish(wet, rate, 0.6, 120), rate };
}

/** Menú: dos tics que bajan al volver o cancelar. */
function uiBack() {
  const rate = 44100;
  const length = Math.round(0.26 * rate);
  const out = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    const t = n / rate;
    const second = t - 0.07;
    out[n] =
      0.3 * Math.sin(2 * Math.PI * 1976 * t) * Math.exp(-t / 0.03) +
      (second > 0 ? 0.3 * Math.sin(2 * Math.PI * 1319 * second) * Math.exp(-second / 0.05) : 0);
  }
  return { samples: finish(out, rate, 0.34, 40), rate };
}

mkdirSync(OUT, { recursive: true });
for (const [name, build] of [
  ['intro-impact.wav', impact],
  ['intro-chime.wav', chime],
  ['intro-ambience.wav', ambience],
  ['ui-move.wav', uiMove],
  ['ui-confirm.wav', uiConfirm],
  ['ui-back.wav', uiBack],
]) {
  const { samples, rate } = build();
  writeWav(name, samples, rate);
}
