// Balls flown from here, tick by tick, along the same path as on Java (moves, slows
// by 1 %, falls): the lava cannon's balls and the volcanoes' bombs. Bedrock's own
// projectiles slow down far more, and the ranges would not hold.
import { system, world } from '@minecraft/server';
import { mayHurt } from './guns.js';
import { canReplace } from './temp.js';
import { add, floor, hitbox, scale } from './util.js';

const MAX_TICKS = 400;
const flights = new Map(); // ball id -> { ball, dimension, pos, vel, gravity, owner, ignore, land, age }
const types = new Set();

/**
 * Fly a ball of entity `type` from `from` at `vel` (blocks a tick). `land(flight, hit)`
 * is called where it hits: `hit` has `at`, and `entity` for a mob, or `before` (where
 * the ball was just before it hit) for a block. `ignore` lists entity types it passes through.
 */
export function launch(dimension, type, from, vel, { gravity, owner, ignore = [], land }) {
  const ball = dimension.spawnEntity(type, from);
  types.add(type);
  flights.set(ball.id, { ball, dimension, pos: from, vel, gravity, owner, ignore: [type, ...ignore], land, age: 0 });
  return ball;
}

export const flying = () => flights.size;

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
    const near = s.dimension.getEntities({ location: s.pos, maxDistance: length + 3, excludeTypes: s.ignore })
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

function end(id, s) {
  flights.delete(id);
  try {
    s.ball.remove();
  } catch {}
}

function tick() {
  for (const [id, s] of flights) {
    if (!s.ball.isValid || ++s.age > MAX_TICKS) {
      end(id, s);
      continue;
    }
    const hit = hitThisTick(s);
    if (hit) {
      end(id, s);
      s.land(s, hit);
      continue;
    }
    s.pos = add(s.pos, s.vel);
    s.vel = { x: s.vel.x * 0.99, y: s.vel.y * 0.99 - s.gravity, z: s.vel.z * 0.99 };
    try {
      s.ball.teleport(s.pos);
    } catch {
      // Flown out of the loaded world.
      end(id, s);
    }
  }
}

export function setupFlight() {
  system.runInterval(tick, 1);
  // A ball left in the air when the world was closed has lost its flight: take it away.
  world.afterEvents.entityLoad.subscribe(({ entity }) => {
    try {
      if (types.has(entity.typeId) && !flights.has(entity.id)) entity.remove();
    } catch {}
  });
}
