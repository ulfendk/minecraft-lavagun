import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';
import { BLOCK_RECIPES, BLOCKS, tankStage } from '../src/blocks.mjs';
import { CREATURES } from '../src/creatures.mjs';
import { ITEMS, RECIPES } from '../src/items.mjs';
import { langEntries, LOCALES, STRINGS } from '../src/i18n.mjs';
import { RULES } from '../src/rules.mjs';
import { PROJECTILES } from '../src/lib/entity.mjs';
import { NS } from '../src/lib/constants.mjs';

const ctx = { items: ITEMS, blocks: BLOCKS, creatures: CREATURES, projectiles: PROJECTILES, version: '0' };
const recipes = [...RECIPES, ...BLOCK_RECIPES];
const VANILLA = new Set(Object.values(MinecraftItemTypes));
const results = new Set(recipes.map((r) => Object.values(r)[0].result.item));

test('every item has an icon and an English and a Danish name', () => {
  for (const it of ITEMS) {
    assert.ok(it.icon, `${it.id}: icon`);
    assert.equal(it.name.length, 2, `${it.id}: name`);
    assert.ok(it.name.every(Boolean), `${it.id}: name`);
  }
  for (const b of BLOCKS) assert.ok(b.name.every(Boolean), b.id);
  for (const c of CREATURES) assert.ok(c.name.every(Boolean), c.id);
});

test('every in-game text exists in both languages, and the site texts too', () => {
  const [en, da] = LOCALES.map((l) => new Map(langEntries(l, ctx)));
  assert.deepEqual([...en.keys()], [...da.keys()]);
  for (const [k, v] of da) assert.ok(v, `${k} is empty in Danish`);
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.da).sort());
  for (const id of Object.keys(RULES.guns)) assert.ok(STRINGS.en.guns[id] && STRINGS.da.guns[id], id);
  for (const c of CREATURES) assert.ok(STRINGS.en.creatures[c.id] && STRINGS.da.creatures[c.id], c.id);
});

test('everything can be crafted except the magma core (golems drop it)', () => {
  for (const it of ITEMS) if (it.id !== 'magma_core') assert.ok(results.has(`${NS}:${it.id}`), it.id);
  for (const b of BLOCKS) assert.ok(results.has(`${NS}:${b.id}`), b.id);
  assert.ok(CREATURES.some((c) => c.loot.some((l) => l.item === `${NS}:magma_core`)));
});

test('recipes only use keys they define, and ingredients that exist', () => {
  const ours = new Set([...ITEMS.map((i) => `${NS}:${i.id}`), ...BLOCKS.map((b) => `${NS}:${b.id}`)]);
  for (const r of recipes) {
    const body = Object.values(r)[0];
    for (const row of body.pattern ?? []) for (const ch of row) if (ch !== ' ') assert.ok(body.key[ch], `${body.description.identifier}: ${ch}`);
    const used = body.key ? Object.values(body.key) : body.ingredients;
    for (const { item } of used) {
      assert.ok(item.startsWith('minecraft:') ? VANILLA.has(item) : ours.has(item), `${body.description.identifier}: ${item}`);
    }
  }
});

test('every gun names an ammunition item and a projectile that exist', () => {
  for (const [id, g] of Object.entries(RULES.guns)) {
    assert.ok(ITEMS.some((i) => i.id === g.ammo), `${id}: ammo ${g.ammo}`);
    assert.ok(PROJECTILES.some((p) => p.id === g.projectile), `${id}: projectile ${g.projectile}`);
    assert.ok(ITEMS.some((i) => i.id === id), id);
  }
  assert.ok(ITEMS.some((i) => i.id === RULES.sprayer.ammo));
  assert.ok(ITEMS.some((i) => i.id === RULES.grenade.id));
});

test('the tank fits a Bedrock block state, and every fill level has a picture', () => {
  const tank = BLOCKS.find((b) => b.tank);
  assert.ok(RULES.tank.capacity + 1 <= 16);
  assert.equal(tank.sides.length, RULES.tank.stages + 1);
  assert.equal(tankStage(0), 0);
  assert.equal(tankStage(RULES.tank.capacity), RULES.tank.stages);
  for (let b = 1; b <= RULES.tank.capacity; b++) assert.ok(tankStage(b) >= 1 && tankStage(b) <= RULES.tank.stages, `${b}`);
});

test('the creatures fit their hitbox, and their models only use their own materials', () => {
  for (const c of CREATURES) {
    const cubes = c.model.bones.flatMap((b) => b.cubes ?? []);
    for (const cube of cubes) assert.ok(c.materials[cube.mat], `${c.id}: ${cube.mat}`);
    const top = Math.max(...cubes.map((q) => q.origin[1] + q.size[1]));
    assert.ok(Math.abs(top / 16 - c.size[1]) < 0.4, `${c.id}: model ${top / 16} blocks tall, hitbox ${c.size[1]}`);
  }
});
