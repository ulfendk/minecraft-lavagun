package dk.ulfen.lavagun.block;

import dk.ulfen.lavagun.Lava;
import dk.ulfen.lavagun.LavaData;
import dk.ulfen.lavagun.world.Volcano;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BooleanProperty;

/**
 * The volcano vent. One that has not grown yet (one a player put down) grows a
 * volcano round itself and ends up on the floor of its crater; a grown one keeps
 * the crater full and now and then erupts (dk.ulfen.lavagun.world.Volcano). It works
 * on scheduled ticks, which are saved with the world.
 */
public class VolcanoVentBlock extends Block {
	public static final BooleanProperty GROWN = BooleanProperty.create("grown");

	public VolcanoVentBlock(Properties properties) {
		super(properties);
		registerDefaultState(this.stateDefinition.any().setValue(GROWN, false));
	}

	@Override
	protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
		builder.add(GROWN);
	}

	@Override
	protected void onPlace(BlockState state, Level level, BlockPos pos, BlockState old, boolean moved) {
		if (!old.is(this)) level.scheduleTick(pos, this, 20);
	}

	@Override
	protected void tick(BlockState state, ServerLevel level, BlockPos pos, RandomSource random) {
		if (state.getValue(GROWN)) {
			level.scheduleTick(pos, this, Volcano.tick(level, pos, random));
			return;
		}
		int R = LavaData.rules().volcano().radius();
		if (!Lava.mayGrief(level) || !level.hasChunksAt(pos.offset(-R, 0, -R), pos.offset(R, 0, R))
			|| pos.getY() + LavaData.rules().volcano().height() + 2 >= level.getMaxY()) {
			level.scheduleTick(pos, this, 20);
			return;
		}
		BlockPos vent = Volcano.build(level, pos, Volcano.seedAt(pos));
		level.playSound(null, vent, SoundEvents.GENERIC_EXPLODE.value(), SoundSource.BLOCKS, 4.0F, 0.4F);
	}

	@Override
	protected void affectNeighborsAfterRemoval(BlockState state, ServerLevel level, BlockPos pos, boolean moved) {
		Volcano.forget(level, pos);
	}
}
