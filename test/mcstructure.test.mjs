import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byte, readNbt, volcanoStructure, writeStructure } from '../tools/mcstructure.mjs';
import { RULES } from '../src/rules.mjs';

test('a structure is written as Bedrock reads it: size, palette and an index per position (x, then y, then z)', () => {
  const stone = { name: 'minecraft:stone' };
  const lava = { name: 'minecraft:lava', states: { liquid_depth: 0 } };
  const nbt = readNbt(writeStructure([2, 2, 2], (x, y, z) => (y === 0 ? stone : x === 1 && z === 1 ? lava : null)));
  assert.equal(nbt.format_version, 1);
  assert.deepEqual(nbt.size, [2, 2, 2]);
  assert.deepEqual(nbt.structure_world_origin, [0, 0, 0]);
  const palette = nbt.structure.palette.default.block_palette;
  assert.deepEqual(palette.map((p) => p.name), ['minecraft:stone', 'minecraft:lava']);
  assert.deepEqual(palette[1].states, { liquid_depth: 0 });
  const [blocks, water] = nbt.structure.block_indices;
  assert.deepEqual(blocks, [0, 0, -1, -1, 0, 0, -1, 1]);
  assert.deepEqual(water, Array(8).fill(-1));
  assert.deepEqual(nbt.structure.entities, []);
});

test('the volcano structure has the grown vent in the middle of the crater floor', () => {
  const v = RULES.volcano;
  const nbt = readNbt(volcanoStructure(0, v));
  const [sx, sy, sz] = nbt.size;
  assert.deepEqual([sx, sz], [2 * v.radius + 1, 2 * v.radius + 1]);
  const palette = nbt.structure.palette.default.block_palette;
  const vent = palette.findIndex((p) => p.name === 'lavagun:volcano_vent');
  assert.deepEqual(palette[vent].states, { 'lavagun:grown': 1 });
  const at = (x, y, z) => nbt.structure.block_indices[0][(x * sy + y) * sz + z];
  assert.equal(at(v.radius, v.skirt + v.height - v.crater.depth, v.radius), vent);
  assert.equal(palette[at(v.radius, v.skirt + v.height - 1, v.radius)].name, 'minecraft:lava');
  assert.equal(at(0, sy - 1, 0), -1, 'outside the cone the world is left as it is');
  assert.equal(byte(1).value, 1);
});
