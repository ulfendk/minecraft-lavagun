// The lava cannon: a plump medieval bombard, a fat iron barrel with hoops round it on
// a wooden carriage with two wheels. It is put down like a spawn egg and does not
// move; use it to fire, sneak and use to pick the range (scripts/cannon.js,
// dk.ulfen.lavagun.entity.LavaCannon).
// The model is cubes in pixels: y is up, the cannon fires towards -z, +x is its left.
// The round parts are two crossed boxes, a little different in both directions so no
// two faces lie in the same plane.
import { RULES } from './rules.mjs';
import { hex, mix, noise3, shade } from './lib/texture.mjs';

/** Barrel centre and the trunnions it tips on. */
const Y = 15;
const PIVOT = [0, Y, 4];

/** A round-ish section of barrel from z0 (front) to z1: a box `r` wide crossed with a taller, shorter one. */
const section = (r, z0, z1, mat, { inflate = 0, marks } = {}) => [
  { origin: [-r, Y - r + 1, z0], size: [2 * r, 2 * (r - 1), z1 - z0], mat, inflate: inflate || undefined, marks },
  { origin: [-(r - 1), Y - r, z0 + 1], size: [2 * (r - 1), 2 * r, z1 - z0 - 2], mat, inflate: inflate || undefined },
];

/** A wheel standing on the ground on side `x` (its inner face). */
const wheel = (x, side) => {
  const x0 = side > 0 ? x : x - 3;
  return [
    { origin: [x0, 0, -9], size: [3, 14, 10], mat: 'wheel' },
    { origin: [x0 + 0.5, 2, -11], size: [2, 10, 14], mat: 'wheel' },
    { origin: [side > 0 ? x0 + 3 : x0 - 1, 5, -6], size: [1, 4, 4], mat: 'hub' },
  ];
};

// The bore: dark round the edge, lava glowing inside. On the front face of the muzzle's wider box.
const bore = (r) => {
  const w = 2 * r, h = 2 * (r - 1);
  return [
    { face: 'front', x: w / 2 - 4, y: h / 2 - 4, w: 8, h: 8, color: '#140a06' },
    { face: 'front', x: w / 2 - 3, y: h / 2 - 3, w: 6, h: 6, color: '#c8321a' },
    { face: 'front', x: w / 2 - 2, y: h / 2 - 2, w: 4, h: 4, color: '#ff9a2a' },
    { face: 'front', x: w / 2 - 1, y: h / 2 - 1, w: 2, h: 2, color: '#ffe066' },
  ];
};

export const cannon = {
  id: RULES.cannon.id,
  name: ['Lava Cannon', 'Lavabombarde'],
  size: [1.4, 1.4],
  health: RULES.cannon.health,
  model: {
    bones: [
      { name: 'root', pivot: [0, 0, 0] },
      { name: 'carriage', parent: 'root', pivot: [0, 0, 0], cubes: [
        // The bed, the cheeks the barrel rests between, the trail on the ground behind.
        { origin: [-6, 3, -10], size: [12, 4, 14], mat: 'wood' },
        { origin: [8, 3, -6], size: [2, 12, 12], mat: 'wood' },
        { origin: [-10, 3, -6], size: [2, 12, 12], mat: 'wood' },
        { origin: [-3, 0, 4], size: [6, 4, 12], mat: 'wood' },
        { origin: [-10, 6, -5], size: [20, 2, 2], mat: 'hub' },
        ...wheel(10, 1),
        ...wheel(-10, -1),
      ] },
      { name: 'barrel', parent: 'root', pivot: PIVOT, rotation: [-RULES.cannon.angle, 0, 0], cubes: [
        // The fat chamber at the back, its rounded end and the knob.
        ...section(8, 2, 11, 'iron'),
        { origin: [-5, Y - 5, 11], size: [10, 10, 2], mat: 'iron' },
        { origin: [-2, Y - 2, 13], size: [4, 4, 3], mat: 'hoop' },
        // The barrel, with iron hoops round it and a swelling at the muzzle.
        ...section(7, -14, 2, 'iron'),
        ...section(7, -9, -6, 'hoop', { inflate: 0.75 }),
        ...section(7, -3, 0, 'hoop', { inflate: 0.75 }),
        ...section(8, -19, -14, 'muzzle', { marks: bore(8) }),
      ] },
    ],
  },
  materials: {
    // Dark iron, hottest (reddest) towards the muzzle.
    iron: { base: '#45484e', layers: [(c, { p }) => shade(mix(c, hex('#6a2a18'), Math.max(0, Math.min(1, (-p[2] - 4) / 20)) * 0.6), 0.85 + 0.3 * noise3(p[0] / 2, p[1] / 2, p[2] / 2, 4))] },
    muzzle: { base: '#4a3530', layers: [(c, { p }) => shade(c, 0.85 + 0.3 * noise3(p[0] / 2, p[1] / 2, p[2] / 2, 6))] },
    hoop: { base: '#2b2d31', layers: [(c, { p }) => shade(c, 0.9 + 0.2 * noise3(p[0], p[1], p[2], 8))] },
    // Planks along the length.
    wood: { base: '#6b4526', layers: [(c, { p }) => shade(c, 0.85 + 0.25 * noise3(p[0] / 1.5, p[1] * 2, p[2] / 6, 2) - (Math.floor(p[1]) % 4 === 0 ? 0.12 : 0))] },
    // A rim and four spokes on the sides of the wheel.
    wheel: { base: '#5a3a22', layers: [(c, { p, face }) => {
      if (face !== 'left' && face !== 'right') return shade(c, 0.8);
      const dy = p[1] - 7, dz = p[2] + 2;
      const r = Math.hypot(dy, dz);
      if (r > 5.5) return hex('#3e2716');
      if (Math.abs(dy) < 1 || Math.abs(dz) < 1) return hex('#7a5232');
      return shade(c, 0.6);
    }] },
    hub: '#2b2d31',
  },
  anims: {
    idle: { loop: true, animation_length: 2, bones: {} },
    // The barrel kicks back and settles; the carriage rocks.
    fire: { animation_length: 0.8, bones: {
      barrel: {
        position: { '0.0': [0, 0, 0], '0.05': [0, 0.5, 3], '0.4': [0, 0, 0.5], '0.8': [0, 0, 0] },
        rotation: { '0.0': [0, 0, 0], '0.05': [-4, 0, 0], '0.4': [0, 0, 0] },
      },
      carriage: { position: { '0.0': [0, 0, 0], '0.08': [0, 0, 1.5], '0.5': [0, 0, 0] }, rotation: { '0.0': [0, 0, 0], '0.08': [3, 0, 0], '0.5': [0, 0, 0] } },
    } },
  },
};
