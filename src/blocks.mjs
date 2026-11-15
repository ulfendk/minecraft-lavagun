// Blocks: magma building blocks, lava lamps (animated) and the lava tank. Every
// block is a full cube; textures come from src/art.mjs. Names are [English, Danish].
import { NS } from './lib/constants.mjs';
import { BLOCK_TEXTURES, LAMP_COLOURS, LAMP_FRAMES, lampStrip, tankSide } from './art.mjs';
import { RULES } from './rules.mjs';
import { shaped, shapeless } from './items.mjs';

const LAMP_NAMES = {
  orange: ['Orange Lava Lamp', 'Orange lavalampe'],
  red: ['Red Lava Lamp', 'Rød lavalampe'],
  purple: ['Purple Lava Lamp', 'Lilla lavalampe'],
  green: ['Green Lava Lamp', 'Grøn lavalampe'],
};
const LAMP_DYES = { orange: 'orange_dye', red: 'red_dye', purple: 'purple_dye', green: 'lime_dye' };

export const TANK_STATE = `${NS}:buckets`;
/** Which of the tank's pictures (0 = empty .. stages = full) shows `buckets` of lava. */
export const tankStage = (buckets) => Math.ceil((buckets * RULES.tank.stages) / RULES.tank.capacity);

export const BLOCKS = [
  { id: 'magma_bricks', name: ['Magma Bricks', 'Magmamursten'], texture: BLOCK_TEXTURES.magma_bricks(), hardness: 2, light: 3, sound: 'stone', map: '#4a2216' },
  { id: 'polished_magma', name: ['Polished Magma', 'Poleret magma'], texture: BLOCK_TEXTURES.polished_magma(), hardness: 2, light: 1, sound: 'stone', map: '#3c1c14' },
  { id: 'chiseled_magma', name: ['Chiseled Magma', 'Mejslet magma'], texture: BLOCK_TEXTURES.chiseled_magma(), hardness: 2, light: 6, sound: 'stone', map: '#4a2216' },
  { id: 'magmasteel_block', name: ['Block of Magmasteel', 'Magmastålblok'], texture: BLOCK_TEXTURES.magmasteel_block(), hardness: 5, light: 4, sound: 'metal', map: '#6e2c1c' },
  ...Object.keys(LAMP_COLOURS).map((colour) => ({
    id: `lava_lamp_${colour}`, name: LAMP_NAMES[colour], texture: lampStrip(colour), frames: LAMP_FRAMES,
    hardness: 0.5, light: 15, sound: 'glass', map: LAMP_COLOURS[colour].blob, lamp: colour,
  })),
  {
    id: 'lava_tank', name: ['Lava Tank', 'Lavatank'], hardness: 3, light: 0, sound: 'metal', map: '#4a4f57', tank: true,
    // One picture of the side for each fill level, and the lid for top and bottom.
    sides: Array.from({ length: RULES.tank.stages + 1 }, (_, stage) => tankSide(stage, RULES.tank.stages)),
    top: BLOCK_TEXTURES.tank_top(),
  },
];

// The volcano vent: grows a volcano round itself, then keeps its crater full of lava
// and now and then erupts (scripts/volcano.js; dk.ulfen.lavagun.block.VolcanoVentBlock).
export const VENT_STATE = `${NS}:grown`;
BLOCKS.push({
  id: RULES.volcano.id, name: ['Volcano Vent', 'Vulkanåbning'], texture: BLOCK_TEXTURES.volcano_vent(),
  hardness: 50, light: 15, sound: 'stone', map: '#ff6a00', vent: true,
});

export const BLOCK_RECIPES = [
  shaped('magma_bricks', ['XX', 'XX'], { X: 'magma' }, 4),
  shaped('polished_magma', ['XX', 'XX'], { X: `${NS}:magma_bricks` }, 4),
  shaped('chiseled_magma', ['X', 'X'], { X: `${NS}:polished_magma` }),
  shaped('magmasteel_block', ['MMM', 'MMM', 'MMM'], { M: `${NS}:magmasteel_ingot` }),
  shapeless('magmasteel_ingot_from_block', [`${NS}:magmasteel_block`], 9, `${NS}:magmasteel_ingot`),
  ...Object.entries(LAMP_DYES).map(([colour, dye]) => shaped(`lava_lamp_${colour}`, [' I ', 'GDG', 'ILI'], { I: 'iron_ingot', G: 'glass', D: dye, L: `${NS}:lava_cell` })),
  shaped('lava_tank', ['IGI', 'G G', 'IGI'], { I: 'iron_ingot', G: 'glass' }),
  shaped(RULES.volcano.id, ['MBM', 'BCB', 'MBM'], { M: 'magma', B: 'basalt', C: `${NS}:magma_core` }),
];

/** Texture atlas names (terrain_texture.json) and the files they point at. */
export function blockTextures(block) {
  if (block.tank) {
    return {
      ...Object.fromEntries(block.sides.map((png, stage) => [`${block.id}_${stage}`, png])),
      tank_top: block.top,
    };
  }
  return { [block.id]: block.texture };
}

export function bedrockBlock(block) {
  const tex = (name) => `${NS}_${name}`;
  const look = (side) => ({
    '*': { texture: tex(side), render_method: 'opaque' },
    ...(block.tank ? { up: { texture: tex('tank_top'), render_method: 'opaque' }, down: { texture: tex('tank_top'), render_method: 'opaque' } } : {}),
  });
  const components = {
    'minecraft:geometry': 'minecraft:geometry.full_block',
    'minecraft:material_instances': look(block.tank ? `${block.id}_0` : block.id),
    'minecraft:destructible_by_mining': { seconds_to_destroy: block.hardness },
    'minecraft:destructible_by_explosion': { explosion_resistance: block.hardness * 3 },
    'minecraft:map_color': block.map,
    'minecraft:display_name': `tile.${NS}:${block.id}.name`,
    ...(block.light ? { 'minecraft:light_emission': block.light } : {}),
    // Right-click with buckets and lava cells (scripts/tank.js).
    ...(block.tank ? { [`${NS}:tank`]: {} } : {}),
    // Ticks once a second (scripts/volcano.js); random ticks find vents placed with the world.
    ...(block.vent ? { [`${NS}:vent`]: {}, 'minecraft:tick': { interval_range: [20, 20], looping: true } } : {}),
  };
  return {
    format_version: '1.21.90',
    'minecraft:block': {
      description: {
        identifier: `${NS}:${block.id}`,
        menu_category: { category: 'construction' },
        ...(block.tank ? { states: { [TANK_STATE]: { values: { min: 0, max: RULES.tank.capacity } } } } : {}),
        ...(block.vent ? { states: { [VENT_STATE]: [false, true] } } : {}),
      },
      components,
      ...(block.tank ? {
        permutations: block.sides.slice(1).map((_, i) => {
          const stage = i + 1;
          const lo = Math.floor(((stage - 1) * RULES.tank.capacity) / RULES.tank.stages);
          const hi = Math.floor((stage * RULES.tank.capacity) / RULES.tank.stages);
          return {
            condition: `q.block_state('${TANK_STATE}') > ${lo} && q.block_state('${TANK_STATE}') <= ${hi}`,
            components: { 'minecraft:material_instances': look(`${block.id}_${stage}`) },
          };
        }),
      } : {}),
    },
  };
}
