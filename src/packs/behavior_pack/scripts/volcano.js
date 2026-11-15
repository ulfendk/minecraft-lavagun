// Volcanoes. A volcano vent that has not grown yet (one a player put down) grows a
// volcano round itself: one of the volcano structures that also generate with the
// world (tools/mcstructure.mjs). A grown vent sits on the floor of the crater, under
// its lava: it smokes, keeps the crater full so lava runs out over the notch in the
// rim all the time, and, now and then when a player is near, erupts and throws out
// lava bombs that land as magma and basalt that stay.
import { system, world } from '@minecraft/server';
import { RULES } from './data.js';
import { launch } from './flight.js';
import { hurt } from './guns.js';
import { placeLasting } from './lava.js';
import { bombSpeed, disc, hash01 } from './temp.js';
import { add, floor, LOG, mayGrief, NS } from './util.js';

const V = RULES.volcano;
const E = V.eruption;
const VENT = `${NS}:${V.id}`;
const GROWN = `${NS}:grown`;
const BOMB = `${NS}:volcano_bomb`;
const BOMB_GRAVITY = 0.05;
const FLOOR = V.height - V.crater.depth;

const nextEruption = new Map(); // vent key -> tick it may erupt next
const erupting = new Set(); // vent keys
const key = (dimension, p) => `${dimension.id}|${p.x}|${p.y}|${p.z}`;
const between = ([lo, hi]) => lo + Math.random() * (hi - lo);

/** Which of the volcano structures grows from a vent at (x, z). */
export const variant = (x, z) => Math.floor(hash01(0, x, 0, z) * V.variants);

/**
 * Grow a volcano round the vent at `block`, on the ground it stands on. Returns where
 * the grown vent is, or null if it can't grow (yet).
 */
export function grow(block) {
  const { dimension } = block;
  const p = block.location;
  const min = dimension.heightRange.min;
  // The structure has rock under it to sit on uneven ground; less of it near the bottom of the world.
  const base = Math.max(p.y - V.skirt, min);
  const corner = { x: p.x - V.radius, y: base, z: p.z - V.radius };
  const top = p.y + V.height + 2;
  if (top >= dimension.heightRange.max) return null;
  try {
    for (const [dx, dz] of [[0, 0], [2 * V.radius, 0], [0, 2 * V.radius], [2 * V.radius, 2 * V.radius]]) {
      if (!dimension.getBlock({ x: corner.x + dx, y: p.y, z: corner.z + dz })) return null;
    }
    world.structureManager.place(`${NS}:volcano_${variant(p.x, p.z)}`, dimension, corner);
  } catch (e) {
    console.warn(`${LOG} a volcano could not grow at ${p.x} ${p.y} ${p.z}: ${e}`);
    return null;
  }
  const vent = { x: p.x, y: base + V.skirt + FLOOR, z: p.z };
  try {
    dimension.playSound('random.explode', vent, { pitch: 0.4, volume: 4 });
  } catch {}
  return vent;
}

/** Lava in the crater above the vent, where it has been taken out or has run off. */
function refill(dimension, vent) {
  for (let y = vent.y + 1; y < vent.y + V.crater.depth; y++) {
    for (const p of disc(vent.x, y, vent.z, V.crater.radius)) {
      try {
        const block = dimension.getBlock(p);
        if (!block) continue;
        if (block.isAir || (block.typeId === 'minecraft:lava' && block.permutation.getState('liquid_depth') !== 0) || block.typeId === 'minecraft:flowing_lava') {
          block.setType('minecraft:lava');
        }
      } catch {}
    }
  }
}

function bombLands(s, hit) {
  const { dimension } = s;
  try {
    dimension.playSound('random.explode', hit.at, { pitch: 1.4, volume: 0.6 });
    dimension.spawnParticle('minecraft:lava_particle', hit.at);
  } catch {}
  // A bomb that hits a mob only hurts it: no rock in its feet.
  if (hit.entity) return hurt(hit.entity, E.damage, undefined, E.fire);
  if (!mayGrief()) return;
  const at = floor(hit.before);
  if (!placeLasting(dimension, at, Math.random() < E.magma ? 'minecraft:magma' : 'minecraft:basalt')) return;
  if (Math.random() < E.fireChance) placeLasting(dimension, add(at, { x: 0, y: 1, z: 0 }), 'minecraft:fire');
}

/** Throw one lava bomb out of the crater, landing `reach` blocks away (on level ground). */
export function throwBomb(dimension, vent, reach = between(E.reach)) {
  const angle = between(E.angle);
  const yaw = Math.random() * 2 * Math.PI;
  const speed = bombSpeed(reach, angle, BOMB_GRAVITY);
  const a = (angle * Math.PI) / 180;
  const vel = { x: Math.cos(yaw) * Math.cos(a) * speed, y: Math.sin(a) * speed, z: Math.sin(yaw) * Math.cos(a) * speed };
  const from = { x: vent.x + 0.5, y: vent.y + V.crater.depth + 0.5, z: vent.z + 0.5 };
  return launch(dimension, BOMB, from, vel, { gravity: BOMB_GRAVITY, land: bombLands });
}

/** Rumble, then throw lava bombs for a few seconds. */
export function erupt(dimension, vent) {
  const k = key(dimension, vent);
  if (erupting.has(k)) return false;
  erupting.add(k);
  const top = { x: vent.x + 0.5, y: vent.y + V.crater.depth + 1, z: vent.z + 0.5 };
  try {
    dimension.playSound('ambient.weather.thunder', top, { pitch: 0.4, volume: 4 });
    for (const player of dimension.getPlayers({ location: top, maxDistance: E.nearby })) {
      player.runCommand(`camerashake add @s 0.2 ${E.rumble} rotational`);
    }
  } catch {}
  let ticks = 0;
  const run = system.runInterval(() => {
    ticks += E.pulseTicks;
    try {
      dimension.spawnParticle('minecraft:huge_explosion_emitter', top);
      if (ticks <= E.rumble * 20) return;
      if (ticks > (E.rumble + E.length) * 20) {
        system.clearRun(run);
        erupting.delete(k);
        return;
      }
      dimension.playSound('mob.ghast.fireball', top, { pitch: 0.5, volume: 3 });
      const n = Math.round(between(E.bombsPerPulse));
      for (let i = 0; i < n; i++) throwBomb(dimension, vent);
    } catch {
      // The volcano is no longer loaded.
      system.clearRun(run);
      erupting.delete(k);
    }
  }, E.pulseTicks);
  return true;
}

/** Once a second, for every vent in the loaded world. */
function ventTick(block) {
  const { dimension } = block;
  if (!block.permutation.getState(GROWN)) {
    if (mayGrief()) grow(block);
    return;
  }
  const vent = block.location;
  const k = key(dimension, vent);
  const top = { x: vent.x + 0.5, y: vent.y + V.crater.depth, z: vent.z + 0.5 };
  try {
    dimension.spawnParticle('minecraft:campfire_tall_smoke_particle', top);
  } catch {}
  if (system.currentTick % 100 < 20) refill(dimension, vent);
  const now = system.currentTick;
  if (!nextEruption.has(k)) nextEruption.set(k, now + between(E.every) * 20);
  if (now < nextEruption.get(k) || erupting.has(k)) return;
  if (!dimension.getPlayers({ location: top, maxDistance: E.nearby }).length) return;
  nextEruption.set(k, now + between(E.every) * 20);
  erupt(dimension, vent);
}

export function registerVent(blockComponentRegistry) {
  blockComponentRegistry.registerCustomComponent(`${NS}:vent`, {
    onTick: ({ block }) => ventTick(block),
  });
}

export function setupVolcano() {
  world.afterEvents.playerBreakBlock.subscribe(({ block, dimension, brokenBlockPermutation }) => {
    if (brokenBlockPermutation.type.id === VENT) nextEruption.delete(key(dimension, block.location));
  });
}
