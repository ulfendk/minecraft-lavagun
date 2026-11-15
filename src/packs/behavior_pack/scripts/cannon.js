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
import { nextRange, shotSpeed } from './temp.js';
import { add, dist, floor, isCreative, mayGrief, NS, scale, takeItems, tell } from './util.js';

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

/**
 * Where the ball hits in this tick's move, if anywhere: the nearer of a mob and a block.
 * The rays look a little further than the move (a short ray can miss the block it
 * ends in), and only hits within the move count.
 */
function hitThisTick(s) {
  const length = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
  const dir = scale(s.vel, 1 / length);
  const reach = length + 2;
  let hit = null;
  try {
    const block = s.dimension.getBlockFromRay(s.pos, dir, { maxDistance: reach, includePassableBlocks: false });
    if (block) {
      const at = add(block.block.location, block.faceLocation);
      const distance = dist(s.pos, at);
      if (distance <= length) hit = { distance, block, at, dir };
    }
    for (const { entity, distance } of s.dimension.getEntitiesFromRay(s.pos, dir, { maxDistance: reach, excludeTypes: [BALL, CANNON] })) {
      if (distance > length) break;
      if (entity.id === s.owner?.id || !mayHurt(entity, s.owner)) continue;
      if (!hit || distance < hit.distance) hit = { distance, entity, at: add(s.pos, scale(dir, distance)) };
      break;
    }
  } catch (e) {
    }
  return hit;
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
    // The block the ball was in just before it hit (the ray's face is not to be trusted).
    lastingLava(dimension, floor(add(hit.at, scale(hit.dir, -0.05))));
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
