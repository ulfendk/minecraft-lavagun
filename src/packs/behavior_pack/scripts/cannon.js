// The lava cannon. It is put down like a spawn egg and stays where it is. Use it and
// it turns to where you look and fires a ball of lava, which leaves lava that stays
// where it lands; sneak and use it to pick the range, 1 to 5.
//
// The ball is flown from here, tick by tick, along the same path as on Java (moves,
// slows by 1 %, falls): Bedrock's own projectiles slow down far more, and the
// ranges would not hold.
import { system, world } from '@minecraft/server';
import { RULES } from './data.js';
import { hurt, mayHurt } from './guns.js';
import { placeLasting } from './lava.js';
import { canReplace, nextRange, shotSpeed } from './temp.js';
import { add, floor, hitbox, isCreative, mayGrief, NS, scale, takeItems, tell } from './util.js';

const C = RULES.cannon;
const CANNON = `${NS}:${C.id}`;
const BALL = `${NS}:${C.projectile}`;
const RANGE = `${NS}:range`;
// Ranges are from the cannon; the ball leaves from the muzzle, a little ahead of it.
const SPEEDS = C.ranges.map((r) => shotSpeed(r - C.muzzle.forward, C.angle, C.gravity, C.muzzle.up));
const MAX_TICKS = 400;

const readyAt = new Map(); // cannon id -> tick it may fire again
const lastUse = new Map(); // player id -> tick of their last use (one click can be heard twice)
const balls = new Map(); // ball id -> { ball, dimension, pos, vel, owner, age }

export const getRange = (cannon) => cannon.getDynamicProperty(RANGE) ?? C.startRange;

/** Sneak and use: the next range, 1 to 5 and round again. */
export function stepRange(cannon, player) {
  const n = nextRange(getRange(cannon), C.ranges.length);
  cannon.setDynamicProperty(RANGE, n);
  if (player) {
    tell(player, `${NS}.hud.range`, n, C.ranges[n - 1]);
    player.playSound('random.click', { pitch: 0.6 + n * 0.15 });
  }
  return n;
}

/** Fire at the cannon's range; with a player, turn to where they look and use their lava cells. */
export function fireCannon(cannon, player) {
  const now = system.currentTick;
  if ((readyAt.get(cannon.id) ?? 0) > now) return false;
  if (player && !isCreative(player) && !takeItems(player, `${NS}:${C.ammo}`, C.ammoPerShot)) {
    tell(player, `${NS}.hud.no_ammo`, { translate: `item.${NS}:${C.ammo}.name` });
    player.playSound('random.click', { pitch: 1.6 });
    return false;
  }
  readyAt.set(cannon.id, now + Math.round(C.cooldown * 20));
  if (player) cannon.setRotation({ x: 0, y: player.getRotation().y });
  const yaw = (cannon.getRotation().y * Math.PI) / 180;
  const a = (C.angle * Math.PI) / 180;
  const ahead = { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) };
  const from = add(cannon.location, { x: ahead.x * C.muzzle.forward, y: C.muzzle.up, z: ahead.z * C.muzzle.forward });
  const speed = SPEEDS[getRange(cannon) - 1];
  const { dimension } = cannon;
  const ball = dimension.spawnEntity(BALL, from);
  const vel = { x: ahead.x * Math.cos(a) * speed, y: Math.sin(a) * speed, z: ahead.z * Math.cos(a) * speed };
  balls.set(ball.id, { ball, dimension, pos: from, vel, owner: player, age: 0 });
  try {
    cannon.playAnimation(`animation.${NS}.${C.id}.fire`);
    dimension.playSound('random.explode', from, { pitch: 0.7, volume: 1.2 });
    dimension.spawnParticle('minecraft:large_explosion', from);
    for (let i = 0; i < 4; i++) dimension.spawnParticle('minecraft:lava_particle', from);
  } catch {}
  return true;
}

/** Lava that stays, at `pos` or (if that is taken) just above. */
function lastingLava(dimension, pos) {
  if (!mayGrief()) return false;
  return placeLasting(dimension, pos, 'minecraft:lava') || placeLasting(dimension, add(pos, { x: 0, y: 1, z: 0 }), 'minecraft:lava');
}

/** Does the ball stop in this block? Not in air, water, lava or grass and flowers. */
function stops(block) {
  return !!block && !block.isAir && !block.isLiquid && !canReplace(block.typeId);
}

/** Is `p` inside `entity`'s hitbox (give or take the ball's size)? */
function inside(entity, p) {
  const { min, max } = hitbox(entity);
  const r = 0.2;
  return p.x > min[0] - r && p.x < max[0] + r && p.y > min[1] - r && p.y < max[1] + r && p.z > min[2] - r && p.z < max[2] + r;
}

/**
 * Where the ball hits in this tick's move, if anywhere: it goes along the move in short
 * steps and stops at the first mob or solid block. (Bedrock's raycasts miss short hops.)
 */
function hitThisTick(s) {
  const length = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
  const steps = Math.max(1, Math.ceil(length / 0.25));
  let before = s.pos;
  try {
    const near = s.dimension.getEntities({ location: s.pos, maxDistance: length + 3, excludeTypes: [BALL, CANNON] })
      .filter((e) => e.id !== s.owner?.id && mayHurt(e, s.owner));
    for (let k = 1; k <= steps; k++) {
      const p = add(s.pos, scale(s.vel, k / steps));
      const entity = near.find((e) => inside(e, p));
      if (entity) return { entity, at: p };
      if (stops(s.dimension.getBlock(floor(p)))) return { at: p, before };
      before = p;
    }
  } catch {}
  return null;
}

function land(s, hit) {
  const { dimension } = s;
  try {
    dimension.playSound('bucket.empty_lava', hit.at, { pitch: 0.8 });
    dimension.spawnParticle('minecraft:lava_particle', hit.at);
  } catch {}
  if (hit.entity) {
    const feet = floor(hit.entity.location);
    hurt(hit.entity, C.damage, s.owner, C.fire);
    lastingLava(dimension, feet);
  } else {
    // The block the ball was in just before it hit.
    lastingLava(dimension, floor(hit.before));
  }
}

function tickBalls() {
  for (const [id, s] of balls) {
    if (!s.ball.isValid || ++s.age > MAX_TICKS) {
          balls.delete(id);
      try {
        s.ball.remove();
      } catch {}
      continue;
    }
    const hit = hitThisTick(s);
    if (hit) {
      balls.delete(id);
      land(s, hit);
      try {
        s.ball.remove();
      } catch {}
      continue;
    }
    s.pos = add(s.pos, s.vel);
    s.vel = { x: s.vel.x * 0.99, y: s.vel.y * 0.99 - C.gravity, z: s.vel.z * 0.99 };
    try {
      s.ball.teleport(s.pos);
    } catch (e) {
          balls.delete(id);
    }
  }
}

export function setupCannon() {
  world.beforeEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
    if (target?.typeId !== CANNON) return;
    const now = system.currentTick;
    if ((lastUse.get(player.id) ?? -10) > now - 4) return;
    lastUse.set(player.id, now);
    const sneaking = player.isSneaking;
    system.run(() => {
      if (!target.isValid || !player.isValid) return;
      if (sneaking) stepRange(target, player);
      else fireCannon(target, player);
    });
  });
  // Put down facing the way the player who put it down is looking.
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (entity?.typeId !== CANNON) return;
    try {
      const [player] = entity.dimension.getPlayers({ location: entity.location, maxDistance: 8, closest: 1 });
      if (player) entity.setRotation({ x: 0, y: player.getRotation().y });
    } catch {}
  });
  // A ball left in the air when the world was closed has lost its flight: take it away.
  world.afterEvents.entityLoad.subscribe(({ entity }) => {
    try {
      if (entity.typeId === BALL && !balls.has(entity.id)) entity.remove();
    } catch {}
  });
  system.runInterval(tickBalls, 1);
  world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => readyAt.delete(removedEntityId));
  world.afterEvents.playerLeave.subscribe(({ playerId }) => lastUse.delete(playerId));
}
