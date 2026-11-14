// Items: the lava guns and their ammunition, magmasteel and its tools and armour,
// and the magma core the golems drop. Names are [English, Danish].
import { NS } from './lib/constants.mjs';
import { ICONS } from './art.mjs';
import { RULES } from './rules.mjs';

const mc = (id) => (id.includes(':') ? id : `minecraft:${id}`);
const ingot = `${NS}:magmasteel_ingot`;

/** Magmasteel: a little better than diamond, and it never stops being hot. */
export const MAGMASTEEL = {
  durability: 1200,
  speed: 9,
  enchantability: 14,
  // Java attack damage bonus (on top of the hand's 1) and speed, like the vanilla tools.
  tools: {
    sword: { damage: 7, javaBonus: 4, javaSpeed: -2.4 },
    pickaxe: { damage: 5, javaBonus: 1, javaSpeed: -2.8, tag: 'pickaxe' },
    axe: { damage: 8, javaBonus: 5, javaSpeed: -3.0, tag: 'axe' },
    shovel: { damage: 5, javaBonus: 1.5, javaSpeed: -3.0, tag: 'shovel' },
  },
  armor: {
    helmet: { slot: 'head', protection: 3, durability: 407 },
    chestplate: { slot: 'chest', protection: 8, durability: 592 },
    leggings: { slot: 'legs', protection: 6, durability: 555 },
    boots: { slot: 'feet', protection: 3, durability: 481 },
  },
  toughness: 2,
};

const ARMOR_SLOTS = { head: 'slot.armor.head', chest: 'slot.armor.chest', legs: 'slot.armor.legs', feet: 'slot.armor.feet' };
const ENCHANT_SLOTS = { head: 'armor_head', chest: 'armor_torso', legs: 'armor_legs', feet: 'armor_feet' };

const TOOL_NAMES = {
  sword: ['Magmasteel Sword', 'Magmastålsværd'],
  pickaxe: ['Magmasteel Pickaxe', 'Magmastålhakke'],
  axe: ['Magmasteel Axe', 'Magmastaløkse'],
  shovel: ['Magmasteel Shovel', 'Magmastålskovl'],
};
const ARMOR_NAMES = {
  helmet: ['Magmasteel Helmet', 'Magmastålhjelm'],
  chestplate: ['Magmasteel Chestplate', 'Magmastålbrystplade'],
  leggings: ['Magmasteel Leggings', 'Magmastålbenskinner'],
  boots: ['Magmasteel Boots', 'Magmastålstøvler'],
};

const gun = (id, name, durability) => ({
  id, name, category: 'equipment', stack: 1, handheld: true, kind: 'gun',
  components: {
    'minecraft:durability': { max_durability: durability },
    'minecraft:hand_equipped': true,
    'minecraft:cooldown': { category: `${NS}:${id}`, duration: RULES.guns[id]?.cooldown ?? 0.2 },
    'minecraft:repairable': { repair_items: [{ items: [ingot], repair_amount: Math.round(durability / 4) }] },
  },
});

export const ITEMS = [
  gun('lava_pistol', ['Lava Pistol', 'Lavapistol'], 400),
  gun('lava_gun', ['Lava Gun', 'Lavakanon'], 300),
  gun('obsidian_gun', ['Obsidian Gun', 'Obsidiankanon'], 300),
  {
    ...gun('magma_sprayer', ['Magma Sprayer', 'Magmasprøjte'], 500),
    // Hold to spray (scripts/guns.js).
    components: {
      'minecraft:durability': { max_durability: 500 },
      'minecraft:hand_equipped': true,
      'minecraft:use_modifiers': { use_duration: 3600, movement_modifier: 0.6 },
      'minecraft:use_animation': 'bow',
      'minecraft:repairable': { repair_items: [{ items: [ingot], repair_amount: 125 }] },
    },
  },
  {
    id: 'magma_grenade', name: ['Magma Grenade', 'Magmagranat'], category: 'equipment', stack: 16, kind: 'grenade',
    components: {
      'minecraft:throwable': { do_swing_animation: true, launch_power_scale: 1.0, max_launch_power: 1.0 },
      'minecraft:projectile': { projectile_entity: `${NS}:magma_grenade`, minimum_critical_power: 1.0 },
    },
  },
  { id: 'lava_cell', name: ['Lava Cell', 'Lavapatron'], category: 'items', kind: 'ammo' },
  { id: 'magma_charge', name: ['Magma Charge', 'Magmaladning'], category: 'items', kind: 'ammo' },
  { id: 'magmasteel_ingot', name: ['Magmasteel Ingot', 'Magmastålbarre'], category: 'items', kind: 'material' },
  { id: 'magma_core', name: ['Magma Core', 'Magmakerne'], category: 'items', kind: 'material', components: { 'minecraft:glint': true } },

  ...Object.entries(MAGMASTEEL.tools).map(([tool, t]) => ({
    id: `magmasteel_${tool}`, name: TOOL_NAMES[tool], category: 'equipment', stack: 1, handheld: true, kind: 'tool', tool,
    components: {
      'minecraft:damage': t.damage,
      'minecraft:durability': { max_durability: MAGMASTEEL.durability },
      'minecraft:hand_equipped': true,
      'minecraft:enchantable': { slot: tool, value: MAGMASTEEL.enchantability },
      'minecraft:repairable': { repair_items: [{ items: [ingot], repair_amount: MAGMASTEEL.durability / 4 }] },
      ...(t.tag ? {
        'minecraft:tags': { tags: [`minecraft:is_${t.tag}`, 'minecraft:diamond_tier'] },
        'minecraft:digger': {
          use_efficiency: true,
          destroy_speeds: [{ block: { tags: `q.any_tag('minecraft:is_${t.tag}_item_destructible')` }, speed: MAGMASTEEL.speed }],
        },
      } : { 'minecraft:tags': { tags: ['minecraft:is_sword', 'minecraft:diamond_tier'] } }),
    },
  })),

  ...Object.entries(MAGMASTEEL.armor).map(([piece, a]) => ({
    id: `magmasteel_${piece}`, name: ARMOR_NAMES[piece], category: 'equipment', stack: 1, kind: 'armor', piece, armor: a,
    components: {
      'minecraft:wearable': { slot: ARMOR_SLOTS[a.slot], protection: a.protection },
      'minecraft:durability': { max_durability: a.durability },
      'minecraft:enchantable': { slot: ENCHANT_SLOTS[a.slot], value: MAGMASTEEL.enchantability },
      'minecraft:repairable': { repair_items: [{ items: [ingot], repair_amount: Math.round(a.durability / 4) }] },
    },
  })),
].map((item) => ({ ...item, icon: ICONS[item.id] }));

// ---------------------------------------------------------------- recipes

const keyOf = (key) => Object.fromEntries(Object.entries(key).map(([k, v]) => [k, { item: mc(v) }]));

export function shaped(id, pattern, key, count = 1, result = `${NS}:${id}`) {
  return {
    'minecraft:recipe_shaped': {
      description: { identifier: `${NS}:${id}` },
      tags: ['crafting_table'],
      pattern,
      key: keyOf(key),
      result: { item: result, count },
      unlock: [{ item: mc(Object.values(key)[0]) }],
    },
  };
}

export function shapeless(id, ingredients, count = 1, result = `${NS}:${id}`) {
  return {
    'minecraft:recipe_shapeless': {
      description: { identifier: `${NS}:${id}` },
      tags: ['crafting_table'],
      ingredients: ingredients.map((i) => ({ item: mc(i) })),
      result: { item: result, count },
      unlock: [{ item: mc(ingredients[0]) }],
    },
  };
}

const M = ingot, S = 'stick';
const TOOL_PATTERNS = {
  sword: ['M', 'M', 'S'],
  pickaxe: ['MMM', ' S ', ' S '],
  axe: ['MM', 'MS', ' S'],
  shovel: ['M', 'S', 'S'],
};
const ARMOR_PATTERNS = {
  helmet: ['MMM', 'M M'],
  chestplate: ['M M', 'MMM', 'MMM'],
  leggings: ['MMM', 'M M', 'M M'],
  boots: ['M M', 'M M'],
};

export const RECIPES = [
  shapeless('magmasteel_ingot', ['iron_ingot', 'magma_cream', 'blaze_powder']),
  shaped('lava_cell', [' I ', 'ILI', ' I '], { I: 'iron_ingot', L: 'lava_bucket' }, RULES.tank.cellsPerBucket),
  shapeless('magma_charge', ['magma_cream', 'blaze_powder'], 4),
  shaped('lava_pistol', ['MMF', ' S '], { M, F: 'flint_and_steel', S }),
  shaped('lava_gun', ['MMM', 'CFS'], { M, C: `${NS}:magma_core`, F: 'flint_and_steel', S }),
  shaped('obsidian_gun', ['MMO', 'CFS'], { M, O: 'obsidian', C: `${NS}:magma_core`, F: 'flint_and_steel', S }),
  shaped('magma_sprayer', ['B  ', 'MMF', '  S'], { B: 'bucket', M, F: 'flint_and_steel', S }),
  shaped('magma_grenade', [' N ', 'MCM', ' M '], { N: 'iron_nugget', M, C: `${NS}:magma_charge` }, 2),
  ...Object.entries(TOOL_PATTERNS).map(([tool, p]) => shaped(`magmasteel_${tool}`, p, { M, S })),
  ...Object.entries(ARMOR_PATTERNS).map(([piece, p]) => shaped(`magmasteel_${piece}`, p, { M })),
];

export function buildItem(item) {
  return {
    format_version: '1.21.90',
    'minecraft:item': {
      description: { identifier: `${NS}:${item.id}`, menu_category: { category: item.category ?? 'items' } },
      components: {
        'minecraft:icon': `${NS}_${item.id}`,
        'minecraft:display_name': { value: `item.${NS}:${item.id}.name` },
        'minecraft:max_stack_size': item.stack ?? 64,
        ...(item.components ?? {}),
      },
    },
  };
}
