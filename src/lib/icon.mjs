// Pack icon: a lava gun firing a glowing blob over a lake of lava in the Nether,
// drawn at 32x32 and scaled up.
import { PNG } from 'pngjs';
import { fbm, hex, mix } from './texture.mjs';

export function packIcon(scale = 8) {
  const N = 32;
  const px = Array.from({ length: N }, () => new Array(N));
  // Nether haze: dark red at the top, glowing orange towards the lava.
  for (let y = 0; y < N; y++) {
    const c = mix(hex('#2a0e06'), hex('#a8321a'), y / 24);
    for (let x = 0; x < N; x++) px[y][x] = c;
  }
  // Basalt pillars in the distance.
  const fill = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (y >= 0 && y < N && x >= 0 && x < N) px[y][x] = hex(c);
  };
  fill(1, 9, 3, 24, '#3a2a2a'); fill(27, 6, 30, 24, '#3a2a2a'); fill(22, 14, 24, 24, '#4a3434');
  // A lake of lava along the bottom.
  for (let y = 22; y < N; y++)
    for (let x = 0; x < N; x++) {
      const n = fbm(x / 4, y / 3, 0, 5);
      px[y][x] = n > 0.6 ? hex('#ffd23a') : n > 0.42 ? hex('#ff7a1a') : hex('#c8321a');
    }
  // The gun, pointing right and up a little.
  fill(3, 15, 15, 17, '#30343a');
  fill(4, 14, 14, 14, '#7b818a');
  fill(8, 12, 11, 13, '#c8321a'); fill(9, 12, 10, 12, '#ffd23a'); // lava tank
  fill(5, 18, 7, 21, '#5a3a22'); // grip
  fill(16, 15, 17, 16, '#ff7a1a'); // muzzle flash
  // The shot: a blob of lava with a glowing trail.
  for (let k = 0; k < 6; k++) fill(18 + k, 14 - Math.floor(k / 2), 18 + k, 14 - Math.floor(k / 2), k % 2 ? '#ff7a1a' : '#ffd23a');
  for (let y = 5; y < 12; y++)
    for (let x = 22; x < 30; x++) {
      const d = Math.hypot(x - 25.5, y - 8);
      if (d < 3.6) px[y][x] = mix(hex('#fff2a0'), hex('#ff7a1a'), d / 3.6);
    }

  const png = new PNG({ width: N * scale, height: N * scale });
  for (let y = 0; y < N * scale; y++)
    for (let x = 0; x < N * scale; x++) png.data.set(px[Math.floor(y / scale)][Math.floor(x / scale)], (y * N * scale + x) * 4);
  return PNG.sync.write(png);
}
