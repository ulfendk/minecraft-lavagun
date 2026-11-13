// Magmasteel: the sword sets things on fire, the pickaxe melts ore as it mines,
// the full suit of armour keeps out fire, and the boots harden lava underfoot.
import { EquipmentSlot, ItemStack, system, world } from '@minecraft/server';
import { RULES } from './data.js';
import { placeTemp } from './lava.js';
import { slam } from './guns.js';
import { disc, SMELT, smeltCount } from './temp.js';
import { ARMOR_SLOTS, centre, equipment, heldItem, isCreative, isFireproof, isPlayer, NS, wearSelected } from './util.js';

const SWORD = `${NS}:magmasteel_sword`;
const PICKAXE = `${NS}:magmasteel_pickaxe`;
const BOOTS = `${NS}:magmasteel_boots`;
const SUIT = ['helmet', 'chestplate', 'leggings', 'boots'].map((p) => `${NS}:magmasteel_${p}`);
const GOLEM = `${NS}:magma_golem`;

const isLavaSource = (block) =>
  (block.typeId === 'minecraft:lava' || block.typeId === 'minecraft:flowing_lava') && block.permutation.getState('liquid_depth') === 0;

function hit({ damagingEntity: attacker, hitEntity: target }) {
  if (!attacker?.isValid || !target?.isValid) return;
  if (attacker.typeId === GOLEM) return slam(attacker, target);
  if (!isPlayer(attacker) || heldItem(attacker)?.typeId !== SWORD || isFireproof(target)) return;
  try {
    target.setOnFire(RULES.sword.fire, true);
  } catch {}
}

/** Mining ore with the magmasteel pickaxe: the ingot drops instead of the ore. */
function mine(event) {
  const { block, player, itemStack } = event;
  if (itemStack?.typeId !== PICKAXE) return;
  const result = SMELT[block.typeId];
  if (!result) return;
  event.cancel = true;
  const { dimension, location } = block;
  const count = smeltCount(block.typeId);
  system.run(() => {
    try {
      dimension.getBlock(location)?.setType('minecraft:air');
      if (!isCreative(player)) dimension.spawnItem(new ItemStack(result, count), centre(location));
      dimension.spawnParticle('minecraft:lava_particle', centre(location));
      dimension.playSound('random.fizz', location, { volume: 0.5, pitch: 1.4 });
      wearSelected(player);
    } catch {}
  });
}

function armour() {
  for (const player of world.getPlayers()) {
    const worn = ARMOR_SLOTS.map((slot) => equipment(player, slot)?.typeId);
    if (SUIT.every((id, i) => worn[i] === id)) {
      player.addEffect('fire_resistance', 60, { showParticles: false });
    }
  }
}

/** Lava walker: lava under the boots hardens into basalt for a few seconds. */
function walker() {
  for (const player of world.getPlayers()) {
    if (equipment(player, EquipmentSlot.Feet)?.typeId !== BOOTS) continue;
    const { x, y, z } = player.location;
    for (const p of disc(Math.floor(x), Math.floor(y) - 1, Math.floor(z), RULES.armor.walkerRadius)) {
      placeTemp(player.dimension, p, 'minecraft:basalt', RULES.temporary.walker, { restore: 'minecraft:lava', replace: isLavaSource, refresh: true });
    }
  }
}

export function setupGear() {
  world.afterEvents.entityHitEntity.subscribe(hit);
  world.beforeEvents.playerBreakBlock.subscribe(mine);
  system.runInterval(armour, 20);
  system.runInterval(walker, 2);
}
