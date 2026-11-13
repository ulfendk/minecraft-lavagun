// Used by tools/bds-test.sh: `scriptevent lavagun:selftest` checks that the items,
// blocks and creatures exist, that a pig is shut in obsidian and let out again,
// and that temporary lava goes away. It prints PASS or FAIL when it is done.
import { BlockPermutation, ItemStack, system, world } from '@minecraft/server';
import { BLOCKS, CREATURES, ITEMS, RULES } from './data.js';
import { encase, isHeld } from './guns.js';
import { placeTemp } from './lava.js';
import { LOG } from './util.js';

const later = (ticks) => new Promise((resolve) => system.runTimeout(resolve, ticks));

async function selfTest() {
  const problems = [];
  const dim = world.getDimension('overworld');
  for (const id of ITEMS) {
    try {
      new ItemStack(id, 1);
    } catch {
      problems.push(`missing item ${id}`);
    }
  }
  for (const id of BLOCKS) {
    try {
      BlockPermutation.resolve(id);
    } catch {
      problems.push(`missing block ${id}`);
    }
  }
  for (const id of CREATURES) if (!dim.getEntities({ type: id }).length) problems.push(`no ${id} in the world`);

  // The obsidian shell: a pig on the ground, shut in, then let out.
  const ground = { x: 10, y: -60, z: 10 };
  const pig = dim.spawnEntity('minecraft:pig', { x: ground.x + 0.5, y: ground.y, z: ground.z + 0.5 });
  await later(5);
  if (!encase(pig)) problems.push('the pig was not shut in');
  await later(2);
  const wall = dim.getBlock({ x: ground.x + 1, y: ground.y, z: ground.z });
  if (wall?.typeId !== 'minecraft:obsidian') problems.push(`no obsidian next to the pig (${wall?.typeId})`);
  await later(RULES.temporary.shell * 20 + 20);
  if (isHeld(pig)) problems.push('the pig was not let out');
  const after = dim.getBlock({ x: ground.x + 1, y: ground.y, z: ground.z });
  if (after?.typeId !== 'minecraft:air') problems.push(`the obsidian did not go away (${after?.typeId})`);

  // Temporary lava goes away again.
  const spot = { x: 14, y: -60, z: 14 };
  if (!placeTemp(dim, spot, 'minecraft:lava', 1)) problems.push('could not place temporary lava');
  await later(50);
  // The source is gone (what flowed out of it may still be drying up).
  const lava = dim.getBlock(spot);
  if (lava?.isLiquid && lava.permutation.getState('liquid_depth') === 0) problems.push(`temporary lava is still there (${lava.typeId})`);

  console.log(`${LOG} selftest: ${ITEMS.length} items, ${BLOCKS.length} blocks, ${CREATURES.length} creatures`);
  console.log(problems.length ? `${LOG} selftest FAIL: ${problems.join('; ')}` : `${LOG} selftest PASS`);
}

export function setupSelfTest() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === 'lavagun:selftest') selfTest().catch((e) => console.log(`${LOG} selftest FAIL: ${e}`));
  });
}
