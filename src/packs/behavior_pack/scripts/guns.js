// The lava guns. The pistol, the lava gun and the obsidian gun fire a shot when used; the magma
// sprayer sprays fire for as long as it is held; the grenade is thrown by the game
// itself. What happens when a shot hits is decided here, not in the projectile.
import { system, world } from '@minecraft/server';
import { RULES } from './data.js';
import { placeObsidian, placeTemp } from './lava.js';
import { disc, falloff, inCone, ring, shellPositions, splat } from './temp.js';
import {
  add, dist, floor, hitbox, isCreative, isFireproof, isPlayer, mayGrief, NS, pvp, scale, takeItems, tell, wearSelected,
} from './util.js';

const GUNS = Object.fromEntries(Object.entries(RULES.guns).map(([id, g]) => [`${NS}:${id}`, { id, ...g }]));
const SPRAYER = `${NS}:${RULES.sprayer.id}`;
const BOLT = `${NS}:lava_bolt`;
const BLOB = `${NS}:lava_blob`;
const OBSIDIAN = `${NS}:obsidian_blob`;
const GRENADE = `${NS}:${RULES.grenade.id}`;
const EXEMPT = new Set(RULES.shell.exempt);

// ---------------------------------------------------------------- hurting

/** May `attacker` hurt `target`? Not themselves, and other players only with PvP on. */
export function mayHurt(target, attacker) {
  if (!target?.isValid || target.id === attacker?.id) return false;
  if (isPlayer(target) && isPlayer(attacker) && !pvp()) return false;
  if (target.typeId === 'minecraft:item' || target.typeId === 'minecraft:xp_orb') return false;
  return !!target.getComponent('minecraft:health');
}

/** Hit and burn. Fire-proof mobs only feel the hit. */
export function hurt(target, damage, attacker, fireSeconds = 0) {
  try {
    target.applyDamage(damage, attacker?.isValid ? { cause: 'projectile', damagingEntity: attacker } : { cause: 'projectile' });
    if (fireSeconds > 0 && !isFireproof(target) && target.isValid) target.setOnFire(fireSeconds, true);
  } catch {}
}

/** Everything within `radius` of `location` takes damage that falls off with distance. */
function splash(dimension, location, { radius, damage, fire }, attacker, except) {
  for (const e of dimension.getEntities({ location, maxDistance: radius })) {
    if (e.id === except?.id || !mayHurt(e, attacker)) continue;
    const d = falloff(damage, dist(e.location, location), radius);
    if (d > 0) hurt(e, d, attacker, fire);
  }
}

/** Lava on the ground around `location`: on the first block with solid ground under it. */
function lavaPatch(dimension, positions, seconds) {
  let placed = 0;
  for (const p of positions) {
    for (let dy = 1; dy >= -2; dy--) {
      const pos = { x: p.x, y: p.y + dy, z: p.z };
      try {
        const below = dimension.getBlock({ ...pos, y: pos.y - 1 });
        if (!below || below.isAir || below.isLiquid) continue;
        if (placeTemp(dimension, pos, 'minecraft:lava', seconds)) placed++;
        break;
      } catch {
        break;
      }
    }
  }
  return placed;
}

/** The obsidian gun's lava sets into obsidian that stays, flat against the face it hit. */
function setObsidian(dimension, centre, axis, avoid) {
  dimension.playSound('random.fizz', centre, { pitch: 0.8, volume: 1.2 });
  dimension.spawnParticle('minecraft:large_smoke_particle', add(centre, { x: 0.5, y: 0.5, z: 0.5 }));
  if (!mayGrief()) return 0;
  return splat(centre, axis, RULES.guns.obsidian_gun.obsidian.radius, avoid).filter((p) => placeObsidian(dimension, p)).length;
}

// ---------------------------------------------------------------- the obsidian shell

const held = new Map(); // entity id -> { entity, location, until }
const immuneUntil = new Map(); // entity id -> tick

/**
 * Shut a mob in a hollow shell of obsidian for a few seconds; it burns when it gets
 * out. Without mobGriefing it is only frozen in place. True if it was caught.
 */
export function encase(target, attacker) {
  const now = system.currentTick;
  if (!target?.isValid || EXEMPT.has(target.typeId) || held.has(target.id)) return false;
  if ((immuneUntil.get(target.id) ?? 0) > now) return false;
  const shell = shellPositions(hitbox(target), RULES.shell);
  if (!shell) return false;
  const seconds = RULES.temporary.shell;
  if (mayGrief()) for (const p of shell) placeTemp(target.dimension, p, 'minecraft:obsidian', seconds);
  held.set(target.id, { entity: target, attacker, location: { ...target.location }, until: now + seconds * 20 });
  try {
    target.addEffect('slowness', seconds * 20, { amplifier: 255, showParticles: false });
    target.addEffect('mining_fatigue', seconds * 20, { amplifier: 4, showParticles: false });
    target.dimension.playSound('random.fizz', target.location, { pitch: 0.6, volume: 1.5 });
  } catch {}
  if (isPlayer(target)) tell(target, `${NS}.hud.encased`);
  return true;
}

export const isHeld = (entity) => held.has(entity.id);

function tickHeld() {
  const now = system.currentTick;
  for (const [id, h] of held) {
    const e = h.entity;
    if (!e.isValid) {
      held.delete(id);
      continue;
    }
    if (now >= h.until) {
      held.delete(id);
      immuneUntil.set(id, now + RULES.shell.immunity * 20);
      try {
        if (!isFireproof(e)) e.setOnFire(RULES.shell.burnAfter, true);
      } catch {}
      continue;
    }
    // Keep it where it was caught.
    try {
      if (dist(e.location, h.location) > 0.05) e.teleport(h.location, { keepVelocity: false });
      e.clearVelocity();
      if (now % 10 === 0) e.dimension.spawnParticle('minecraft:lava_particle', add(h.location, { x: 0, y: 1, z: 0 }));
    } catch {}
  }
  for (const [id, until] of immuneUntil) if (until < now) immuneUntil.delete(id);
}

// ---------------------------------------------------------------- firing

/** Fire a shot of `type` from the player's eyes along where they look. */
export function launch(player, type, speed) {
  const dir = player.getViewDirection();
  const from = add(player.getHeadLocation(), scale(dir, 0.8));
  const shot = player.dimension.spawnEntity(type, from);
  const proj = shot.getComponent('minecraft:projectile');
  proj.owner = player;
  proj.shoot(scale(dir, speed));
  return shot;
}

function fireGun(player, item, gun) {
  const cooldown = item.getComponent('minecraft:cooldown');
  if (cooldown && cooldown.getCooldownTicksRemaining(player) > 0) return;
  if (!isCreative(player) && !takeItems(player, `${NS}:${gun.ammo}`, gun.ammoPerShot)) {
    tell(player, `${NS}.hud.no_ammo`, { translate: `item.${NS}:${gun.ammo}.name` });
    player.playSound('random.click', { pitch: 1.6 });
    return;
  }
  cooldown?.startCooldown(player);
  launch(player, `${NS}:${gun.projectile}`, gun.speed);
  const eye = player.getHeadLocation();
  player.dimension.playSound('mob.blaze.shoot', eye, { pitch: gun.id === 'lava_pistol' ? 1.3 : 0.6, volume: 0.8 });
  player.dimension.spawnParticle('minecraft:lava_particle', add(eye, scale(player.getViewDirection(), 1.2)));
  wearSelected(player);
}

// ---------------------------------------------------------------- the magma sprayer

const spraying = new Map(); // player id -> { player, ticks }

function spray(s) {
  const { player } = s;
  const r = RULES.sprayer;
  if (!player.isValid) return false;
  // A new charge every couple of seconds of spraying.
  if (s.ticks % r.ticksPerCharge === 0) {
    if (!isCreative(player) && !takeItems(player, `${NS}:${r.ammo}`, 1)) {
      tell(player, `${NS}.hud.no_ammo`, { translate: `item.${NS}:${r.ammo}.name` });
      return false;
    }
    wearSelected(player);
  }
  s.ticks += r.pulseTicks;
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  const { dimension } = player;
  for (let k = 1; k <= r.range; k += 0.75) {
    const j = () => (Math.random() - 0.5) * 0.25 * k;
    dimension.spawnParticle('minecraft:basic_flame_particle', { x: eye.x + dir.x * k + j(), y: eye.y + dir.y * k + j() - 0.2, z: eye.z + dir.z * k + j() });
  }
  if (s.ticks % 12 === 0) dimension.playSound('mob.ghast.fireball', eye, { pitch: 1.6, volume: 0.4 });
  for (const e of dimension.getEntities({ location: eye, maxDistance: r.range + 1 })) {
    if (!mayHurt(e, player) || !inCone(eye, dir, add(e.location, { x: 0, y: 0.5, z: 0 }), r.range, r.cone)) continue;
    hurt(e, r.damage, player, r.fire);
  }
  // Sets the ground alight, like flint and steel would.
  if (s.ticks % 20 === 0 && mayGrief()) {
    try {
      const hit = player.getBlockFromViewDirection({ maxDistance: r.range });
      const above = hit?.block.above();
      if (above?.isAir && !hit.block.isAir && !hit.block.isLiquid) above.setType('minecraft:fire');
    } catch {}
  }
  return true;
}

// ---------------------------------------------------------------- hits

function hitEntity(event) {
  let type;
  try {
    type = event.projectile.typeId;
  } catch {
    return;
  }
  const target = event.getEntityHit()?.entity;
  const attacker = event.source;
  if (type === GRENADE) return burst(event.dimension, event.location, attacker);
  if (!mayHurt(target, attacker)) return;
  if (type === BOLT) {
    const g = RULES.guns.lava_pistol;
    hurt(target, g.damage, attacker, g.fire);
  } else if (type === BLOB) {
    const g = RULES.guns.lava_gun;
    // Shut in first: it burns when it gets out.
    hurt(target, g.damage, attacker, 0);
    if (!encase(target, attacker) && target.isValid && !isFireproof(target)) target.setOnFire(g.fire, true);
  } else if (type === OBSIDIAN) {
    const g = RULES.guns.obsidian_gun;
    const box = hitbox(target);
    hurt(target, g.damage, attacker, g.fire);
    // Sets round its feet.
    setObsidian(event.dimension, floor(target.location), 'y', box);
  }
}

function hitBlock(event) {
  let type;
  try {
    type = event.projectile.typeId;
  } catch {
    return;
  }
  const { dimension, location, source } = event;
  if (type === GRENADE) return burst(dimension, location, source);
  if (type === OBSIDIAN) {
    const face = event.getBlockHit();
    if (!face?.block) return setObsidian(dimension, floor(location), 'y');
    return setObsidian(dimension, add(face.block.location, faceOffset(face.face)), AXES[face.face] ?? 'y');
  }
  if (type !== BLOB) return;
  const s = RULES.guns.lava_gun.splash;
  splash(dimension, location, s, source);
  dimension.spawnParticle('minecraft:lava_particle', location);
  if (s.lava && mayGrief()) {
    const face = event.getBlockHit();
    const p = floor(location);
    const at = face?.block ? add(face.block.location, faceOffset(face.face)) : p;
    lavaPatch(dimension, [at], RULES.temporary.lava);
  }
}

const OFFSETS = { Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], West: [-1, 0, 0], East: [1, 0, 0] };
const AXES = { Up: 'y', Down: 'y', North: 'z', South: 'z', West: 'x', East: 'x' };
function faceOffset(face) {
  const [x, y, z] = OFFSETS[face] ?? [0, 1, 0];
  return { x, y, z };
}

/** The grenade bursts: fire all round, and a ring of lava on the ground. */
function burst(dimension, location, attacker) {
  const g = RULES.grenade;
  splash(dimension, location, { radius: g.radius, damage: g.damage, fire: g.fire }, attacker);
  dimension.playSound('random.explode', location, { pitch: 1.4, volume: 0.8 });
  dimension.spawnParticle('minecraft:huge_explosion_emitter', location);
  for (let i = 0; i < 8; i++) dimension.spawnParticle('minecraft:lava_particle', location);
  if (mayGrief()) {
    const p = floor(location);
    lavaPatch(dimension, ring(p.x, p.y, p.z, g.ring), RULES.temporary.lava);
  }
}

/** The magma golem's slam: lava bursts out of the ground around what it hit. */
export function slam(golem, target) {
  const { dimension } = golem;
  try {
    dimension.playSound('random.explode', target.location, { pitch: 0.5, volume: 0.6 });
    dimension.spawnParticle('minecraft:lava_particle', target.location);
    target.applyKnockback({ x: 0, z: 0 }, 0.5);
  } catch {}
  if (!mayGrief()) return;
  const p = floor(target.location);
  // Around it, not under its feet: it has a moment to get away.
  lavaPatch(dimension, disc(p.x, p.y, p.z, RULES.golem.slamLava + 1).filter((q) => q.x !== p.x || q.z !== p.z), RULES.temporary.lava);
}

// ---------------------------------------------------------------- setup

export function setupGuns() {
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    const gun = GUNS[itemStack?.typeId];
    if (!gun || !isPlayer(source)) return;
    system.run(() => {
      if (source.isValid) fireGun(source, itemStack, gun);
    });
  });
  world.afterEvents.itemStartUse.subscribe(({ itemStack, source }) => {
    if (itemStack?.typeId === SPRAYER && isPlayer(source)) spraying.set(source.id, { player: source, ticks: 0 });
  });
  world.afterEvents.itemStopUse.subscribe(({ source }) => spraying.delete(source.id));
  world.afterEvents.playerLeave.subscribe(({ playerId }) => spraying.delete(playerId));
  system.runInterval(() => {
    for (const [id, s] of spraying) if (!spray(s)) spraying.delete(id);
  }, RULES.sprayer.pulseTicks);

  world.afterEvents.projectileHitEntity.subscribe(hitEntity);
  world.afterEvents.projectileHitBlock.subscribe(hitBlock);
  system.runInterval(tickHeld, 1);
}
