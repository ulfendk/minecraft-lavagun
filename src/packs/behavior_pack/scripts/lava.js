// Temporary blocks in the world: lava from shots, obsidian shells, basalt under
// lava walker boots. The list is saved with the world, so a block whose time is
// up while the world is closed is put back the next time it is loaded.
import { system, world } from '@minecraft/server';
import { canReplace, canSet, shouldRestore, TempBlocks } from './temp.js';
import { LOG } from './util.js';

const PROP = 'lavagun:temp_blocks';
const SWEEP = 5; // ticks between sweeps
let temp = new TempBlocks();
let dirty = false;

const at = (dimension, { x, y, z }) => ({ d: dimension.id, x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });

/** Is the block at `pos` one of ours, and due to go away? */
export const isTemporary = (dimension, pos) => temp.has(at(dimension, pos));

/**
 * Put `type` at `pos` for `seconds`, then put `restore` back. Only where `replace(block)`
 * allows (by default: air, grass, flowers and the like). True if the block was placed.
 * With `refresh`, a block that is already ours gets its full time again.
 */
export function placeTemp(dimension, pos, type, seconds, { restore = 'minecraft:air', replace = (b) => canReplace(b.typeId), refresh = false } = {}) {
  const e = at(dimension, pos);
  if (temp.has(e)) {
    if (refresh && temp.get(e).b === type) temp.refresh(e, Math.round(seconds * 20));
    return false;
  }
  let block;
  try {
    block = dimension.getBlock(e);
  } catch {
    return false;
  }
  if (!block || !replace(block)) return false;
  block.setType(type);
  temp.add({ ...e, b: type, r: restore, t: Math.round(seconds * 20) });
  dirty = true;
  return true;
}

/**
 * A block that stays (obsidian from the obsidian gun, lava from the lava cannon): only
 * where `replace(typeId)` allows, and never on one of our temporary blocks. True if
 * it was placed.
 */
export function placeLasting(dimension, pos, type, replace = canReplace) {
  const e = at(dimension, pos);
  if (temp.has(e)) return false;
  try {
    const block = dimension.getBlock(e);
    if (!block || !replace(block.typeId)) return false;
    block.setType(type);
    return true;
  } catch {
    return false;
  }
}

/** Obsidian that stays: where a shot may go, or on lava. */
export const placeObsidian = (dimension, pos) => placeLasting(dimension, pos, 'minecraft:obsidian', canSet);

function sweep() {
  for (const e of temp.tick(SWEEP)) {
    try {
      const block = world.getDimension(e.d).getBlock(e);
      if (!block) {
        // Not loaded: try again in a second.
        temp.add({ ...e, t: 20 });
        continue;
      }
      if (shouldRestore(e, block.typeId)) block.setType(e.r);
    } catch {
      temp.add({ ...e, t: 20 });
    }
    dirty = true;
  }
}

function save() {
  if (!dirty) return;
  dirty = false;
  try {
    world.setDynamicProperty(PROP, JSON.stringify(temp));
  } catch (err) {
    console.warn(`${LOG} could not save temporary blocks: ${err}`);
  }
}

export function setupLava() {
  temp = TempBlocks.fromJSON(world.getDynamicProperty(PROP) ?? '[]');
  system.runInterval(sweep, SWEEP);
  system.runInterval(save, 20);
  // A temporary block that is mined just goes away: no free obsidian or basalt.
  world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const { block, dimension } = event;
    const e = at(dimension, block.location);
    if (!temp.has(e)) return;
    event.cancel = true;
    system.run(() => {
      temp.forget(e);
      dirty = true;
      try {
        dimension.getBlock(e)?.setType('minecraft:air');
        dimension.playSound('dig.stone', block.location);
      } catch {}
    });
  });
}

export const temporaryCount = () => temp.size;
