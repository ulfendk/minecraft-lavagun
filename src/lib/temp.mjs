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
