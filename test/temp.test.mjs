import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canReplace, disc, falloff, inCone, interior, ring, sameBlock, shellPositions, shouldRestore, TempBlocks } from '../src/lib/temp.mjs';

const pig = { min: [10.05, 0, 10.05], max: [10.95, 0.9, 10.95] };

test('a shell is hollow: it surrounds the blocks the mob stands in, and leaves them empty', () => {
  const shell = shellPositions(pig);
  assert.equal(shell.length, 3 * 3 * 3 - 1);
  assert.ok(!shell.some((p) => p.x === 10 && p.y === 0 && p.z === 10));
  for (const side of [[11, 0, 10], [9, 0, 10], [10, 0, 11], [10, 0, 9], [10, 1, 10], [10, -1, 10]]) {
    assert.ok(shell.some((p) => p.x === side[0] && p.y === side[1] && p.z === side[2]), `${side}`);
  }
});

test('a tall mob gets a tall shell; one too big gets none', () => {
  const zombie = { min: [0.2, 0, 0.2], max: [0.8, 1.95, 0.8] };
  const [lo, hi] = interior(zombie);
  assert.deepEqual(lo, [0, 0, 0]);
  assert.deepEqual(hi, [0, 1, 0]);
  assert.equal(shellPositions(zombie).length, 3 * 4 * 3 - 2);
  const ravager = { min: [-1, 0, -1], max: [1, 2.2, 1] };
  assert.ok(shellPositions(ravager, { maxWidth: 3, maxHeight: 4 }));
  const dragon = { min: [-8, 0, -8], max: [8, 8, 8] };
  assert.equal(shellPositions(dragon), null);
});

test('temporary blocks count down, come back when due, and survive saving', () => {
  const t = new TempBlocks();
  const e = { d: 'overworld', x: 1, y: 2, z: 3, b: 'minecraft:lava', r: 'minecraft:air', t: 10 };
  assert.ok(t.add(e));
  assert.ok(!t.add({ ...e, t: 99 }), 'the first entry wins');
  assert.deepEqual(t.tick(5), []);
  const back = TempBlocks.fromJSON(JSON.stringify(t));
  assert.equal(back.size, 1);
  const due = back.tick(5);
  assert.equal(due.length, 1);
  assert.equal(back.size, 0);
  assert.equal(TempBlocks.fromJSON('not json').size, 0);
});

test('a refreshed block lasts longer; time never goes backwards', () => {
  const t = new TempBlocks([{ d: 'overworld', x: 0, y: 0, z: 0, b: 'minecraft:basalt', r: 'minecraft:lava', t: 4 }]);
  t.refresh({ d: 'overworld', x: 0, y: 0, z: 0 }, 80);
  assert.equal(t.tick(10).length, 0);
  t.refresh({ d: 'overworld', x: 0, y: 0, z: 0 }, 1);
  assert.equal(t.tick(60).length, 0);
  assert.equal(t.tick(20).length, 1);
});

test('only blocks that are still what we placed are put back', () => {
  const e = { b: 'minecraft:lava' };
  assert.ok(shouldRestore(e, 'minecraft:lava'));
  assert.ok(shouldRestore(e, 'minecraft:flowing_lava'));
  assert.ok(!shouldRestore(e, 'minecraft:obsidian'), 'lava that met water stays obsidian');
  assert.ok(!shouldRestore({ b: 'minecraft:obsidian' }, 'minecraft:air'), 'a mined shell block is not put back');
  assert.ok(sameBlock('minecraft:flowing_water', 'minecraft:water'));
});

test('shots replace air and plants, never solid blocks or liquids', () => {
  for (const id of ['minecraft:air', 'minecraft:short_grass', 'minecraft:fire', 'minecraft:snow_layer']) assert.ok(canReplace(id), id);
  for (const id of ['minecraft:stone', 'minecraft:water', 'minecraft:lava', 'minecraft:chest', 'minecraft:obsidian']) assert.ok(!canReplace(id), id);
});

test('splash damage falls off with distance, cones and rings have the right shape', () => {
  assert.equal(falloff(6, 0, 3), 6);
  assert.equal(falloff(6, 3, 3), 0);
  assert.ok(falloff(6, 1.5, 3) >= 1 && falloff(6, 1.5, 3) < 6);
  const o = { x: 0, y: 0, z: 0 };
  assert.ok(inCone(o, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 4 }, 6, 25));
  assert.ok(!inCone(o, { x: 0, y: 0, z: 1 }, { x: 4, y: 0, z: 1 }, 6, 25));
  assert.ok(!inCone(o, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 7 }, 6, 25));
  const r = ring(0, 0, 0, 2);
  assert.ok(r.length >= 8 && !r.some((p) => p.x === 0 && p.z === 0));
  assert.ok(disc(0, 0, 0, 2).some((p) => p.x === 0 && p.z === 0));
});
