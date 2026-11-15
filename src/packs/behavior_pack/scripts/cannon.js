// The lava cannon. It is put down like a spawn egg and stays where it is. Use it and
// it turns to where you look and fires a ball of lava, which leaves lava that stays
// where it lands; sneak and use it to pick the range, 1 to 5.
//
// The ball is flown by scripts/flight.js.
import { system, world } from '@minecraft/server';
import { RULES } from './data.js';
import { launch } from './flight.js';
import { hurt } from './guns.js';
import { placeLasting } from './lava.js';
import { nextRange, shotSpeed } from './temp.js';
import { add, floor, isCreative, mayGrief, NS, takeItems, tell } from './util.js';

const C = RULES.cannon;
const CANNON = `${NS}:${C.id}`;
const BALL = `${NS}:${C.projectile}`;
const RANGE = `${NS}:range`;
// Ranges are from the cannon; the ball leaves from the muzzle, a little ahead of it.
const SPEEDS = C.ranges.map((r) => shotSpeed(r - C.muzzle.forward, C.angle, C.gravity, C.muzzle.up));

const readyAt = new Map(); // cannon id -> tick it may fire again
const lastUse = new Map(); // player id -> tick of their last use (one click can be heard twice)

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
  const vel = { x: ahead.x * Math.cos(a) * speed, y: Math.sin(a) * speed, z: ahead.z * Math.cos(a) * speed };
  launch(dimension, BALL, from, vel, { gravity: C.gravity, owner: player, ignore: [CANNON], land });
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
  world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => readyAt.delete(removedEntityId));
  world.afterEvents.playerLeave.subscribe(({ playerId }) => lastUse.delete(playerId));
}
