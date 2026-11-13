// The lava tank: pour lava in with a bucket, take it out with an empty bucket, or
// turn a bucket of its lava into lava cells with iron ingots.
import { ItemStack } from '@minecraft/server';
import { RULES } from './data.js';
import { heldItem, isCreative, NS, takeItems, tell } from './util.js';

const STATE = `${NS}:buckets`;
const IRON_PER_FILL = 4;

/** Swap one of the held item for `result`, keeping the rest of the stack. */
function exchange(player, result) {
  if (isCreative(player)) return;
  const container = player.getComponent('minecraft:inventory').container;
  const held = container.getItem(player.selectedSlotIndex);
  if (held.amount > 1) {
    held.amount -= 1;
    container.setItem(player.selectedSlotIndex, held);
    const left = container.addItem(new ItemStack(result, 1));
    if (left) player.dimension.spawnItem(left, player.location);
  } else {
    container.setItem(player.selectedSlotIndex, new ItemStack(result, 1));
  }
}

function interact({ block, player }) {
  if (!player) return;
  const buckets = block.permutation.getState(STATE) ?? 0;
  const set = (n) => block.setPermutation(block.permutation.withState(STATE, n));
  const held = heldItem(player)?.typeId;
  const cap = RULES.tank.capacity;

  if (held === 'minecraft:lava_bucket') {
    if (buckets >= cap) return tell(player, `${NS}.hud.tank_full`);
    set(buckets + 1);
    exchange(player, 'minecraft:bucket');
    player.dimension.playSound('bucket.empty_lava', block.location);
  } else if (held === 'minecraft:bucket') {
    if (buckets <= 0) return tell(player, `${NS}.hud.tank_empty`);
    set(buckets - 1);
    exchange(player, 'minecraft:lava_bucket');
    player.dimension.playSound('bucket.fill_lava', block.location);
  } else if (held === 'minecraft:iron_ingot') {
    if (buckets <= 0) return tell(player, `${NS}.hud.tank_empty`);
    if (!isCreative(player) && !takeItems(player, 'minecraft:iron_ingot', IRON_PER_FILL)) return;
    set(buckets - 1);
    const container = player.getComponent('minecraft:inventory').container;
    const left = container.addItem(new ItemStack(`${NS}:lava_cell`, RULES.tank.cellsPerBucket));
    if (left) player.dimension.spawnItem(left, player.location);
    player.dimension.playSound('bucket.fill_lava', block.location, { pitch: 1.4 });
  }
  tell(player, `${NS}.hud.tank`, block.permutation.getState(STATE), cap);
}

export function registerTank(blockComponentRegistry) {
  blockComponentRegistry.registerCustomComponent(`${NS}:tank`, { onPlayerInteract: interact });
}
