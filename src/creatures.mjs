// The creatures: the magma golem (neutral, slams the ground and leaves lava) and
// the lava slug (harmless; fill a bucket from it). Both live in the Nether.
// Models are cubes in pixels: y is up, the creature faces -z, +x is its left.
import { golemAnims, slugAnims } from './lib/anim.mjs';
import { RULES } from './rules.mjs';
import { hex, mix, noise3, shade, worley } from './lib/texture.mjs';

/** Glowing cracks between plates of cooled rock, continuing across cube edges. */
const cracks = ({ width = 0.07, scale = 5, seed = 11 } = {}) => (c, { p }) => {
  const { d1, d2 } = worley(p[0] / scale, p[1] / scale, p[2] / scale, seed);
  if (d2 - d1 < width) return mix(hex('#ff7a1a'), hex('#ffd23a'), noise3(p[0], p[1], p[2], seed));
  return shade(c, 0.85 + 0.3 * noise3(p[0] / 2, p[1] / 2, p[2] / 2, seed + 1));
};

/** Wet-looking glow: brighter on top, darker underneath. */
const glow = (top, bottom, { from, to }) => (c, { p }) => mix(hex(bottom), hex(top), (p[1] - from) / (to - from));

/** Glowing eyes under a dark brow. */
const eyes = (w, y, color) => [
  { face: 'front', x: 1, y: y - 1, w: w - 2, color: '#1a0805' },
  { face: 'front', x: 2, y, w: 2, color },
  { face: 'front', x: w - 4, y, w: 2, color },
];

export const golem = {
  id: 'magma_golem',
  name: ['Magma Golem', 'Magmagolem'],
  size: [1.4, 2.9],
  health: 60,
  speed: 0.22,
  attack: RULES.golem.slam,
  knockbackResistance: 0.8,
  followRange: 16,
  xp: 15,
  egg: ['#3a1a12', '#ff7a1a'],
  spawn: { biomes: ['basalt_deltas', 'nether_wastes'], weight: 8, group: [1, 1] },
  loot: [{ item: 'lavagun:magma_core', min: 1, max: 1 }, { item: 'magma_cream', min: 0, max: 2 }],
  sounds: { ambient: 'random.fizz', hurt: 'mob.irongolem.hit', death: 'mob.irongolem.death', step: 'mob.irongolem.walk', pitch: [0.6, 0.8] },
  model: {
    bones: [
      { name: 'root', pivot: [0, 0, 0] },
      { name: 'body', parent: 'root', pivot: [0, 18, 0], cubes: [
        { origin: [-9, 18, -5], size: [18, 20, 10], mat: 'rock' },
        // The glowing core in its chest.
        { origin: [-3, 28, -6], size: [6, 6, 1], mat: 'core' },
      ] },
      { name: 'head', parent: 'body', pivot: [0, 38, 0], cubes: [
        { origin: [-5, 38, -6], size: [10, 9, 9], mat: 'rock', marks: eyes(10, 4, '#fff6b0') },
      ] },
      { name: 'arm_l', parent: 'body', pivot: [11, 36, 0], cubes: [
        { origin: [9, 14, -3], size: [6, 24, 6], mat: 'rock' },
        { origin: [8.5, 10, -3.5], size: [7, 5, 7], mat: 'fist' },
      ] },
      { name: 'arm_r', parent: 'body', pivot: [-11, 36, 0], cubes: [
        { origin: [-15, 14, -3], size: [6, 24, 6], mat: 'rock' },
        { origin: [-15.5, 10, -3.5], size: [7, 5, 7], mat: 'fist' },
      ] },
      { name: 'leg_l', parent: 'root', pivot: [4, 18, 0], cubes: [{ origin: [1, 0, -3], size: [7, 18, 7], mat: 'rock' }] },
      { name: 'leg_r', parent: 'root', pivot: [-4, 18, 0], cubes: [{ origin: [-8, 0, -3], size: [7, 18, 7], mat: 'rock' }] },
    ],
  },
  materials: {
    rock: { base: '#3a1a12', layers: [cracks({ width: 0.05 })] },
    fist: { base: '#2a120c', layers: [cracks({ width: 0.1, scale: 3, seed: 5 })] },
    core: { base: '#ffd23a', layers: [glow('#ffe88a', '#ff7a1a', { from: 28, to: 34 })], shading: 0 },
  },
  anims: golemAnims(),
};

export const slug = {
  id: 'lava_slug',
  name: ['Lava Slug', 'Lavasnegl'],
  size: [0.6, 0.45],
  health: 10,
  speed: 0.12,
  xp: 3,
  egg: ['#c8321a', '#ffd23a'],
  spawn: { biomes: ['nether_wastes', 'basalt_deltas'], weight: 20, group: [1, 3] },
  loot: [{ item: 'magma_cream', min: 1, max: 2 }],
  sounds: { ambient: 'mob.magmacube.small', hurt: 'mob.magmacube.small', death: 'mob.magmacube.small', step: 'mob.slime.small', pitch: [1.2, 1.5] },
  model: {
    bones: [
      { name: 'root', pivot: [0, 0, 0] },
      { name: 'body', parent: 'root', pivot: [0, 0, 0], cubes: [
        { origin: [-3, 0, -4], size: [6, 4, 9], mat: 'skin' },
        // The shell of cooled rock on its back.
        { origin: [-2.5, 4, -1], size: [5, 2, 5], mat: 'shell' },
      ] },
      { name: 'head', parent: 'body', pivot: [0, 0, -4], cubes: [{ origin: [-2.5, 0, -7], size: [5, 4, 3], mat: 'skin' }] },
      { name: 'stalk_l', parent: 'head', pivot: [1.5, 4, -6], cubes: [{ origin: [1, 4, -6.5], size: [1, 3, 1], mat: 'stalk', marks: [{ face: 'top', x: 0, y: 0, color: '#1a0a06' }] }] },
      { name: 'stalk_r', parent: 'head', pivot: [-1.5, 4, -6], cubes: [{ origin: [-2, 4, -6.5], size: [1, 3, 1], mat: 'stalk', marks: [{ face: 'top', x: 0, y: 0, color: '#1a0a06' }] }] },
      { name: 'tail', parent: 'body', pivot: [0, 0, 5], cubes: [{ origin: [-2, 0, 5], size: [4, 2, 4], mat: 'skin' }] },
    ],
  },
  materials: {
    skin: { base: '#ff7a1a', layers: [glow('#ff9a3a', '#a8281a', { from: 0, to: 4 }), (c, { p }) => shade(c, 0.9 + 0.2 * noise3(p[0], p[1], p[2], 3))] },
    shell: { base: '#3a1a12', layers: [cracks({ width: 0.12, scale: 2, seed: 7 })] },
    stalk: '#ffb04a',
  },
  anims: slugAnims(),
  // Use an empty bucket on it for a bucket of lava, once every few minutes.
  milk: { cooldown: RULES.slug.milkCooldown },
};

export const CREATURES = [golem, slug];
