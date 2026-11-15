package dk.ulfen.lavagun;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;

import dk.ulfen.lavagun.block.LavaTankBlock;
import dk.ulfen.lavagun.block.VolcanoVentBlock;
import dk.ulfen.lavagun.entity.LavaCannon;
import dk.ulfen.lavagun.entity.LavaCreature;
import dk.ulfen.lavagun.entity.LavaShot;
import dk.ulfen.lavagun.entity.LavaSlug;
import dk.ulfen.lavagun.entity.MagmaGolem;
import dk.ulfen.lavagun.entity.MagmaGrenade;
import dk.ulfen.lavagun.item.LavaCannonItem;
import dk.ulfen.lavagun.item.LavaGunItem;
import dk.ulfen.lavagun.item.MagmaGrenadeItem;
import dk.ulfen.lavagun.item.MagmaSprayerItem;
import dk.ulfen.lavagun.item.MagmasteelSwordItem;
import dk.ulfen.lavagun.world.VolcanoFeature;
import net.fabricmc.fabric.api.biome.v1.BiomeModifications;
import net.fabricmc.fabric.api.biome.v1.BiomeSelectionContext;
import net.fabricmc.fabric.api.biome.v1.BiomeSelectors;
import net.fabricmc.fabric.api.creativetab.v1.FabricCreativeModeTab;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.tags.BiomeTags;
import net.minecraft.tags.BlockTags;
import net.minecraft.tags.TagKey;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.entity.SpawnPlacementTypes;
import net.minecraft.world.entity.SpawnPlacements;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.SpawnEggItem;
import net.minecraft.world.item.ToolMaterial;
import net.minecraft.world.item.equipment.ArmorMaterial;
import net.minecraft.world.item.equipment.ArmorType;
import net.minecraft.world.item.equipment.EquipmentAsset;
import net.minecraft.world.item.equipment.EquipmentAssets;
import net.minecraft.world.level.biome.Biomes;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.levelgen.GenerationStep;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.material.MapColor;

/** Everything the mod adds to the game registries. */
public final class LavaRegistry {
	public static EntityType<LavaShot> LAVA_BOLT;
	public static EntityType<LavaShot> LAVA_BLOB;
	public static EntityType<LavaShot> OBSIDIAN_BLOB;
	public static EntityType<LavaShot> LAVA_BALL;
	public static EntityType<LavaShot> VOLCANO_BOMB;
	public static EntityType<LavaCannon> LAVA_CANNON;
	public static EntityType<MagmaGrenade> MAGMA_GRENADE_ENTITY;
	public static EntityType<MagmaGolem> MAGMA_GOLEM;
	public static EntityType<LavaSlug> LAVA_SLUG;

	public static Item LAVA_PISTOL, LAVA_GUN, OBSIDIAN_GUN, LAVA_CANNON_ITEM, MAGMA_SPRAYER, MAGMA_GRENADE, LAVA_CELL, MAGMA_CHARGE, MAGMASTEEL_INGOT, MAGMA_CORE;
	public static Item MAGMASTEEL_SWORD, MAGMASTEEL_PICKAXE, MAGMASTEEL_AXE, MAGMASTEEL_SHOVEL;
	public static Item MAGMASTEEL_HELMET, MAGMASTEEL_CHESTPLATE, MAGMASTEEL_LEGGINGS, MAGMASTEEL_BOOTS;
	public static Item MAGMA_GOLEM_SPAWN_EGG, LAVA_SLUG_SPAWN_EGG;
	public static LavaTankBlock LAVA_TANK;
	public static VolcanoVentBlock VOLCANO_VENT;
	/** Every block and its item, in creative-tab order. */
	public static final List<Item> BLOCK_ITEMS = new ArrayList<>();

	private static final TagKey<Item> REPAIRS_MAGMASTEEL = TagKey.create(Registries.ITEM, id("repairs_magmasteel"));
	/** A little better than diamond (src/items.mjs MAGMASTEEL). */
	private static final ToolMaterial MAGMASTEEL = new ToolMaterial(BlockTags.INCORRECT_FOR_DIAMOND_TOOL, 1200, 9.0F, 3.0F, 14, REPAIRS_MAGMASTEEL);
	private static final ResourceKey<EquipmentAsset> MAGMASTEEL_ASSET = ResourceKey.create(EquipmentAssets.ROOT_ID, id("magmasteel"));
	private static final ArmorMaterial MAGMASTEEL_ARMOR = new ArmorMaterial(37,
		Map.of(ArmorType.HELMET, 3, ArmorType.CHESTPLATE, 8, ArmorType.LEGGINGS, 6, ArmorType.BOOTS, 3), 14,
		SoundEvents.ARMOR_EQUIP_NETHERITE, 2.0F, 0.0F, REPAIRS_MAGMASTEEL, MAGMASTEEL_ASSET);

	private LavaRegistry() {}

	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(LavaGuns.MOD_ID, path);
	}

	static void register() {
		LAVA_BOLT = entity("lava_bolt", EntityType.Builder.<LavaShot>of(LavaShot::new, MobCategory.MISC).noLootTable().fireImmune().sized(0.25F, 0.25F).clientTrackingRange(4).updateInterval(10));
		LAVA_BLOB = entity("lava_blob", EntityType.Builder.<LavaShot>of(LavaShot::new, MobCategory.MISC).noLootTable().fireImmune().sized(0.35F, 0.35F).clientTrackingRange(4).updateInterval(10));
		OBSIDIAN_BLOB = entity("obsidian_blob", EntityType.Builder.<LavaShot>of(LavaShot::new, MobCategory.MISC).noLootTable().fireImmune().sized(0.35F, 0.35F).clientTrackingRange(4).updateInterval(10));
		LAVA_BALL = entity("lava_ball", EntityType.Builder.<LavaShot>of(LavaShot::new, MobCategory.MISC).noLootTable().fireImmune().sized(0.4F, 0.4F).clientTrackingRange(8).updateInterval(5));
		VOLCANO_BOMB = entity("volcano_bomb", EntityType.Builder.<LavaShot>of(LavaShot::new, MobCategory.MISC).noLootTable().fireImmune().sized(0.5F, 0.5F).clientTrackingRange(10).updateInterval(5));
		LAVA_CANNON = entity(LavaData.rules().cannon().id(), EntityType.Builder.of(LavaCannon::new, MobCategory.MISC).fireImmune().sized(1.4F, 1.4F).clientTrackingRange(10));
		FabricDefaultAttributeRegistry.register(LAVA_CANNON, LavaCannon.createAttributes());
		MAGMA_GRENADE_ENTITY = entity("magma_grenade", EntityType.Builder.<MagmaGrenade>of(MagmaGrenade::new, MobCategory.MISC).noLootTable().fireImmune().sized(0.25F, 0.25F).clientTrackingRange(4).updateInterval(10));
		MAGMA_GOLEM = creature(MagmaGolem.ID, MagmaGolem::new, MobCategory.MONSTER);
		LAVA_SLUG = creature(LavaSlug.ID, LavaSlug::new, MobCategory.CREATURE);

		LAVA_PISTOL = item("lava_pistol", p -> new LavaGunItem(p, "lava_pistol"), new Item.Properties().durability(400).repairable(REPAIRS_MAGMASTEEL));
		LAVA_GUN = item("lava_gun", p -> new LavaGunItem(p, "lava_gun"), new Item.Properties().durability(300).repairable(REPAIRS_MAGMASTEEL));
		OBSIDIAN_GUN = item("obsidian_gun", p -> new LavaGunItem(p, "obsidian_gun"), new Item.Properties().durability(300).repairable(REPAIRS_MAGMASTEEL));
		LAVA_CANNON_ITEM = item(LavaData.rules().cannon().id(), LavaCannonItem::new, new Item.Properties().stacksTo(1));
		MAGMA_SPRAYER = item("magma_sprayer", MagmaSprayerItem::new, new Item.Properties().durability(500).repairable(REPAIRS_MAGMASTEEL));
		MAGMA_GRENADE = item("magma_grenade", MagmaGrenadeItem::new, new Item.Properties().stacksTo(16));
		LAVA_CELL = item("lava_cell", Item::new, new Item.Properties());
		MAGMA_CHARGE = item("magma_charge", Item::new, new Item.Properties());
		MAGMASTEEL_INGOT = item("magmasteel_ingot", Item::new, new Item.Properties().fireResistant());
		MAGMA_CORE = item("magma_core", Item::new, new Item.Properties().fireResistant());

		MAGMASTEEL_SWORD = item("magmasteel_sword", MagmasteelSwordItem::new, new Item.Properties().sword(MAGMASTEEL, 3.0F, -2.4F).fireResistant());
		MAGMASTEEL_PICKAXE = item("magmasteel_pickaxe", Item::new, new Item.Properties().pickaxe(MAGMASTEEL, 1.0F, -2.8F).fireResistant());
		MAGMASTEEL_AXE = item("magmasteel_axe", Item::new, new Item.Properties().axe(MAGMASTEEL, 5.0F, -3.0F).fireResistant());
		MAGMASTEEL_SHOVEL = item("magmasteel_shovel", Item::new, new Item.Properties().shovel(MAGMASTEEL, 1.5F, -3.0F).fireResistant());
		MAGMASTEEL_HELMET = item("magmasteel_helmet", Item::new, new Item.Properties().humanoidArmor(MAGMASTEEL_ARMOR, ArmorType.HELMET).fireResistant());
		MAGMASTEEL_CHESTPLATE = item("magmasteel_chestplate", Item::new, new Item.Properties().humanoidArmor(MAGMASTEEL_ARMOR, ArmorType.CHESTPLATE).fireResistant());
		MAGMASTEEL_LEGGINGS = item("magmasteel_leggings", Item::new, new Item.Properties().humanoidArmor(MAGMASTEEL_ARMOR, ArmorType.LEGGINGS).fireResistant());
		MAGMASTEEL_BOOTS = item("magmasteel_boots", Item::new, new Item.Properties().humanoidArmor(MAGMASTEEL_ARMOR, ArmorType.BOOTS).fireResistant());

		MAGMA_GOLEM_SPAWN_EGG = item("magma_golem_spawn_egg", SpawnEggItem::new, new Item.Properties().spawnEgg(MAGMA_GOLEM));
		LAVA_SLUG_SPAWN_EGG = item("lava_slug_spawn_egg", SpawnEggItem::new, new Item.Properties().spawnEgg(LAVA_SLUG));

		var stone = BlockBehaviour.Properties.of().mapColor(MapColor.NETHER).strength(2.0F, 6.0F).sound(SoundType.NETHER_BRICKS).requiresCorrectToolForDrops();
		block("magma_bricks", Block::new, stone.lightLevel(s -> 3));
		block("polished_magma", Block::new, stone.lightLevel(s -> 1));
		block("chiseled_magma", Block::new, stone.lightLevel(s -> 6));
		block("magmasteel_block", Block::new, BlockBehaviour.Properties.of().mapColor(MapColor.COLOR_RED).strength(5.0F, 6.0F).sound(SoundType.METAL).requiresCorrectToolForDrops().lightLevel(s -> 4));
		for (String colour : List.of("orange", "red", "purple", "green")) {
			block("lava_lamp_" + colour, Block::new, BlockBehaviour.Properties.of().mapColor(MapColor.COLOR_ORANGE).strength(0.5F).sound(SoundType.GLASS).lightLevel(s -> 15));
		}
		LAVA_TANK = block("lava_tank", LavaTankBlock::new, BlockBehaviour.Properties.of().mapColor(MapColor.METAL).strength(3.0F, 6.0F).sound(SoundType.METAL).requiresCorrectToolForDrops().noOcclusion());

		VOLCANO_VENT = block(LavaData.rules().volcano().id(), VolcanoVentBlock::new, BlockBehaviour.Properties.of().mapColor(MapColor.COLOR_ORANGE).strength(50.0F, 1200.0F).sound(SoundType.BASALT).requiresCorrectToolForDrops().lightLevel(s -> 15));
		volcanoes();

		CreativeModeTab tab = FabricCreativeModeTab.builder()
			.title(Component.translatable("itemGroup.lavagun"))
			.icon(() -> new ItemStack(LAVA_GUN))
			.displayItems((params, out) -> {
				for (Item i : new Item[] {LAVA_PISTOL, LAVA_GUN, OBSIDIAN_GUN, LAVA_CANNON_ITEM, MAGMA_SPRAYER, MAGMA_GRENADE, LAVA_CELL, MAGMA_CHARGE, MAGMASTEEL_INGOT, MAGMA_CORE,
					MAGMASTEEL_SWORD, MAGMASTEEL_PICKAXE, MAGMASTEEL_AXE, MAGMASTEEL_SHOVEL,
					MAGMASTEEL_HELMET, MAGMASTEEL_CHESTPLATE, MAGMASTEEL_LEGGINGS, MAGMASTEEL_BOOTS}) out.accept(i);
				BLOCK_ITEMS.forEach(out::accept);
				out.accept(MAGMA_GOLEM_SPAWN_EGG);
				out.accept(LAVA_SLUG_SPAWN_EGG);
			})
			.build();
		Registry.register(BuiltInRegistries.CREATIVE_MODE_TAB, id("lava_guns"), tab);
	}

	private static <T extends net.minecraft.world.entity.Entity> EntityType<T> entity(String name, EntityType.Builder<T> builder) {
		ResourceKey<EntityType<?>> key = ResourceKey.create(Registries.ENTITY_TYPE, id(name));
		return Registry.register(BuiltInRegistries.ENTITY_TYPE, key, builder.build(key));
	}

	private static <T extends LavaCreature> EntityType<T> creature(String name, EntityType.EntityFactory<T> factory, MobCategory category) {
		LavaData.Creature c = LavaData.creature(name);
		EntityType<T> type = entity(name, EntityType.Builder.of(factory, category).fireImmune().sized(c.width(), c.height()).clientTrackingRange(8));
		FabricDefaultAttributeRegistry.register(type, LavaCreature.createAttributes(name));
		SpawnPlacements.register(type, SpawnPlacementTypes.ON_GROUND, Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, LavaCreature::checkSpawn);
		Predicate<BiomeSelectionContext> biomes = c.spawn().biomes().stream().map(LavaRegistry::biome).reduce(Predicate::or).orElse(ctx -> false);
		BiomeModifications.addSpawn(biomes, category, type, c.spawn().weight(), c.spawn().min(), c.spawn().max());
		return type;
	}

	private static <T extends Item> T item(String name, Function<Item.Properties, T> factory, Item.Properties props) {
		ResourceKey<Item> key = ResourceKey.create(Registries.ITEM, id(name));
		return Registry.register(BuiltInRegistries.ITEM, key, factory.apply(props.setId(key)));
	}

	private static <T extends Block> T block(String name, Function<BlockBehaviour.Properties, T> factory, BlockBehaviour.Properties props) {
		ResourceKey<Block> key = ResourceKey.create(Registries.BLOCK, id(name));
		T block = Registry.register(BuiltInRegistries.BLOCK, key, factory.apply(props.setId(key)));
		BLOCK_ITEMS.add(item(name, p -> new BlockItem(block, p), new Item.Properties().useBlockDescriptionPrefix()));
		return block;
	}

	/** Volcanoes generate with new land: rarely anywhere on land, more often in the mountains and the basalt deltas. */
	private static void volcanoes() {
		Registry.register(BuiltInRegistries.FEATURE_TYPE, id("volcano"), VolcanoFeature.CODEC);
		Predicate<BiomeSelectionContext> land = BiomeSelectors.foundInOverworld()
			.and(BiomeSelectors.tag(BiomeTags.IS_OCEAN).negate()).and(BiomeSelectors.tag(BiomeTags.IS_RIVER).negate())
			.and(BiomeSelectors.tag(BiomeTags.IS_BEACH).negate()).and(BiomeSelectors.tag(BiomeTags.IS_MOUNTAIN).negate());
		placeVolcanoes("volcano_land", land);
		placeVolcanoes("volcano_mountains", BiomeSelectors.tag(BiomeTags.IS_MOUNTAIN));
		placeVolcanoes("volcano_basalt_deltas", BiomeSelectors.includeByKey(Biomes.BASALT_DELTAS));
	}

	private static void placeVolcanoes(String name, Predicate<BiomeSelectionContext> biomes) {
		BiomeModifications.addFeature(biomes, GenerationStep.Decoration.SURFACE_STRUCTURES, ResourceKey.create(Registries.PLACED_FEATURE, id(name)));
	}

	/** Biome names used in the shared spec -> biome selectors. */
	private static Predicate<BiomeSelectionContext> biome(String name) {
		return switch (name) {
			case "basalt_deltas" -> BiomeSelectors.includeByKey(Biomes.BASALT_DELTAS);
			case "nether_wastes" -> BiomeSelectors.includeByKey(Biomes.NETHER_WASTES);
			default -> throw new IllegalArgumentException("Unknown biome " + name);
		};
	}
}
