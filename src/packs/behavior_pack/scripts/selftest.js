// Used by tools/bds-test.sh: `scriptevent lavagun:selftest` checks that the items,
// blocks and creatures exist, that a pig is shut in obsidian and let out again,
// that temporary lava goes away, that the obsidian gun's obsidian stays, and that
// the lava cannon's lava lands about as far off as its range says, and stays. It prints PASS or FAIL when it is done.
import { BlockPermutation, ItemStack, system, world } from '@minecraft/server';
import { BLOCKS, CREATURES, ITEMS, RULES } from './data.js';
import { fireCannon, getRange, stepRange } from './cannon.js';
import { encase, isHeld } from './guns.js';
import { isTemporary, placeObsidian, placeTemp } from './lava.js';
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

  // The obsidian gun's lava sets on lava, and stays.
  const pool = { x: 18, y: -60, z: 18 };
  dim.getBlock(pool)?.setType('minecraft:lava');
  if (!placeObsidian(dim, pool)) problems.push('could not set obsidian on lava');
  await later(RULES.temporary.lava * 20 + 20);
  const set = dim.getBlock(pool);
  if (set?.typeId !== 'minecraft:obsidian' || isTemporary(dim, pool)) problems.push(`the obsidian did not stay (${set?.typeId})`);

  // The lava cannon at its shortest and longest range, facing east (+x).
  const shots = [1, RULES.cannon.ranges.length].map((setting, k) => {
    const at = { x: 6, y: -60, z: 24 + k * 8 };
    const cannon = dim.spawnEntity(`lavagun:${RULES.cannon.id}`, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
    return { setting, at, cannon, range: RULES.cannon.ranges[setting - 1] };
  });
  await later(5);
  for (const { setting, cannon } of shots) {
    cannon.setRotation({ x: 0, y: -90 });
    while (getRange(cannon) !== setting) stepRange(cannon);
    if (!fireCannon(cannon)) problems.push('the cannon did not fire');
  }
  if (stepRange(shots[0].cannon) !== 2) problems.push('the range did not step from 1 to 2');
  // Long enough to land (about 3 seconds at the longest range) and to have gone if it were temporary.
  await later(RULES.temporary.lava * 20 + 20);
  for (const { at, range } of shots) {
    let landed = null;
    for (let dx = 2; dx <= range + 8 && !landed; dx++)
      for (let dz = -2; dz <= 2 && !landed; dz++)
        for (let dy = -1; dy <= 2 && !landed; dy++) {
          const pos = { x: at.x + dx, y: at.y + dy, z: at.z + dz };
          const b = dim.getBlock(pos);
          if (b?.typeId === 'minecraft:lava' && b.permutation.getState('liquid_depth') === 0) landed = { pos, dx };
        }
    if (!landed) problems.push(`no lava from the cannon at range ${range}`);
    else if (isTemporary(dim, landed.pos)) problems.push('the cannon\'s lava is temporary');
    else {
      console.log(`${LOG} selftest: the cannon's lava landed ${landed.dx} blocks off (range ${range})`);
      if (Math.abs(landed.dx - range) > Math.max(2, range / 8)) problems.push(`the cannon's lava landed ${landed.dx} blocks off, not about ${range}`);
    }
  }

  console.log(`${LOG} selftest: ${ITEMS.length} items, ${BLOCKS.length} blocks, ${CREATURES.length} creatures`);
  console.log(problems.length ? `${LOG} selftest FAIL: ${problems.join('; ')}` : `${LOG} selftest PASS`);
}

export function setupSelfTest() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === 'lavagun:selftest') selfTest().catch((e) => console.log(`${LOG} selftest FAIL: ${e}`));
  });
}
