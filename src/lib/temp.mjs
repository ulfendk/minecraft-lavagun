// Temporary blocks: lava from a shot, an obsidian shell around a mob, basalt under
// lava walker boots. Each one is remembered with the block it should still be and
// the block to put back, and is put back when its time is up, unless something
// else has changed the block in the meantime.
//
// Plain functions with no game API, shared by the Bedrock scripts (copied to
// scripts/temp.js by tools/build.mjs) and the unit tests. tools/java.mjs does not
// use this file; dk.ulfen.lavagun.world.TemporaryBlocks follows the same rules.

/** Blocks a shot or a shell may take the place of: air and things you walk through. */
export const REPLACEABLE = new Set([
  'minecraft:air', 'minecraft:cave_air', 'minecraft:void_air',
  'minecraft:short_grass', 'minecraft:tall_grass', 'minecraft:fern', 'minecraft:large_fern',
  'minecraft:snow_layer', 'minecraft:fire', 'minecraft:soul_fire', 'minecraft:deadbush', 'minecraft:dead_bush',
  'minecraft:dandelion', 'minecraft:poppy', 'minecraft:red_flower', 'minecraft:yellow_flower',
  'minecraft:seagrass', 'minecraft:vine', 'minecraft:glow_lichen', 'minecraft:nether_sprouts',
  'minecraft:crimson_roots', 'minecraft:warped_roots', 'minecraft:leaf_litter',
]);

export const canReplace = (typeId) => REPLACEABLE.has(typeId);

/** Where the obsidian gun's lava may set into obsidian: what a shot may replace, and lava. */
export const canSet = (typeId) => canReplace(typeId) || typeId === 'minecraft:lava' || typeId === 'minecraft:flowing_lava';

export const key = ({ d, x, y, z }) => `${d}|${x}|${y}|${z}`;

/**
 * A list of temporary blocks. Entries: { d: dimension, x, y, z, b: the block it
 * should be, r: the block to put back, t: ticks left }.
 */
export class TempBlocks {
  constructor(entries = []) {
    this.entries = new Map(entries.map((e) => [key(e), e]));
  }

  has(pos) {
    return this.entries.has(key(pos));
  }

  get(pos) {
    return this.entries.get(key(pos));
  }

  /** Remember a block. A block that is already temporary keeps its first entry (and what to put back). */
  add(e) {
    if (this.entries.has(key(e))) return false;
    this.entries.set(key(e), { ...e });
    return true;
  }

  /** Give a block at least `ticks` more (lava walker basalt lasts while someone stands on it). */
  refresh(pos, ticks) {
    const e = this.entries.get(key(pos));
    if (!e) return false;
    e.t = Math.max(e.t, ticks);
    return true;
  }

  forget(pos) {
    this.entries.delete(key(pos));
  }

  /** Count down `ticks` and return the entries whose time is up (and forget them). */
  tick(ticks) {
    const due = [];
    for (const [k, e] of this.entries) {
      e.t -= ticks;
      if (e.t <= 0) {
        due.push(e);
        this.entries.delete(k);
      }
    }
    return due;
  }

  get size() {
    return this.entries.size;
  }

  toJSON() {
    return [...this.entries.values()];
  }

  static fromJSON(text) {
    try {
      const list = JSON.parse(text);
      return new TempBlocks(Array.isArray(list) ? list.filter((e) => e && typeof e.t === 'number') : []);
    } catch {
      return new TempBlocks();
    }
  }
}

/**
 * Should a block whose time is up be put back? Only if it is still what we placed:
 * lava that met water and became obsidian, or a shell block that a player mined,
 * is left alone.
 */
export const shouldRestore = (entry, currentTypeId) => sameBlock(currentTypeId, entry.b);

/** Lava (or water) that has started to flow is still the same block to us. */
export const sameBlock = (a, b) => a?.replace(':flowing_', ':') === b?.replace(':flowing_', ':');

// ---------------------------------------------------------------- shapes

/** The blocks a hitbox stands in: [min, max] corner blocks (inclusive). */
export function interior({ min, max }) {
  const eps = 1e-3;
  const lo = min.map((v) => Math.floor(v + eps));
  const hi = max.map((v, i) => Math.max(lo[i], Math.floor(v - eps)));
  return [lo, hi];
}

/**
 * The hollow shell around a hitbox: every block that touches the blocks the mob
 * stands in (sides, floor and roof, corners included), but not those blocks
 * themselves, so the mob stands in air and does not suffocate. Returns null if the
 * mob is too big to shut in.
 */
export function shellPositions(box, { maxWidth = 3, maxHeight = 4 } = {}) {
  const [lo, hi] = interior(box);
  const size = hi.map((v, i) => v - lo[i] + 1);
  if (size[0] > maxWidth || size[2] > maxWidth || size[1] > maxHeight) return null;
  const out = [];
  for (let x = lo[0] - 1; x <= hi[0] + 1; x++)
    for (let y = lo[1] - 1; y <= hi[1] + 1; y++)
      for (let z = lo[2] - 1; z <= hi[2] + 1; z++) {
        const inside = x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1] && z >= lo[2] && z <= hi[2];
        if (!inside) out.push({ x, y, z });
      }
  return out;
}

/** Blocks in a flat ring of `radius` around (x, z), at height y. */
export function ring(cx, y, cz, radius) {
  const out = [];
  for (let x = -radius; x <= radius; x++)
    for (let z = -radius; z <= radius; z++) {
      const d = Math.hypot(x, z);
      if (d > radius - 0.5 && d <= radius + 0.5) out.push({ x: cx + x, y, z: cz + z });
    }
  return out;
}

/** Blocks within `radius` (a disc) around (x, z), at height y. */
export function disc(cx, y, cz, radius) {
  const out = [];
  for (let x = -radius; x <= radius; x++)
    for (let z = -radius; z <= radius; z++) if (Math.hypot(x, z) <= radius + 0.25) out.push({ x: cx + x, y, z: cz + z });
  return out;
}

/**
 * Where the obsidian gun's lava sets: a disc around `c`, flat against the face that
 * was hit (`axis` is the axis the face points along: 'y' for a floor or ceiling, so
 * the disc lies flat; 'x' or 'z' for a wall, so it stands up). Blocks inside `avoid`
 * (a hitbox) are left out, so a mob that is hit is not set into the obsidian itself.
 */
export function splat(c, axis, radius, avoid = null) {
  const [lo, hi] = avoid ? interior(avoid) : [];
  const inside = (p) => lo && p.x >= lo[0] && p.x <= hi[0] && p.y >= lo[1] && p.y <= hi[1] && p.z >= lo[2] && p.z <= hi[2];
  const out = [];
  for (const { x: a, z: b } of disc(0, 0, 0, radius)) {
    const p = axis === 'x' ? { x: c.x, y: c.y + a, z: c.z + b } : axis === 'z' ? { x: c.x + a, y: c.y + b, z: c.z } : { x: c.x + a, y: c.y, z: c.z + b };
    if (!inside(p)) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- hits

/** Damage that falls off linearly from `damage` at the centre to nothing at `radius`. */
export function falloff(damage, distance, radius) {
  if (distance >= radius) return 0;
  return Math.max(1, Math.round(damage * (1 - distance / radius)));
}

/** Is `point` within `range` of `origin` and within `angle` degrees of the direction `dir`? */
export function inCone(origin, dir, point, range, angle) {
  const v = [point.x - origin.x, point.y - origin.y, point.z - origin.z];
  const dist = Math.hypot(...v);
  if (dist > range) return false;
  if (dist < 0.75) return true;
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const cos = (v[0] * dir.x + v[1] * dir.y + v[2] * dir.z) / (dist * len);
  return cos >= Math.cos((angle * Math.PI) / 180);
}

/** Smelted forms of the blocks the magmasteel pickaxe melts down as it mines them. */
export const SMELT = {
  'minecraft:iron_ore': 'minecraft:iron_ingot',
  'minecraft:deepslate_iron_ore': 'minecraft:iron_ingot',
  'minecraft:gold_ore': 'minecraft:gold_ingot',
  'minecraft:deepslate_gold_ore': 'minecraft:gold_ingot',
  'minecraft:nether_gold_ore': 'minecraft:gold_ingot',
  'minecraft:copper_ore': 'minecraft:copper_ingot',
  'minecraft:deepslate_copper_ore': 'minecraft:copper_ingot',
  'minecraft:raw_iron_block': 'minecraft:iron_block',
  'minecraft:raw_gold_block': 'minecraft:gold_block',
  'minecraft:raw_copper_block': 'minecraft:copper_block',
  'minecraft:sand': 'minecraft:glass',
  'minecraft:cobblestone': 'minecraft:stone',
  'minecraft:ancient_debris': 'minecraft:netherite_scrap',
};

/** How many ingots an ore melts into: copper ore gives 2–5 raw copper, so 2–5 ingots. */
export function smeltCount(block, random = Math.random) {
  return block.includes('copper_ore') ? 2 + Math.floor(random() * 4) : 1;
}

// ---------------------------------------------------------------- the lava cannon

/**
 * How far a shot flies over flat ground: it leaves at `speed` blocks a tick, `angle`
 * degrees up, `height` blocks above the ground, and each tick moves, slows by 1 %
 * in the air and falls by `gravity` (as thrown things do in both editions).
 */
export function shotRange(speed, angle, gravity, height) {
  const a = (angle * Math.PI) / 180;
  let x = 0, y = height, vx = speed * Math.cos(a), vy = speed * Math.sin(a);
  for (let t = 0; t < 1200; t++) {
    x += vx;
    y += vy;
    if (y <= 0) return x;
    vx *= 0.99;
    vy = vy * 0.99 - gravity;
  }
  return x;
}

/** The speed that carries a shot `range` blocks (see shotRange). */
export function shotSpeed(range, angle, gravity, height) {
  let lo = 0.05, hi = 8;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (shotRange(mid, angle, gravity, height) < range) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The next range setting after `n`: 1, 2, … `count`, then 1 again. */
export const nextRange = (n, count) => (n % count) + 1;

// ---------------------------------------------------------------- volcanoes

/** A number in [0, 1) from a seed and a position; the same in dk.ulfen.lavagun.world.Volcano. */
export function hash01(seed, x, y, z) {
  let h = (Math.imul(x, 0x27d4eb2d) + Math.imul(y, 0x165667b1) + Math.imul(z, 0x9e3779b1) + seed) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Which way the notch in the rim faces, in radians. */
export const notchAngle = (seed) => hash01(seed, 7, 7, 7) * 2 * Math.PI;

/**
 * The shape of a volcano: one column per (dx, dz) round the vent. Heights are in
 * blocks above the vent's base: a column is solid from the ground up to `top`, and a
 * crater column has lava above it up to `lava`. The vent is the top of the middle
 * column. The rim is cut lower where the notch is, and a groove runs from there down
 * the side, so the crater's lava runs out and down all the time.
 */
export function volcanoColumns(seed, v) {
  const R = v.radius, H = v.height, cR = v.crater.radius, floor = H - v.crater.depth;
  const phases = [1, 2, 3].map((k) => hash01(seed, k, 0, 0) * 2 * Math.PI);
  const notch = notchAngle(seed);
  const nx = Math.cos(notch), nz = Math.sin(notch);
  const columns = [];
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const r = Math.sqrt(dx * dx + dz * dz);
      if (r > R) continue;
      const a = Math.atan2(dz, dx);
      // The foot wobbles in and out a little, so it isn't a perfect circle.
      const wobble = (Math.cos(a + phases[0]) + Math.cos(2 * a + phases[1]) + Math.cos(3 * a + phases[2])) / 3;
      const foot = R - 1.5 + 1.5 * wobble;
      if (r < cR + 0.5) {
        columns.push({ dx, dz, top: floor, lava: H - 1 });
        continue;
      }
      if (r >= foot) continue;
      const along = dx * nx + dz * nz, across = Math.abs(dz * nx - dx * nz);
      const groove = along > 0 && across < 0.75;
      let top = r < cR + 1.5 ? H : Math.round(H * Math.pow((foot - r) / (foot - cR - 1), v.profile));
      if (groove) top = Math.min(top - 1, H - 2);
      if (top < 0) continue;
      columns.push({ dx, dz, top });
    }
  }
  return columns;
}

/**
 * What a volcano's block at height `y` of a column is made of: basalt on the outside,
 * with some blackstone, tuff and, more of it near the top, magma; stone inside; magma
 * round the crater; the vent in the middle.
 */
export function volcanoBlock(seed, col, y, v) {
  if (col.dx === 0 && col.dz === 0 && y === col.top) return 'vent';
  const r = Math.sqrt(col.dx * col.dx + col.dz * col.dz);
  if (r < v.crater.radius + 1.5 && y >= v.height - v.crater.depth - 2) return 'magma';
  if (col.top - y >= 2 && col.top > 2) return 'stone';
  const n = hash01(seed, col.dx, y, col.dz);
  const magma = 0.04 + 0.12 * Math.max(0, y) / v.height;
  if (n < magma) return 'magma';
  if (n < magma + 0.15) return 'blackstone';
  if (n < magma + 0.25) return 'tuff';
  return 'basalt';
}

/** How fast to throw a volcano bomb (blocks a tick) so it lands `reach` blocks away. */
export const bombSpeed = (reach, angle, gravity) => shotSpeed(reach, angle, gravity, 0);
