// Pictures drawn in code: 16x16 item icons, block textures (the lava lamps are
// animated strips of frames), and the magmasteel armour layers.
import { PNG } from 'pngjs';
import { fbm, hex, mix, noise3, pixelIcon, shade, worley } from './lib/texture.mjs';

// ---------------------------------------------------------------- colours

export const C = {
  outline: '#26140c',
  steel: '#4a4f57', steelLight: '#7b818a', steelDark: '#30343a',
  lava: '#ff7a1a', lavaLight: '#ffd23a', lavaDark: '#c8321a', lavaDeep: '#7a1c0c',
  magmasteel: '#6e2c1c', magmasteelLight: '#a8482a', magmasteelDark: '#3e1810',
  wood: '#5a3a22', woodDark: '#3e2716',
  obsidian: '#1d1028', obsidianLight: '#4a2a6a', glass: '#b7d6e6',
};

const P = {
  k: C.outline, g: C.steel, G: C.steelLight, d: C.steelDark,
  o: C.lava, y: C.lavaLight, r: C.lavaDark, R: C.lavaDeep,
  m: C.magmasteel, M: C.magmasteelLight, n: C.magmasteelDark,
  w: C.wood, W: C.woodDark, b: C.glass, x: C.obsidian, v: C.obsidianLight,
};

const draw = (rows) => pixelIcon(rows, P);

// ---------------------------------------------------------------- items

export const ICONS = {
  lava_pistol: draw([
    '................',
    '................',
    '................',
    '.....kkkkkkkkkk.',
    '....kGGGGGGGGGGk',
    '....kgggoyoggggk',
    '....kgggggggggk.',
    '....kkkwwkkkkk..',
    '.....kwwk.kk....',
    '.....kwwkk......',
    '....kwwwk.......',
    '....kWWWk.......',
    '....kkkkk.......',
    '................',
    '................',
    '................',
  ]),
  lava_gun: draw([
    '................',
    '................',
    '................',
    '......kkkk......',
    '.....kyooRk.....',
    '.....koooRk.....',
    'kkkkkkkkkkkkkkk.',
    'kGGGGGGGGGGGGGGk',
    'kggoooyoooggddk.',
    'kkkdgggggggkkk..',
    '..kwwkkkdk......',
    '..kwwk..kk......',
    '.kwwwk..........',
    '.kWWWk..........',
    '.kkkkk..........',
    '................',
  ]),
  obsidian_gun: draw([
    '................',
    '................',
    '................',
    '......kkkk......',
    '.....kxooxk.....',
    '.....kxyoxk.....',
    'kkkkkkkkkkkkkkk.',
    'kvvvvvvvvvvvvvvk',
    'kxxoooyoooxxddk.',
    'kkkdxxxxxxxkkk..',
    '..kwwkkkdk......',
    '..kwwk..kk......',
    '.kwwwk..........',
    '.kWWWk..........',
    '.kkkkk..........',
    '................',
  ]),
  // A fat bombard on its carriage, lava glowing in the muzzle.
  lava_cannon: draw([
    '................',
    '................',
    '..........kkkk..',
    '........kkGGGGk.',
    '......kkGgggggkk',
    '....kkGgggggkkyk',
    '...kGggdggggkoyk',
    '..kGgggdgggggkrk',
    '..kggggdggggggk.',
    '..kddgdddgggkk..',
    '...kkkkkkkkk....',
    '..kWwWwWkwwwk...',
    '.kWkwWwkWkkwwk..',
    '.kwWWkWWwk.kwwk.',
    '.kWkwWwkWk..kkk.',
    '..kWwWwWk.......',
  ]),
  magma_sprayer: draw([
    '................',
    '....kkkkkk......',
    '...kRrrrrRk.....',
    '...kroooork.....',
    '...kroyyork.....',
    '...kRrrrrRk.....',
    '....kkdkkk......',
    '..kkkkdkkkkkkk..',
    '.kGGGGGGGGGGGGkk',
    '.kgggggggggggGko',
    '.kkkkdggggkkkkky',
    '...kwwkkdk....o.',
    '...kwwk.kk......',
    '..kwwwk.........',
    '..kkkkk.........',
    '................',
  ]),
  magma_grenade: draw([
    '................',
    '.......kk.......',
    '......kGGk......',
    '.....kkddkkk....',
    '....kmmmmmmGk...',
    '...kmnormnmmk...',
    '..kmmnoynmrmmk..',
    '..kmrnnonnnoRk..',
    '..kmmoonmmonmk..',
    '..kmnmyonnrmmk..',
    '..knmmrnmmmnmk..',
    '...knnmmonmnk...',
    '....knnnmnnk....',
    '.....kkkkkk.....',
    '................',
    '................',
  ]),
  lava_cell: draw([
    '................',
    '................',
    '.......kk.......',
    '......kGGk......',
    '.....kkkkkk.....',
    '.....kGbbgk.....',
    '.....kyoork.....',
    '.....kooorRk....',
    '.....kooorRk....',
    '.....koorrRk....',
    '.....korrRRk....',
    '.....kggggdk....',
    '.....kkkkkkk....',
    '................',
    '................',
    '................',
  ]),
  magma_charge: draw([
    '................',
    '................',
    '................',
    '......kkkk......',
    '.....kRrrRk.....',
    '....kRoyorRk....',
    '....kroyyoork...',
    '...kRoyyoorRk...',
    '...kRrooyorRk...',
    '....kRroorRk....',
    '....kkRrrRkk....',
    '......kkkk......',
    '................',
    '................',
    '................',
    '................',
  ]),
  magma_core: draw([
    '................',
    '................',
    '.......kk.......',
    '.....kkRRkk.....',
    '....kRrooorRk...',
    '...kRooyyyoorRk.',
    '...kroyyyyyyork.',
    '..kRoyyyyyyyoRk.',
    '..kRooyyyyyyoRk.',
    '...kroyyyyyoork.',
    '...kRrooyoorRk..',
    '....kRrooorRk...',
    '.....kkRRRkk....',
    '.......kk.......',
    '................',
    '................',
  ]),
  magmasteel_ingot: draw([
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkkkkk...',
    '.....kMMoMMMMk..',
    '....kMMMMMMoMMk.',
    '...kkkkkkkkkkkk.',
    '...kmmmmmommmnk.',
    '...kmomnmmmmmnk.',
    '...knnnnnnnnnnk.',
    '...kkkkkkkkkkkk.',
    '................',
    '................',
    '................',
  ]),
  magmasteel_sword: draw([
    '.............kkk',
    '............kMok',
    '...........kMonk',
    '..........kMonk.',
    '.........kMonk..',
    '........kMonk...',
    '.......kMonk....',
    '..kk..kMonk.....',
    '..kmkkMonk......',
    '...kmMonk.......',
    '...kkmnk........',
    '..kwkkmmk.......',
    '.kwWk..kmk......',
    'kwWk....kk......',
    'kkk.............',
    '................',
  ]),
  magmasteel_pickaxe: draw([
    '................',
    '.....kkkkkk.....',
    '...kkMMoMMMkk...',
    '..kMMnkkkkoMMk..',
    '.kMnk.....kwMMk.',
    '.kok.....kwWknMk',
    '.kk.....kwWk.kok',
    '.......kwWk...kk',
    '......kwWk......',
    '.....kwWk.......',
    '....kwWk........',
    '...kwWk.........',
    '..kwWk..........',
    '.kwWk...........',
    '.kkk............',
    '................',
  ]),
  magmasteel_axe: draw([
    '................',
    '......kkkk......',
    '.....kMMMMk.....',
    '....kMMoMMnk....',
    '....kMMMkwWk....',
    '.....kkkwWk.....',
    '.......kwWk.....',
    '......kwWk......',
    '.....kwWk.......',
    '....kwWk........',
    '...kwWk.........',
    '..kwWk..........',
    '.kwWk...........',
    '.kkk............',
    '................',
    '................',
  ]),
  magmasteel_shovel: draw([
    '...........kkk..',
    '..........kMMMk.',
    '.........kMoMMk.',
    '.........kMMMnk.',
    '..........knnk..',
    '.........kwkk...',
    '........kwWk....',
    '.......kwWk.....',
    '......kwWk......',
    '.....kwWk.......',
    '....kwWk........',
    '...kwWk.........',
    '..kwWk..........',
    '.kwWk...........',
    '.kkk............',
    '................',
  ]),
  magmasteel_helmet: draw([
    '................',
    '................',
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kMMMoMMMMMnk..',
    '..kMMMMMMoMMnk..',
    '..kmmkkkkkkmnk..',
    '..kmk......knk..',
    '..kmk......knk..',
    '..kkk......kkk..',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  magmasteel_chestplate: draw([
    '................',
    '..kkkk....kkkk..',
    '.kMMMkkkkkkMMnk.',
    '.kMMMMMoMMMMMnk.',
    '.kmMMMMMMMMMmnk.',
    '.kkkmMMMoMMmkkk.',
    '...kmMMMMMMnk...',
    '...kmMoMMMMnk...',
    '...kmMMMMMMnk...',
    '...kmMMMMoMnk...',
    '...kmmmmmmmnk...',
    '...kkkkkkkkkk...',
    '................',
    '................',
    '................',
    '................',
  ]),
  magmasteel_leggings: draw([
    '................',
    '...kkkkkkkkkk...',
    '...kMMMoMMMMk...',
    '...kmMMMMMMnk...',
    '...kmMMkkMMnk...',
    '...kmMnkkmMnk...',
    '...kmMnk.kmnk...',
    '...kmonk.kmnk...',
    '...kmMnk.kMnk...',
    '...kmMnk.kmok...',
    '...kmMnk.kMnk...',
    '...kkkkk.kkkk...',
    '................',
    '................',
    '................',
    '................',
  ]),
  magmasteel_boots: draw([
    '................',
    '................',
    '................',
    '................',
    '................',
    '...kkkk..kkkk...',
    '...kMnk..kMnk...',
    '...kMnk..kMnk...',
    '...kmok..kmok...',
    '..kMMnk..kMMnk..',
    '.kMMMnk..kMMMnk.',
    '.kkkkkk..kkkkkk.',
    '................',
    '................',
    '................',
    '................',
  ]),
};

// ---------------------------------------------------------------- textures

function canvas(w, h, f) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) png.data.set(f(x, y), (y * w + x) * 4);
  return png;
}
const encode = (png) => PNG.sync.write(png);

/** Glowing lava: bright where the noise is high. */
function lavaColour(x, y, z = 0, seed = 1) {
  const n = fbm(x / 4, y / 4, z, seed);
  return n > 0.62 ? hex(C.lavaLight) : n > 0.45 ? hex(C.lava) : n > 0.32 ? hex(C.lavaDark) : hex(C.lavaDeep);
}

/** Dark cooled rock with glowing cracks between the cells. */
function magmaRock(x, y, seed, crack = 0.08) {
  const { d1, d2 } = worley(x / 5, y / 5, 0.5, seed);
  if (d2 - d1 < crack) return mix(hex(C.lava), hex(C.lavaLight), fbm(x, y, 1, seed));
  const n = noise3(x / 2, y / 2, 0, seed + 3);
  return shade(hex('#3a1a12'), 0.8 + 0.4 * n);
}

export const BLOCK_TEXTURES = {
  // Bricks of dark magma rock, with lava glowing in the joints.
  magma_bricks: () => encode(canvas(16, 16, (x, y) => {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 4 : 0;
    const joint = y % 4 === 3 || (x + off) % 8 === 7;
    if (joint) return mix(hex(C.lavaDark), hex(C.lava), noise3(x, y, 2, 5));
    return shade(hex('#4a2216'), 0.75 + 0.45 * noise3(x / 2, y / 2, row, 9) - (y % 4 === 0 ? 0 : 0.08));
  })),
  // Smooth dark stone with thin glowing veins.
  polished_magma: () => encode(canvas(16, 16, (x, y) => {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    const v = Math.abs(fbm(x / 6, y / 6, 3, 17) - 0.5);
    if (!edge && v < 0.012) return hex(C.lava);
    return shade(hex('#3c1c14'), (edge ? 0.7 : 0.95) + 0.15 * noise3(x / 3, y / 3, 1, 4));
  })),
  // A carved ring with a lava eye in the middle.
  chiseled_magma: () => encode(canvas(16, 16, (x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 2.2) return mix(hex(C.lavaLight), hex(C.lava), d / 2.2);
    if (d > 4.5 && d < 5.8) return shade(hex('#2a120c'), 1);
    const edge = x === 0 || y === 0 || x === 15 || y === 15 || x === 1 || y === 1 || x === 14 || y === 14;
    return shade(hex('#4a2216'), (edge ? 0.7 : 1) + 0.2 * noise3(x / 2, y / 2, 7, 2));
  })),
  magmasteel_block: () => encode(canvas(16, 16, (x, y) => {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    if (edge) return hex(C.magmasteelDark);
    if ((x + y) % 7 === 0 && noise3(x, y, 0, 3) > 0.55) return hex(C.lava);
    return shade(hex(C.magmasteel), 0.85 + 0.35 * noise3(x / 3, y / 3, 2, 8) + (y < 4 ? 0.12 : 0));
  })),
  tank_top: () => encode(canvas(16, 16, (x, y) => {
    const edge = x <= 1 || y <= 1 || x >= 14 || y >= 14;
    if (edge) return shade(hex(C.steel), x <= 1 || y <= 1 ? 1.15 : 0.85);
    const hatch = Math.hypot(x - 7.5, y - 7.5);
    if (hatch < 3.5) return shade(hex(C.steelDark), hatch > 2.6 ? 1.3 : 1);
    return shade(hex(C.steel), 0.95 + 0.1 * noise3(x, y, 0, 6));
  })),
};

/** The tank's side: an iron frame round a window with lava `stage` quarters full (0–4). */
export function tankSide(stage, stages = 4) {
  const level = Math.round((stage / stages) * 12); // window rows 2..13
  return encode(canvas(16, 16, (x, y) => {
    const frame = x <= 1 || x >= 14 || y <= 1 || y >= 14;
    if (frame) return shade(hex(C.steel), x <= 1 || y <= 1 ? 1.15 : 0.85);
    if (x === 2 || x === 13 || y === 2 || y === 13) return hex(C.steelDark);
    const fromBottom = 13 - y;
    if (fromBottom < level) return lavaColour(x, y, 0, 3);
    return mix(hex(C.glass), hex('#ffffff'), x === 4 || x === 5 ? 0.5 : 0);
  }));
}

export const LAMP_COLOURS = {
  orange: { liquid: '#3a1a6a', blob: C.lava, glow: C.lavaLight },
  red: { liquid: '#2a2a40', blob: '#e0302a', glow: '#ff8a6a' },
  purple: { liquid: '#14304a', blob: '#b04ae0', glow: '#e6a6ff' },
  green: { liquid: '#3a1430', blob: '#4ae04a', glow: '#c6ffa6' },
};
export const LAMP_FRAMES = 16;

/** Lava lamp: a vertical strip of 16x16 frames, blobs rising and sinking in coloured liquid. */
export function lampStrip(colour) {
  const c = LAMP_COLOURS[colour];
  const blobs = [
    { x: 5, r: 2.3, phase: 0, speed: 1 },
    { x: 10.5, r: 1.8, phase: 0.45, speed: 1 },
    { x: 8, r: 1.4, phase: 0.75, speed: 2 },
  ];
  return encode(canvas(16, 16 * LAMP_FRAMES, (x, yy) => {
    const frame = Math.floor(yy / 16), y = yy % 16;
    // Metal cap and base, the glass in between.
    if (y <= 1 || y >= 14) return shade(hex(C.steel), y === 0 || y === 15 ? 0.8 : 1.1);
    if (x === 0 || x === 15) return shade(hex(C.steelDark), 1.2);
    let col = mix(hex(c.liquid), hex(c.glow), 0.15 + 0.1 * (1 - y / 14));
    for (const b of blobs) {
      const t = (frame / LAMP_FRAMES) * b.speed + b.phase;
      const by = 12.5 - 10 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2));
      const d = Math.hypot((x - b.x) * 1.1, (y - by) * 0.8);
      if (d < b.r) col = mix(hex(c.glow), hex(c.blob), d / b.r);
    }
    // A pool of wax at the bottom.
    if (y >= 12) col = mix(hex(c.blob), col, 0.3);
    return col;
  }));
}

/** The magmasteel armour, in the vanilla 64x32 layout (one picture for every part). */
export function armorLayer(layer) {
  return encode(canvas(64, 32, (x, y) => {
    const n = noise3(x / 3, y / 3, layer, 13);
    if (worley(x / 4, y / 4, layer, 21).d1 < 0.12) return hex(C.lava);
    return shade(hex(C.magmasteel), 0.75 + 0.5 * n);
  }));
}

/** A small cube of glowing lava for projectiles (Bedrock entity texture). */
export function lavaBallTexture(w, h, seed = 1) {
  return encode(canvas(w, h, (x, y) => lavaColour(x * 2, y * 2, 0, seed)));
}

/** Lava setting into obsidian: dark purple with the last of the lava glowing through. */
export function obsidianBallTexture(w, h, seed = 1) {
  return encode(canvas(w, h, (x, y) => {
    const n = fbm(x / 2, y / 2, 0, seed);
    if (n > 0.66) return hex(C.lava);
    return shade(hex(C.obsidian), 0.8 + 1.2 * n);
  }));
}
