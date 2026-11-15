// Bedrock .mcstructure files: little-endian NBT with a block palette and, for each
// position, an index into it (-1 leaves the world's block as it is). The volcanoes
// that generate with the world are written this way (tools/build.mjs).
import { NS } from '../src/lib/constants.mjs';
import { volcanoBlock, volcanoColumns } from '../src/lib/temp.mjs';

const TAG = { end: 0, byte: 1, int: 3, string: 8, list: 9, compound: 10 };
/** The block version the palette is written for (1.21.60); newer games update it. */
const BLOCK_VERSION = 18168865;

/** NBT values: plain numbers are ints; use these for the other types. */
export const byte = (value) => ({ type: TAG.byte, value });
export const list = (type, items) => ({ type: TAG.list, itemType: TAG[type], items });

function typeOf(value) {
  if (typeof value === 'number') return TAG.int;
  if (typeof value === 'string') return TAG.string;
  if (value.type !== undefined) return value.type;
  return TAG.compound;
}

class Writer {
  parts = [];
  u8(n) {
    this.parts.push(Buffer.from([n & 0xff]));
  }
  i32(n) {
    const b = Buffer.alloc(4);
    b.writeInt32LE(n);
    this.parts.push(b);
  }
  str(s) {
    const data = Buffer.from(s, 'utf8');
    const len = Buffer.alloc(2);
    len.writeUInt16LE(data.length);
    this.parts.push(len, data);
  }
  payload(type, value) {
    if (type === TAG.byte) this.u8(value.value);
    else if (type === TAG.int) this.i32(value);
    else if (type === TAG.string) this.str(value);
    else if (type === TAG.list) {
      this.u8(value.itemType);
      this.i32(value.items.length);
      for (const item of value.items) this.payload(value.itemType, item);
    } else {
      for (const [name, v] of Object.entries(value)) {
        this.u8(typeOf(v));
        this.str(name);
        this.payload(typeOf(v), v);
      }
      this.u8(TAG.end);
    }
  }
}

/** An NBT file: an unnamed root compound. */
export function writeNbt(root) {
  const w = new Writer();
  w.u8(TAG.compound);
  w.str('');
  w.payload(TAG.compound, root);
  return Buffer.concat(w.parts);
}

/** Reads back what writeNbt writes (for the tests). */
export function readNbt(buf) {
  let at = 0;
  const u8 = () => buf[at++];
  const i32 = () => ((at += 4), buf.readInt32LE(at - 4));
  const str = () => {
    const n = buf.readUInt16LE(at);
    at += 2 + n;
    return buf.toString('utf8', at - n, at);
  };
  const payload = (type) => {
    if (type === TAG.byte) return u8();
    if (type === TAG.int) return i32();
    if (type === TAG.string) return str();
    if (type === TAG.list) {
      const t = u8(), n = i32();
      return Array.from({ length: n }, () => payload(t));
    }
    const out = {};
    for (let t = u8(); t !== TAG.end; t = u8()) out[str()] = payload(t);
    return out;
  };
  u8();
  str();
  return payload(TAG.compound);
}

/**
 * A structure of `size` [x, y, z]: `blockAt(x, y, z)` gives a palette entry
 * ({ name, states }) or null to leave the world's block alone.
 */
export function writeStructure(size, blockAt) {
  const [sx, sy, sz] = size;
  const palette = [], seen = new Map(), indices = [];
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        const block = blockAt(x, y, z);
        if (!block) {
          indices.push(-1);
          continue;
        }
        const k = JSON.stringify(block);
        if (!seen.has(k)) {
          seen.set(k, palette.length);
          palette.push({ name: block.name, states: block.states ?? {}, version: BLOCK_VERSION });
        }
        indices.push(seen.get(k));
      }
    }
  }
  return writeNbt({
    format_version: 1,
    size: list('int', size),
    structure: {
      block_indices: list('list', [list('int', indices), list('int', indices.map(() => -1))]),
      entities: list('compound', []),
      palette: { default: { block_palette: list('compound', palette), block_position_data: {} } },
    },
    structure_world_origin: list('int', [0, 0, 0]),
  });
}

/** Bedrock blocks for the kinds volcanoBlock gives. */
const VOLCANO_BLOCKS = {
  vent: { name: `${NS}:volcano_vent`, states: { [`${NS}:grown`]: byte(1) } },
  basalt: { name: 'minecraft:basalt', states: { pillar_axis: 'y' } },
  blackstone: { name: 'minecraft:blackstone' },
  tuff: { name: 'minecraft:tuff' },
  magma: { name: 'minecraft:magma' },
  stone: { name: 'minecraft:stone' },
  lava: { name: 'minecraft:lava', states: { liquid_depth: 0 } },
  air: { name: 'minecraft:air' },
};

/**
 * A volcano as a structure, with `skirt` layers of rock under it to sit on uneven
 * ground. The vent is at (radius, skirt + floor, radius).
 */
export function volcanoStructure(seed, v, skirt = v.skirt) {
  const R = v.radius, size = [2 * R + 1, skirt + v.height + 2, 2 * R + 1];
  const columns = new Map(volcanoColumns(seed, v).map((c) => [`${c.dx},${c.dz}`, c]));
  return writeStructure(size, (x, sy, z) => {
    const col = columns.get(`${x - R},${z - R}`);
    if (!col) return null;
    const y = sy - skirt;
    if (y <= col.top) return VOLCANO_BLOCKS[volcanoBlock(seed, col, y, v)];
    if (col.lava !== undefined) return VOLCANO_BLOCKS[y <= col.lava ? 'lava' : 'air'];
    return null;
  });
}
