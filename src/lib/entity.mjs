// Creature and projectile specs -> Bedrock files: behaviour entity, spawn rules,
// loot table, client entity, render controller, animation controllers, sounds.
import { NS } from './constants.mjs';

/** Prefix vanilla items with minecraft: and keep our own. */
export const itemId = (name) => (name.includes(':') ? name : `minecraft:${name}`);
const fam = (value) => ({ test: 'is_family', subject: 'other', value });

// ---------------------------------------------------------------- creatures

export function buildCreature(c) {
  const neutral = !!c.attack;
  const components = {
    'minecraft:type_family': { family: neutral ? [c.id, NS, 'monster', 'mob'] : [c.id, NS, 'mob'] },
    'minecraft:collision_box': { width: c.size[0], height: c.size[1] },
    'minecraft:health': { value: c.health, max: c.health },
    'minecraft:movement': { value: c.speed },
    'minecraft:fire_immune': {},
    'minecraft:is_hidden_when_invisible': {},
    'minecraft:experience_reward': { on_death: `query.last_hit_by_player ? ${c.xp} : 0` },
    'minecraft:loot': { table: `loot_tables/entities/${NS}_${c.id}.json` },
    'minecraft:nameable': {},
    'minecraft:physics': {},
    'minecraft:jump.static': {},
    'minecraft:movement.basic': {},
    'minecraft:navigation.walk': { can_path_over_lava: true, can_walk_in_lava: true, avoid_water: true, avoid_damage_blocks: false },
    'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
    'minecraft:pushable': { is_pushable: true, is_pushable_by_piston: true },
    'minecraft:despawn': { despawn_from_distance: {} },
    'minecraft:conditional_bandwidth_optimization': {},
    // Water hurts them, like it hurts a blaze.
    'minecraft:hurt_on_condition': {
      damage_conditions: [{ filters: { test: 'in_water', subject: 'self' }, cause: 'drowning', damage_per_tick: 1 }],
    },
    'minecraft:ambient_sound_interval': { event_name: 'ambient', range: 16, value: 8 },
    'minecraft:behavior.float': { priority: 0 },
    'minecraft:behavior.random_stroll': { priority: 8, speed_multiplier: 0.9 },
    'minecraft:behavior.look_at_player': { priority: 9, look_distance: 8, probability: 0.02 },
    'minecraft:behavior.random_look_around': { priority: 10 },
  };
  if (neutral) {
    Object.assign(components, {
      'minecraft:attack': { damage: c.attack },
      'minecraft:knockback_resistance': { value: c.knockbackResistance ?? 0 },
      'minecraft:follow_range': { value: c.followRange ?? 16, max: c.followRange ?? 16 },
      // Neutral: fights back (with its friends) when hurt, never starts a fight.
      'minecraft:behavior.hurt_by_target': { priority: 1, alert_same_type: true },
      'minecraft:behavior.melee_box_attack': { priority: 3, speed_multiplier: 1.2, track_target: true, cooldown_time: 1.5 },
    });
  }
  if (c.milk) {
    components['minecraft:interact'] = {
      interactions: [{
        on_interact: { filters: { all_of: [fam('player'), { test: 'has_equipment', subject: 'other', domain: 'hand', value: 'bucket:0' }] } },
        use_item: true,
        transform_to_item: 'lava_bucket:0',
        play_sounds: 'bucket.fill_lava',
        interact_text: `action.interact.${NS}.fill_bucket`,
        cooldown: c.milk.cooldown,
      }],
    };
  }
  return {
    format_version: '1.21.90',
    'minecraft:entity': {
      description: { identifier: `${NS}:${c.id}`, spawn_category: neutral ? 'monster' : 'creature', is_spawnable: true, is_summonable: true },
      components,
    },
  };
}

export function buildSpawnRules(c) {
  const biomes = c.spawn.biomes.map((b) => ({ test: 'has_biome_tag', operator: '==', value: b }));
  return {
    format_version: '1.8.0',
    'minecraft:spawn_rules': {
      description: { identifier: `${NS}:${c.id}`, population_control: c.attack ? 'monster' : 'animal' },
      conditions: [{
        'minecraft:spawns_on_surface': {},
        'minecraft:spawns_underground': {},
        'minecraft:weight': { default: c.spawn.weight },
        'minecraft:herd': { min_size: c.spawn.group[0], max_size: c.spawn.group[1] },
        'minecraft:density_limit': { surface: 2, underground: 2 },
        'minecraft:biome_filter': biomes.length === 1 ? biomes[0] : { any_of: biomes },
      }],
    },
  };
}

export function buildLoot(c) {
  return {
    pools: c.loot.map((l) => ({
      rolls: 1,
      entries: [{
        type: 'item', name: itemId(l.item), weight: 1,
        functions: [{ function: 'set_count', count: { min: l.min, max: l.max } }, { function: 'looting_enchant', count: { min: 0, max: 1 } }],
      }],
    })),
  };
}

const anim = (c, name) => `animation.${NS}.${c.id}.${name}`;

export function buildAnimationControllers(c) {
  const names = Object.keys(c.anims);
  const controllers = {
    [`controller.animation.${NS}.${c.id}.move`]: {
      initial_state: 'default',
      states: {
        default: { animations: ['idle'], transitions: [{ walking: 'query.ground_speed > 0.3' }], blend_transition: 0.2 },
        walking: { animations: ['walk'], transitions: [{ default: 'query.ground_speed <= 0.3' }], blend_transition: 0.2 },
      },
    },
  };
  if (names.includes('attack')) {
    controllers[`controller.animation.${NS}.${c.id}.attack`] = {
      initial_state: 'default',
      states: {
        default: { transitions: [{ attacking: 'variable.attack_time > 0' }] },
        attacking: { animations: ['attack'], transitions: [{ default: 'query.all_animations_finished' }] },
      },
    };
  }
  return { format_version: '1.10.0', animation_controllers: controllers };
}

export function buildClientEntity(c) {
  const animations = Object.fromEntries(Object.keys(c.anims).map((n) => [n, anim(c, n)]));
  const animate = ['move_controller'];
  animations.move_controller = `controller.animation.${NS}.${c.id}.move`;
  if (c.anims.attack) {
    animations.attack_controller = `controller.animation.${NS}.${c.id}.attack`;
    animate.push('attack_controller');
  }
  animations.look_at_target = `animation.${NS}.common.look_at_target`;
  animate.push('look_at_target');
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: `${NS}:${c.id}`,
        materials: { default: 'entity_emissive_alpha' },
        textures: { default: `textures/entity/${NS}/${c.id}` },
        geometry: { default: `geometry.${NS}.${c.id}` },
        animations,
        scripts: { animate },
        render_controllers: [`controller.render.${NS}.${c.id}`],
        spawn_egg: { base_color: c.egg[0], overlay_color: c.egg[1] },
      },
    },
  };
}

export function buildRenderController(id) {
  return {
    format_version: '1.8.0',
    render_controllers: {
      [`controller.render.${NS}.${id}`]: {
        geometry: 'Geometry.default',
        materials: [{ '*': 'Material.default' }],
        textures: ['Texture.default'],
      },
    },
  };
}

export function buildEntitySounds(c) {
  const s = c.sounds;
  return { volume: 1.0, pitch: s.pitch, events: { ambient: s.ambient, hurt: s.hurt, death: s.death, step: s.step } };
}

// ---------------------------------------------------------------- projectiles

/**
 * Lava shots and the thrown grenade. The projectile only flies and disappears on a
 * hit: the damage, the fire, the lava and the obsidian are done by scripts/guns.js,
 * which hears the hit.
 */
export const PROJECTILES = [
  { id: 'lava_bolt', size: [2, 2, 4], gravity: 0.01, power: 3.2, material: 'lava' },
  { id: 'lava_blob', size: [4, 4, 4], gravity: 0.05, power: 1.6, material: 'lava' },
  { id: 'magma_grenade', size: [3, 3, 3], gravity: 0.05, power: 1.0, material: 'grenade' },
];

export function projectileModel(p) {
  const [w, h, d] = p.size;
  return { bones: [{ name: 'root', pivot: [0, 0, 0], cubes: [{ origin: [-w / 2, 0, -d / 2], size: p.size, mat: p.material }] }] };
}

export function buildProjectile(p) {
  return {
    format_version: '1.21.90',
    'minecraft:entity': {
      description: { identifier: `${NS}:${p.id}`, is_spawnable: false, is_summonable: true },
      components: {
        'minecraft:collision_box': { width: 0.25, height: 0.25 },
        'minecraft:projectile': {
          on_hit: { remove_on_hit: {} },
          power: p.power,
          gravity: p.gravity,
          uncertainty_base: 1,
          uncertainty_multiplier: 0,
          anchor: 1,
          offset: [0, -0.1, 0],
          hit_sound: 'random.fizz',
        },
        'minecraft:fire_immune': {},
        'minecraft:physics': {},
        'minecraft:pushable': { is_pushable: false, is_pushable_by_piston: true },
        'minecraft:despawn': { despawn_from_distance: { min_distance: 32, max_distance: 64 } },
      },
    },
  };
}

export function buildProjectileClient(p) {
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: `${NS}:${p.id}`,
        materials: { default: 'entity_emissive_alpha' },
        textures: { default: `textures/entity/${NS}/${p.id}` },
        geometry: { default: `geometry.${NS}.${p.id}` },
        animations: { spin: `animation.${NS}.common.spin` },
        scripts: { animate: ['spin'] },
        render_controllers: [`controller.render.${NS}.${p.id}`],
      },
    },
  };
}
