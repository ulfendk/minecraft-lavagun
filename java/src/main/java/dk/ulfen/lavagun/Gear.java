package dk.ulfen.lavagun;

import java.util.HashMap;
import java.util.Map;

import dk.ulfen.lavagun.world.TemporaryBlocks;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;

/**
 * Magmasteel: the pickaxe melts ore as it mines, the full suit of armour keeps out
 * fire, and the boots harden lava underfoot. (The sword is MagmasteelSwordItem.)
 */
public final class Gear {
	/** Same table as SMELT in src/lib/temp.mjs. */
	private static final Map<Block, Item> SMELT = new HashMap<>();

	static {
		SMELT.put(Blocks.IRON_ORE, Items.IRON_INGOT);
		SMELT.put(Blocks.DEEPSLATE_IRON_ORE, Items.IRON_INGOT);
		SMELT.put(Blocks.GOLD_ORE, Items.GOLD_INGOT);
		SMELT.put(Blocks.DEEPSLATE_GOLD_ORE, Items.GOLD_INGOT);
		SMELT.put(Blocks.NETHER_GOLD_ORE, Items.GOLD_INGOT);
		SMELT.put(Blocks.COPPER_ORE, Items.COPPER_INGOT);
		SMELT.put(Blocks.DEEPSLATE_COPPER_ORE, Items.COPPER_INGOT);
		SMELT.put(Blocks.RAW_IRON_BLOCK, Items.IRON_BLOCK);
		SMELT.put(Blocks.RAW_GOLD_BLOCK, Items.GOLD_BLOCK);
		SMELT.put(Blocks.RAW_COPPER_BLOCK, BuiltInRegistries.ITEM.getValue(Identifier.withDefaultNamespace("copper_block")));
		SMELT.put(Blocks.SAND, Items.GLASS);
		SMELT.put(Blocks.COBBLESTONE, Items.STONE);
		SMELT.put(Blocks.ANCIENT_DEBRIS, Items.NETHERITE_SCRAP);
	}

	private Gear() {}

	public static Item smelted(Block block) {
		return SMELT.get(block);
	}

	/** Copper ore gives 2–5 raw copper, so 2–5 ingots; everything else one. */
	private static int count(Block block, ServerLevel level) {
		return block == Blocks.COPPER_ORE || block == Blocks.DEEPSLATE_COPPER_ORE ? 2 + level.getRandom().nextInt(4) : 1;
	}

	private static boolean mine(ServerLevel level, ServerPlayer player, BlockPos pos, BlockState state) {
		ItemStack tool = player.getMainHandItem();
		Item result = SMELT.get(state.getBlock());
		if (!tool.is(LavaRegistry.MAGMASTEEL_PICKAXE) || result == null || player.gameMode.isCreative()) return true;
		level.removeBlock(pos, false);
		Block.popResource(level, pos, new ItemStack(result, count(state.getBlock(), level)));
		level.sendParticles(ParticleTypes.LAVA, pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5, 3, 0.2, 0.2, 0.2, 0);
		level.playSound(null, pos, SoundEvents.LAVA_EXTINGUISH, SoundSource.BLOCKS, 0.5F, 1.4F);
		tool.hurtAndBreak(1, player, EquipmentSlot.MAINHAND);
		return false;
	}

	private static boolean wears(ServerPlayer p, EquipmentSlot slot, Item item) {
		return p.getItemBySlot(slot).is(item);
	}

	private static boolean isLavaSource(BlockState state) {
		return state.is(Blocks.LAVA) && state.getFluidState().isSource();
	}

	private static void tick(ServerLevel level) {
		long now = level.getGameTime();
		for (ServerPlayer p : level.players()) {
			if (now % 20 == 0 && wears(p, EquipmentSlot.HEAD, LavaRegistry.MAGMASTEEL_HELMET) && wears(p, EquipmentSlot.CHEST, LavaRegistry.MAGMASTEEL_CHESTPLATE)
				&& wears(p, EquipmentSlot.LEGS, LavaRegistry.MAGMASTEEL_LEGGINGS) && wears(p, EquipmentSlot.FEET, LavaRegistry.MAGMASTEEL_BOOTS)) {
				p.addEffect(new MobEffectInstance(MobEffects.FIRE_RESISTANCE, 60, 0, false, false));
			}
			// Lava walker: lava under the boots hardens into basalt while you stand on it.
			if (now % 2 == 0 && wears(p, EquipmentSlot.FEET, LavaRegistry.MAGMASTEEL_BOOTS)) {
				BlockPos under = p.blockPosition().below();
				for (BlockPos q : Lava.ring(under, LavaData.rules().armor().walkerRadius(), true)) {
					TemporaryBlocks.place(level, q, Blocks.BASALT, LavaData.rules().temporary().walker(), Blocks.LAVA, Gear::isLavaSource, true);
				}
			}
		}
	}

	public static void register() {
		PlayerBlockBreakEvents.BEFORE.register((world, player, pos, state, blockEntity) ->
			!(world instanceof ServerLevel level && player instanceof ServerPlayer sp) || mine(level, sp, pos, state));
		ServerTickEvents.END_LEVEL_TICK.register(Gear::tick);
	}
}
