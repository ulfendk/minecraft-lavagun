package dk.ulfen.lavagun.block;

import dk.ulfen.lavagun.LavaData;
import dk.ulfen.lavagun.LavaRegistry;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemUtils;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.IntegerProperty;
import net.minecraft.world.phys.BlockHitResult;

/**
 * Holds buckets of lava. Pour lava in with a bucket, take it out with an empty bucket,
 * or use iron ingots on it to turn a bucket of its lava into lava cells.
 */
public class LavaTankBlock extends Block {
	public static final IntegerProperty BUCKETS = IntegerProperty.create("buckets", 0, LavaData.rules().tank().capacity());
	public static final int IRON_PER_FILL = 4;

	public LavaTankBlock(Properties properties) {
		super(properties);
		registerDefaultState(this.stateDefinition.any().setValue(BUCKETS, 0));
	}

	@Override
	protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
		builder.add(BUCKETS);
	}

	@Override
	protected InteractionResult useItemOn(ItemStack held, BlockState state, Level level, BlockPos pos, Player player, InteractionHand hand, BlockHitResult hit) {
		int buckets = state.getValue(BUCKETS);
		int cap = LavaData.rules().tank().capacity();
		if (held.is(Items.LAVA_BUCKET)) {
			if (buckets >= cap) return tell(player, "lavagun.hud.tank_full");
			if (!level.isClientSide()) {
				level.setBlockAndUpdate(pos, state.setValue(BUCKETS, buckets + 1));
				player.setItemInHand(hand, ItemUtils.createFilledResult(held, player, new ItemStack(Items.BUCKET)));
				level.playSound(null, pos, SoundEvents.BUCKET_EMPTY_LAVA, SoundSource.BLOCKS, 1.0F, 1.0F);
				status(player, buckets + 1);
			}
			return InteractionResult.SUCCESS;
		}
		if (held.is(Items.BUCKET)) {
			if (buckets <= 0) return tell(player, "lavagun.hud.tank_empty");
			if (!level.isClientSide()) {
				level.setBlockAndUpdate(pos, state.setValue(BUCKETS, buckets - 1));
				player.setItemInHand(hand, ItemUtils.createFilledResult(held, player, new ItemStack(Items.LAVA_BUCKET)));
				level.playSound(null, pos, SoundEvents.BUCKET_FILL_LAVA, SoundSource.BLOCKS, 1.0F, 1.0F);
				status(player, buckets - 1);
			}
			return InteractionResult.SUCCESS;
		}
		if (held.is(Items.IRON_INGOT)) {
			if (buckets <= 0) return tell(player, "lavagun.hud.tank_empty");
			if (!player.hasInfiniteMaterials() && held.getCount() < IRON_PER_FILL) return InteractionResult.FAIL;
			if (!level.isClientSide()) {
				held.consume(IRON_PER_FILL, player);
				level.setBlockAndUpdate(pos, state.setValue(BUCKETS, buckets - 1));
				ItemStack cells = new ItemStack(LavaRegistry.LAVA_CELL, LavaData.rules().tank().cellsPerBucket());
				if (!player.getInventory().add(cells)) Block.popResource(level, pos.above(), cells);
				level.playSound(null, pos, SoundEvents.BUCKET_FILL_LAVA, SoundSource.BLOCKS, 1.0F, 1.4F);
				status(player, buckets - 1);
			}
			return InteractionResult.SUCCESS;
		}
		return InteractionResult.TRY_WITH_EMPTY_HAND;
	}

	@Override
	protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
		if (!level.isClientSide()) status(player, state.getValue(BUCKETS));
		return InteractionResult.SUCCESS;
	}

	private static void status(Player player, int buckets) {
		player.sendOverlayMessage(Component.translatable("lavagun.hud.tank", buckets, LavaData.rules().tank().capacity()));
	}

	private static InteractionResult tell(Player player, String key) {
		if (!player.level().isClientSide()) player.sendOverlayMessage(Component.translatable(key));
		return InteractionResult.SUCCESS;
	}
}
