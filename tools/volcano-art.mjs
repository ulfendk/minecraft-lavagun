// A picture of a volcano for the site and the preview sheet: its blocks drawn as an
// isometric pile of cubes, from the same shape the game builds (src/lib/temp.mjs).
import { PNG } from 'pngjs';
import { notchAngle, volcanoBlock, volcanoColumns } from '../src/lib/temp.mjs';

const COLOURS = {
  basalt: [74, 72, 80], blackstone: [44, 40, 48], tuff: [108, 108, 100], magma: [184, 70, 26], stone: [122, 122, 122],
  vent: [255, 90, 0], lava: [255, 122, 26], ground: [86, 125, 70],
};
const SHADE = { top: 1, left: 0.78, right: 0.6 };

/** Fill a convex polygon (screen points) with `rgb`. */
function fill(png, points, rgb) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const [x0, x1] = [Math.max(0, Math.floor(Math.min(...xs))), Math.min(png.width - 1, Math.ceil(Math.max(...xs)))];
  const [y0, y1] = [Math.max(0, Math.floor(Math.min(...ys))), Math.min(png.height - 1, Math.ceil(Math.max(...ys)))];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let pos = 0, neg = 0;
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
        const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
        if (cross > 0) pos++;
        else if (cross < 0) neg++;
      }
      if (pos && neg) continue;
      const k = (y * png.width + x) * 4;
      png.data[k] = rgb[0];
      png.data[k + 1] = rgb[1];
      png.data[k + 2] = rgb[2];
      png.data[k + 3] = 255;
    }
  }
}

const tint = (rgb, k, n = 0) => rgb.map((c) => Math.max(0, Math.min(255, Math.round(c * k + n))));

/** The volcano `seed` as a PNG `width` pixels wide, on a patch of grass, with lava running down its groove. */
export function volcanoPicture(seed, v, width = 640) {
  const R = v.radius;
  const s = width / ((2 * R + 3) * 2 * Math.cos(Math.PI / 6));
  const cx = width / 2, top = Math.max(v.height + 5, R + 1) * s;
  const height = Math.ceil(top + (R + 3) * s);
  const png = new PNG({ width, height });
  const screen = (x, y, z) => [cx + (x - z) * s * Math.cos(Math.PI / 6), top + (x + z) * s * Math.sin(Math.PI / 6) - y * s];

  // Turn it a quarter at a time until the notch, and the lava running from it, faces us.
  const a = notchAngle(seed);
  const turns = ((Math.round((Math.PI / 4 - a) / (Math.PI / 2)) % 4) + 4) % 4;
  const turn = (x, z, n) => (n ? turn(-z, x, n - 1) : [x, z]);
  const at = new Map(volcanoColumns(seed, v).map((c) => [turn(c.dx, c.dz, turns).join(','), c]));
  const flowing = (c) => !c.lava && Math.hypot(c.dx, c.dz) > v.crater.radius + 0.5
    && Math.cos(Math.atan2(c.dz, c.dx) - a) > 0.9 && Math.abs(c.dz * Math.cos(a) - c.dx * Math.sin(a)) < 0.75;
  const cubes = [];
  for (let dx = -R - 1; dx <= R + 1; dx++) {
    for (let dz = -R - 1; dz <= R + 1; dz++) {
      if (Math.hypot(dx, dz) > R + 1.5) continue;
      const c = at.get(`${dx},${dz}`);
      cubes.push({ x: dx, y: -1, z: dz, rgb: COLOURS.ground });
      if (!c) continue;
      for (let y = 0; y <= c.top; y++) cubes.push({ x: dx, y, z: dz, rgb: COLOURS[volcanoBlock(seed, c, y, v)], glow: y === c.top && flowing(c) });
      if (c.lava) for (let y = c.top + 1; y <= c.lava; y++) cubes.push({ x: dx, y, z: dz, rgb: COLOURS.lava, glow: true });
    }
  }
  // Back to front: far corner (small x + z) first, bottom first.
  cubes.sort((p, q) => p.x + p.z - (q.x + q.z) || p.y - q.y);
  for (const { x, y, z, rgb, glow } of cubes) {
    const P = (dx, dy, dz) => screen(x + dx, y + dy, z + dz);
    const topRgb = glow ? COLOURS.lava : rgb;
    const n = ((x * 7 + z * 13 + y * 5) % 5) * 3 - 6;
    fill(png, [P(0, 1, 0), P(1, 1, 0), P(1, 1, 1), P(0, 1, 1)], tint(topRgb, SHADE.top, n));
    fill(png, [P(0, 1, 1), P(1, 1, 1), P(1, 0, 1), P(0, 0, 1)], tint(rgb, SHADE.left, n));
    fill(png, [P(1, 1, 0), P(1, 0, 0), P(1, 0, 1), P(1, 1, 1)], tint(rgb, SHADE.right, n));
  }
  return PNG.sync.write(png);
}
