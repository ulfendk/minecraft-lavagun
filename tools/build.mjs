// Generates the behavior pack and resource pack into build/, and the Java
// edition's resources into java/src/generated/resources (tools/java.mjs).
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CREATURES } from '../src/creatures.mjs';
import { cannon } from '../src/cannon.mjs';
import { BLOCK_RECIPES, BLOCKS, bedrockBlock, blockTextures } from '../src/blocks.mjs';
import { buildItem, ITEMS, RECIPES } from '../src/items.mjs';
import { langEntries, LOCALES } from '../src/i18n.mjs';
import { RULES } from '../src/rules.mjs';
import { armorLayer, lavaBallTexture, obsidianBallTexture } from '../src/art.mjs';
import { animationFile } from '../src/lib/anim.mjs';
import {
  buildAnimationControllers, buildCannon, buildCannonClient, buildClientEntity, buildCreature, buildEntitySounds, buildLoot,
  buildProjectile, buildProjectileClient, buildRenderController, buildSpawnRules, projectileModel, PROJECTILES,
} from '../src/lib/entity.mjs';
import { MIN_ENGINE, NS, PACK_NAME, SCRIPT_SERVER_VERSION } from '../src/lib/constants.mjs';
import { packIcon } from '../src/lib/icon.mjs';
import { buildGeometry } from '../src/lib/model.mjs';
import { paintTexture } from '../src/lib/texture.mjs';
import { buildJava } from './java.mjs';
import { volcanoStructure } from './mcstructure.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build');
const BP = join(OUT, 'behavior_pack');
const RP = join(OUT, 'resource_pack');

const UUID = {
  bpHeader: '8b2f4c71-3d5e-4a9b-9f61-2c7d8e0a1b34',
  bpData: 'c4e19a52-7b3f-4d86-a0e2-5f9b1c3d7e48',
  bpScript: '1f7a3e9c-62b4-4c1d-8e5a-9d0b2f4c6a71',
  rpHeader: 'e6d42b18-9a7c-4f35-b1e8-3c5a7d9f0e26',
  rpResources: '5a9c1e3f-8b2d-4e67-9c4a-0f1e3b5d7a89',
};

/** The armour's parts, the vanilla geometry each one uses, and its texture layer. */
const ARMOR_GEOMETRY = {
  helmet: ['head', 'geometry.humanoid.armor.helmet', 1, 'helmet'],
  chestplate: ['chest', 'geometry.humanoid.armor.chestplate', 1, 'chest'],
  leggings: ['legs', 'geometry.humanoid.armor.leggings', 2, 'leg'],
  boots: ['feet', 'geometry.humanoid.armor.boots', 1, 'boot'],
};

async function write(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + '\n');
}

function manifests(version) {
  const v = version.split('.').map(Number);
  const metadata = { authors: ['Lava Guns contributors'], license: 'MIT' };
  const bp = {
    format_version: 2,
    header: { name: `${PACK_NAME} v${version} (Behavior)`, description: 'pack.description', uuid: UUID.bpHeader, version: v, min_engine_version: MIN_ENGINE },
    modules: [
      { type: 'data', uuid: UUID.bpData, version: v },
      { type: 'script', language: 'javascript', uuid: UUID.bpScript, version: v, entry: 'scripts/main.js' },
    ],
    dependencies: [
      { uuid: UUID.rpHeader, version: v },
      { module_name: '@minecraft/server', version: SCRIPT_SERVER_VERSION },
    ],
    metadata,
  };
  const rp = {
    format_version: 2,
    header: { name: `${PACK_NAME} v${version} (Resources)`, description: 'pack.description', uuid: UUID.rpHeader, version: v, min_engine_version: MIN_ENGINE },
    modules: [{ type: 'resources', uuid: UUID.rpResources, version: v }],
    dependencies: [{ uuid: UUID.bpHeader, version: v }],
    metadata,
  };
  return { bp, rp };
}

/** Geometry, texture and animations of every creature (shared with the Java edition, previews and the site). */
export function buildCreatureArt() {
  return Object.fromEntries(CREATURES.map((c) => {
    const geo = buildGeometry(`geometry.${NS}.${c.id}`, c.model);
    return [c.id, { creature: c, geo, texture: paintTexture(geo, c.materials), animations: animationFile(NS, c.id, c.anims) }];
  }));
}

/** Geometry, texture and animations of the lava cannon (shared like the creatures'). */
export function buildCannonArt() {
  const geo = buildGeometry(`geometry.${NS}.${cannon.id}`, cannon.model);
  return { cannon, geo, texture: paintTexture(geo, cannon.materials), animations: animationFile(NS, cannon.id, cannon.anims) };
}

function attachable(item) {
  const [, geometry, layer, visible] = ARMOR_GEOMETRY[item.piece];
  return {
    format_version: '1.10.0',
    'minecraft:attachable': {
      description: {
        identifier: `${NS}:${item.id}`,
        materials: { default: 'armor', enchanted: 'armor_enchanted' },
        textures: { default: `textures/models/${NS}/magmasteel_${layer}`, enchanted: 'textures/misc/enchanted_item_glint' },
        geometry: { default: geometry },
        scripts: { parent_setup: `variable.${visible}_layer_visible = 0.0;` },
        render_controllers: ['controller.render.armor'],
      },
    },
  };
}

/** Natural blocks a volcano may be built over when it generates; anything else (a village, say) stops it. */
const VOLCANO_GROUND = [
  'minecraft:air', 'minecraft:stone', 'minecraft:granite', 'minecraft:diorite', 'minecraft:andesite', 'minecraft:deepslate', 'minecraft:tuff',
  'minecraft:dirt', 'minecraft:coarse_dirt', 'minecraft:grass_block', 'minecraft:podzol', 'minecraft:mycelium', 'minecraft:gravel', 'minecraft:sand',
  'minecraft:red_sand', 'minecraft:sandstone', 'minecraft:snow', 'minecraft:snow_layer', 'minecraft:powder_snow', 'minecraft:ice', 'minecraft:packed_ice',
  'minecraft:calcite', 'minecraft:clay', 'minecraft:terracotta', 'minecraft:short_grass', 'minecraft:tall_grass', 'minecraft:fern', 'minecraft:large_fern',
  'minecraft:water', 'minecraft:lava', 'minecraft:netherrack', 'minecraft:basalt', 'minecraft:blackstone', 'minecraft:magma', 'minecraft:soul_sand',
  'minecraft:soul_soil', 'minecraft:copper_ore', 'minecraft:coal_ore', 'minecraft:iron_ore', 'minecraft:flowing_water', 'minecraft:flowing_lava', 'minecraft:fire',
];

/**
 * Volcanoes that generate with the world: a few volcano structures (the same shapes
 * a volcano vent grows), a feature that picks one, and rules for where they go.
 * Overworld volcanoes have rock under them for uneven ground; the Nether's sit on
 * the floor they are snapped to.
 */
async function buildVolcanoes() {
  const v = RULES.volcano;
  const feature = (type, id, body) => ({ format_version: '1.21.40', [type]: { description: { identifier: `${NS}:${id}` }, ...body } });
  for (const [kind, skirt] of [['volcano', v.skirt], ['volcano_nether', 0]]) {
    for (let i = 0; i < v.variants; i++) {
      await write(join(BP, 'structures', NS, `${kind}_${i}.mcstructure`), volcanoStructure(i, v, skirt));
      await write(join(BP, 'features', `${kind}_${i}_feature.json`), feature('minecraft:structure_template_feature', `${kind}_${i}_feature`, {
        structure_name: `${NS}:${kind}_${i}`,
        adjustment_radius: 4,
        facing_direction: 'random',
        constraints: { unburied: {}, block_intersection: { block_allowlist: VOLCANO_GROUND } },
      }));
    }
    await write(join(BP, 'features', `${kind}_feature.json`), feature('minecraft:weighted_random_feature', `${kind}_feature`, {
      features: Array.from({ length: v.variants }, (_, i) => [`${NS}:${kind}_${i}_feature`, 1]),
    }));
  }
  await write(join(BP, 'features', 'volcano_nether_snap_feature.json'), feature('minecraft:snap_to_surface_feature', 'volcano_nether_snap_feature', {
    feature_to_snap: `${NS}:volcano_nether_feature`, vertical_search_range: 24, surface: 'floor',
  }));
  const tag = (value, operator = '==') => ({ test: 'has_biome_tag', operator, value });
  const square = { distribution: 'uniform', extent: [0, 16] };
  // The structure is placed by its corner; the ground is measured at its middle.
  const surface = (chance) => ({
    iterations: 1, scatter_chance: { numerator: 1, denominator: chance }, coordinate_eval_order: 'xzy',
    x: square, z: square, y: `q.heightmap(v.worldx + ${v.radius}, v.worldz + ${v.radius}) - ${v.skirt}`,
  });
  const rules = {
    land: { feature: 'volcano_feature', biomes: [{ all_of: [tag('overworld'), tag('ocean', '!='), tag('river', '!='), tag('beach', '!='), tag('mountains', '!=')] }], distribution: surface(v.worldgen.land) },
    mountains: { feature: 'volcano_feature', biomes: [{ all_of: [tag('overworld'), { any_of: [tag('mountains'), tag('extreme_hills')] }] }], distribution: surface(v.worldgen.mountains) },
    basalt_deltas: {
      feature: 'volcano_nether_snap_feature', biomes: [tag('basalt_deltas')],
      distribution: { iterations: 1, scatter_chance: { numerator: 1, denominator: v.worldgen.basalt_deltas }, x: square, z: square, y: { distribution: 'uniform', extent: [36, 90] } },
    },
  };
  for (const [name, r] of Object.entries(rules)) {
    await write(join(BP, 'feature_rules', `volcano_${name}.json`), {
      format_version: '1.21.40',
      'minecraft:feature_rules': {
        description: { identifier: `${NS}:volcano_${name}`, places_feature: `${NS}:${r.feature}` },
        conditions: { placement_pass: 'surface_pass', 'minecraft:biome_filter': r.biomes },
        distribution: r.distribution,
      },
    });
  }
}

export async function build({ quiet = false } = {}) {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  await rm(BP, { recursive: true, force: true });
  await rm(RP, { recursive: true, force: true });

  // Hand-written files first; generated files may add to the same folders.
  await cp(join(ROOT, 'src', 'packs', 'behavior_pack'), BP, { recursive: true });
  await cp(join(ROOT, 'src', 'packs', 'resource_pack'), RP, { recursive: true });

  const { bp, rp } = manifests(pkg.version);
  await write(join(BP, 'manifest.json'), bp);
  await write(join(RP, 'manifest.json'), rp);
  const icon = packIcon();
  await write(join(BP, 'pack_icon.png'), icon);
  await write(join(RP, 'pack_icon.png'), icon);

  // Creatures
  const creatures = buildCreatureArt();
  const sounds = {};
  for (const { creature: c, geo, texture, animations } of Object.values(creatures)) {
    await write(join(BP, 'entities', `${c.id}.json`), buildCreature(c));
    await write(join(BP, 'spawn_rules', `${c.id}.json`), buildSpawnRules(c));
    await write(join(BP, 'loot_tables', 'entities', `${NS}_${c.id}.json`), buildLoot(c));
    await write(join(RP, 'models', 'entity', `${c.id}.geo.json`), geo.geometry);
    await write(join(RP, 'textures', 'entity', NS, `${c.id}.png`), texture);
    await write(join(RP, 'animations', `${c.id}.animation.json`), animations);
    await write(join(RP, 'animation_controllers', `${c.id}.animation_controllers.json`), buildAnimationControllers(c));
    await write(join(RP, 'entity', `${c.id}.entity.json`), buildClientEntity(c));
    await write(join(RP, 'render_controllers', `${c.id}.render_controllers.json`), buildRenderController(c.id));
    sounds[`${NS}:${c.id}`] = buildEntitySounds(c);
  }
  await write(join(RP, 'sounds.json'), { entity_sounds: { entities: sounds } });

  // The lava cannon
  const cannonArt = buildCannonArt();
  await write(join(BP, 'entities', `${cannon.id}.json`), buildCannon(cannon));
  await write(join(BP, 'loot_tables', 'entities', `${NS}_${cannon.id}.json`), buildLoot({ loot: [{ item: `${NS}:${cannon.id}`, min: 1, max: 1 }] }));
  await write(join(RP, 'models', 'entity', `${cannon.id}.geo.json`), cannonArt.geo.geometry);
  await write(join(RP, 'textures', 'entity', NS, `${cannon.id}.png`), cannonArt.texture);
  await write(join(RP, 'animations', `${cannon.id}.animation.json`), cannonArt.animations);
  await write(join(RP, 'entity', `${cannon.id}.entity.json`), buildCannonClient(cannon));
  await write(join(RP, 'render_controllers', `${cannon.id}.render_controllers.json`), buildRenderController(cannon.id));

  // Projectiles: the shots and the thrown grenade.
  for (const [i, p] of PROJECTILES.entries()) {
    const geo = buildGeometry(`geometry.${NS}.${p.id}`, projectileModel(p));
    const texture = p.material === 'lava' ? lavaBallTexture(geo.width, geo.height, i + 1)
      : p.material === 'obsidian' ? obsidianBallTexture(geo.width, geo.height, i + 1)
      : paintTexture(geo, { grenade: { base: '#4a2216' } });
    await write(join(BP, 'entities', `${p.id}.json`), buildProjectile(p));
    await write(join(RP, 'models', 'entity', `${p.id}.geo.json`), geo.geometry);
    await write(join(RP, 'textures', 'entity', NS, `${p.id}.png`), texture);
    await write(join(RP, 'entity', `${p.id}.entity.json`), buildProjectileClient(p));
    await write(join(RP, 'render_controllers', `${p.id}.render_controllers.json`), buildRenderController(p.id));
  }

  // Items, and the armour as worn
  const itemTextures = {};
  for (const item of ITEMS) {
    await write(join(BP, 'items', `${item.id}.json`), buildItem(item));
    await write(join(RP, 'textures', 'items', NS, `${item.id}.png`), item.icon);
    itemTextures[`${NS}_${item.id}`] = { textures: `textures/items/${NS}/${item.id}` };
    if (item.piece) await write(join(RP, 'attachables', `${item.id}.json`), attachable(item));
  }
  await write(join(RP, 'textures', 'item_texture.json'), { resource_pack_name: NS, texture_name: 'atlas.items', texture_data: itemTextures });
  const armor = { 1: armorLayer(1), 2: armorLayer(2) };
  for (const [layer, png] of Object.entries(armor)) await write(join(RP, 'textures', 'models', NS, `magmasteel_${layer}.png`), png);

  // Blocks
  const terrain = {};
  const flipbooks = [];
  const blockTextureFiles = {};
  for (const block of BLOCKS) {
    await write(join(BP, 'blocks', `${block.id}.json`), bedrockBlock(block));
    for (const [name, png] of Object.entries(blockTextures(block))) {
      await write(join(RP, 'textures', 'blocks', NS, `${name}.png`), png);
      terrain[`${NS}_${name}`] = { textures: `textures/blocks/${NS}/${name}` };
      blockTextureFiles[name] = png;
      if (block.frames) flipbooks.push({ flipbook_texture: `textures/blocks/${NS}/${name}`, atlas_tile: `${NS}_${name}`, ticks_per_frame: 3, blend_frames: true });
    }
  }
  await write(join(RP, 'textures', 'terrain_texture.json'), { resource_pack_name: NS, texture_name: 'atlas.terrain', padding: 8, num_mip_levels: 4, texture_data: terrain });
  await write(join(RP, 'textures', 'flipbook_textures.json'), flipbooks);
  await write(join(RP, 'blocks.json'), { format_version: '1.21.40', ...Object.fromEntries(BLOCKS.map((b) => [`${NS}:${b.id}`, { sound: b.sound }])) });

  await buildVolcanoes();

  const recipes = [...RECIPES, ...BLOCK_RECIPES];
  for (const recipe of recipes) {
    const body = Object.values(recipe)[0];
    await write(join(BP, 'recipes', `${body.description.identifier.split(':')[1]}.json`), { format_version: '1.12', ...recipe });
  }

  // Data for the scripts, and the temporary-block rules they share with the tests.
  await write(join(BP, 'scripts', 'data.js'), [
    '// Generated by tools/build.mjs',
    `export const RULES = ${JSON.stringify(RULES)};`,
    `export const ITEMS = ${JSON.stringify(ITEMS.map((i) => `${NS}:${i.id}`))};`,
    `export const BLOCKS = ${JSON.stringify(BLOCKS.map((b) => `${NS}:${b.id}`))};`,
    `export const CREATURES = ${JSON.stringify(CREATURES.map((c) => `${NS}:${c.id}`))};`,
    `export const PROJECTILES = ${JSON.stringify(PROJECTILES.map((p) => `${NS}:${p.id}`))};`,
    '',
  ].join('\n'));
  await copyFile(join(ROOT, 'src', 'lib', 'temp.mjs'), join(BP, 'scripts', 'temp.js'));

  // Language
  const langs = {};
  for (const locale of LOCALES) {
    const entries = langEntries(locale, { items: ITEMS, blocks: BLOCKS, creatures: CREATURES, projectiles: PROJECTILES, version: pkg.version });
    langs[locale] = entries;
    const text = entries.map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    for (const pack of [BP, RP]) await write(join(pack, 'texts', `${locale}.lang`), text);
  }
  for (const pack of [BP, RP]) await write(join(pack, 'texts', 'languages.json'), LOCALES);

  await buildJava({
    creatures, cannon: cannonArt, items: ITEMS, blocks: BLOCKS, blockTextures: blockTextureFiles, recipes, langs, icon, armor, rules: RULES,
    OUT: join(ROOT, 'java', 'src', 'generated', 'resources'),
  });

  if (!quiet) {
    console.log(`Built ${PACK_NAME} ${pkg.version}: ${CREATURES.length} creatures, ${PROJECTILES.length} projectiles, ${ITEMS.length} items, ${BLOCKS.length} blocks, ${recipes.length} recipes; Java resources in java/src/generated/resources`);
  }
  return { creatures, cannon: cannonArt, items: ITEMS, blocks: BLOCKS, version: pkg.version };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
