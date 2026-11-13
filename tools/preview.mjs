// Renders the creatures (from several sides, walking and attacking) into
// build/preview/, plus build/preview/sheet.png with the creatures, every item and
// every block, which is attached to each release.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from './build.mjs';
import { render, sheet } from './render.mjs';
import { NS } from '../src/lib/constants.mjs';
import { firstFrame, upscale } from '../src/lib/png.mjs';

const OUT = 'build/preview';
const { creatures, items, blocks } = await build({ quiet: true });
await mkdir(OUT, { recursive: true });

const CELL = 192;
const portraits = [];
for (const { creature: c, geo, texture, animations } of Object.values(creatures)) {
  const get = (n) => animations.animations[`animation.${NS}.${c.id}.${n}`];
  const views = [
    render(geo.geometry, texture, { yaw: 35 }),
    render(geo.geometry, texture, { yaw: 325 }),
    render(geo.geometry, texture, { yaw: 90, pitch: 5 }),
    render(geo.geometry, texture, { yaw: 35, anim: get('walk'), time: 0.3 }),
    ...(get('attack') ? [render(geo.geometry, texture, { yaw: 35, anim: get('attack'), time: 0.3 })] : []),
  ];
  await writeFile(join(OUT, `${c.id}.png`), sheet(views, { cols: 3 }));
  portraits.push(render(geo.geometry, texture, { yaw: 35, size: CELL }));
}
const icons = items.map((i) => upscale(i.icon, 8));
// A full tank, and the first frame of each lava lamp.
const tiles = blocks.map((b) => upscale(b.tank ? b.sides.at(-1) : firstFrame(b.texture), 8));
await writeFile(join(OUT, 'sheet.png'), sheet([...portraits, ...icons, ...tiles], { cols: 6, cell: CELL }));
console.log(`Wrote previews to ${OUT}/`);
