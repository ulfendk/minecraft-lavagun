// Small helpers shared by the scripts.
import { EquipmentSlot, world } from '@minecraft/server';
import { RULES } from './data.js';

export const NS = 'lavagun';
export const LOG = '[Lava Guns]';

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const floor = (a) => ({ x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) });
export const centre = (b) => ({ x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 });

export const isPlayer = (e) => e?.typeId === 'minecraft:player';

export function isCreative(player) {
  try {
    return String(player.getGameMode()).toLowerCase() === 'creative';
  } catch {
    return false;
  }
}

/** Game rules that decide whether lava and obsidian may be placed, and whether players get hurt. */
export const mayGrief = () => world.gameRules.mobGriefing !== false;
export const pvp = () => world.gameRules.pvp !== false;

const FIREPROOF = new Set(RULES.fireproof);
export const isFireproof = (e) => FIREPROOF.has(e.typeId);

export function heldItem(player) {
  return player.getComponent('minecraft:inventory')?.container?.getItem(player.selectedSlotIndex);
}

export function equipment(entity, slot) {
  try {
    return entity.getComponent('minecraft:equippable')?.getEquipment(slot);
  } catch {
    return undefined;
  }
}

export const ARMOR_SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];

/** How many of an item a player carries. */
export function countItem(player, typeId) {
  const container = player.getComponent('minecraft:inventory')?.container;
  let n = 0;
  for (let slot = 0; slot < (container?.size ?? 0); slot++) {
    const item = container.getItem(slot);
    if (item?.typeId === typeId) n += item.amount;
  }
  return n;
}

/** Take `n` of an item from a player's inventory. False (and nothing taken) if they have fewer. */
export function takeItems(player, typeId, n) {
  if (countItem(player, typeId) < n) return false;
  const container = player.getComponent('minecraft:inventory').container;
  for (let slot = 0; slot < container.size && n > 0; slot++) {
    const item = container.getItem(slot);
    if (item?.typeId !== typeId) continue;
    const take = Math.min(n, item.amount);
    n -= take;
    if (take === item.amount) container.setItem(slot, undefined);
    else {
      item.amount -= take;
      container.setItem(slot, item);
    }
  }
  return true;
}

/** Wear down the item in the player's selected slot; it breaks when it is worn out. */
export function wearSelected(player, amount = 1) {
  if (isCreative(player)) return;
  try {
    const container = player.getComponent('minecraft:inventory').container;
    const item = container.getItem(player.selectedSlotIndex);
    const d = item?.getComponent('minecraft:durability');
    if (!d) return;
    if (d.damage + amount >= d.maxDurability) {
      container.setItem(player.selectedSlotIndex, undefined);
      player.playSound('random.break');
      return;
    }
    d.damage += amount;
    container.setItem(player.selectedSlotIndex, item);
  } catch {
    // The slot changed under us: nothing to wear down.
  }
}

/** Show a translated message above the hotbar. Arguments are text, or { translate } for names. */
export function tell(player, key, ...args) {
  try {
    const rawtext = args.map((a) => (typeof a === 'object' ? a : { text: String(a) }));
    player.onScreenDisplay.setActionBar({ translate: key, with: { rawtext } });
  } catch {}
}

/** Wide mobs (in blocks); everything else is taken to be as wide as a zombie. */
const WIDTHS = {
  'minecraft:spider': 1.4, 'minecraft:iron_golem': 1.4, 'minecraft:horse': 1.4, 'minecraft:donkey': 1.4, 'minecraft:mule': 1.4,
  'minecraft:skeleton_horse': 1.4, 'minecraft:zombie_horse': 1.4, 'minecraft:camel': 1.7, 'minecraft:polar_bear': 1.4,
  'minecraft:hoglin': 1.4, 'minecraft:zoglin': 1.4, 'minecraft:sniffer': 1.9, 'minecraft:cow': 0.9, 'minecraft:mooshroom': 0.9,
  'minecraft:pig': 0.9, 'minecraft:sheep': 0.9, 'minecraft:llama': 0.9, 'minecraft:panda': 1.3, 'minecraft:magma_cube': 2.04,
  'minecraft:slime': 2.04, 'lavagun:magma_golem': 1.4, 'minecraft:strider': 0.9, 'minecraft:goat': 0.9,
};

/**
 * The space a mob takes up. Its height comes from where its eyes are (about 85% of
 * the way up, as in the game); its width from the table above.
 */
export function hitbox(entity) {
  const at = entity.location;
  let height = 1.8;
  try {
    height = Math.max(0.3, (entity.getHeadLocation().y - at.y) / 0.85);
  } catch {}
  const w = WIDTHS[entity.typeId] ?? 0.6;
  return { min: [at.x - w / 2, at.y, at.z - w / 2], max: [at.x + w / 2, at.y + height, at.z + w / 2] };
}
