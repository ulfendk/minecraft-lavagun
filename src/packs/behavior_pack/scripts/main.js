import { system, world } from '@minecraft/server';
import { setupGear } from './gear.js';
import { setupGuns } from './guns.js';
import { setupLava } from './lava.js';
import { setupSelfTest } from './selftest.js';
import { registerTank } from './tank.js';
import { LOG } from './util.js';

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  registerTank(blockComponentRegistry);
});

world.afterEvents.worldLoad.subscribe(() => {
  setupLava();
  setupGuns();
  setupGear();
  setupSelfTest();
  console.log(`${LOG} loaded`);
});
