import { system, world } from '@minecraft/server';
import { setupCannon } from './cannon.js';
import { setupFlight } from './flight.js';
import { setupGear } from './gear.js';
import { setupGuns } from './guns.js';
import { setupLava } from './lava.js';
import { setupSelfTest } from './selftest.js';
import { registerTank } from './tank.js';
import { registerVent, setupVolcano } from './volcano.js';
import { LOG } from './util.js';

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  registerTank(blockComponentRegistry);
  registerVent(blockComponentRegistry);
});

world.afterEvents.worldLoad.subscribe(() => {
  setupLava();
  setupGuns();
  setupFlight();
  setupCannon();
  setupVolcano();
  setupGear();
  setupSelfTest();
  console.log(`${LOG} loaded`);
});
