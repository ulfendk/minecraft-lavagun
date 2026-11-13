package dk.ulfen.lavagun.world;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

import dk.ulfen.lavagun.LavaRegistry;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.level.saveddata.SavedDataType;

/**
 * Temporary blocks: lava from shots, obsidian shells, basalt under lava walker boots.
 * Each is remembered with the block it should still be and the block to put back,
 * and put back when its time is up, unless something else has changed it in the
 * meantime. Saved with each level, like src/lib/temp.mjs on Bedrock.
 */
public class TemporaryBlocks extends SavedData {
	public record Entry(BlockPos pos, Block expect, Block restore, long until) {
		static final Codec<Entry> CODEC = RecordCodecBuilder.create(i -> i.group(
			BlockPos.CODEC.fieldOf("pos").forGetter(Entry::pos),
			BuiltInRegistries.BLOCK.byNameCodec().fieldOf("expect").forGetter(Entry::expect),
			BuiltInRegistries.BLOCK.byNameCodec().fieldOf("restore").forGetter(Entry::restore),
			Codec.LONG.fieldOf("until").forGetter(Entry::until)
		).apply(i, Entry::new));
	}

	private static final Codec<TemporaryBlocks> CODEC = Entry.CODEC.listOf().xmap(TemporaryBlocks::new, t -> List.copyOf(t.entries.values()));
	private static final SavedDataType<TemporaryBlocks> TYPE = new SavedDataType<>(LavaRegistry.id("temporary_blocks"), TemporaryBlocks::new, CODEC, null);
	private static final int SWEEP = 5;

	private final Map<BlockPos, Entry> entries = new HashMap<>();

	public TemporaryBlocks() {}

	private TemporaryBlocks(List<Entry> list) {
		for (Entry e : list) entries.put(e.pos(), e);
	}

	public static TemporaryBlocks of(ServerLevel level) {
		return level.getDataStorage().computeIfAbsent(TYPE);
	}

	/** Air and things you walk through (grass, flowers, snow, fire), but no liquids. */
	public static boolean replaceable(BlockState state) {
		return state.isAir() || (state.canBeReplaced() && state.getFluidState().isEmpty());
	}

	public static boolean isTemporary(ServerLevel level, BlockPos pos) {
		return of(level).entries.containsKey(pos);
	}

	/** Put `block` at `pos` for `seconds`, then air. Only where the block there is replaceable. */
	public static boolean place(ServerLevel level, BlockPos pos, Block block, float seconds) {
		return place(level, pos, block, seconds, Blocks.AIR, TemporaryBlocks::replaceable, false);
	}

	/**
	 * Put `block` at `pos` for `seconds`, then `restore`. Only where `replace` allows. With
	 * `refresh`, a block that is already ours (and the same block) gets its full time again.
	 */
	public static boolean place(ServerLevel level, BlockPos pos, Block block, float seconds, Block restore, Predicate<BlockState> replace, boolean refresh) {
		TemporaryBlocks t = of(level);
		long until = level.getGameTime() + Math.round(seconds * 20);
		Entry old = t.entries.get(pos);
		if (old != null) {
			if (refresh && old.expect() == block && old.until() < until) {
				t.entries.put(pos.immutable(), new Entry(old.pos(), old.expect(), old.restore(), until));
				t.setDirty();
			}
			return false;
		}
		if (!level.isLoaded(pos) || !replace.test(level.getBlockState(pos))) return false;
		level.setBlockAndUpdate(pos, block.defaultBlockState());
		t.entries.put(pos.immutable(), new Entry(pos.immutable(), block, restore, until));
		t.setDirty();
		return true;
	}

	private void sweep(ServerLevel level) {
		long now = level.getGameTime();
		List<Entry> due = new ArrayList<>();
		for (Entry e : entries.values()) if (now >= e.until() && level.isLoaded(e.pos())) due.add(e);
		for (Entry e : due) {
			entries.remove(e.pos());
			if (level.getBlockState(e.pos()).is(e.expect())) level.setBlockAndUpdate(e.pos(), e.restore().defaultBlockState());
		}
		if (!due.isEmpty()) setDirty();
	}

	public int size() {
		return entries.size();
	}

	public static void register() {
		ServerTickEvents.END_LEVEL_TICK.register(level -> {
			if (level.getGameTime() % SWEEP == 0) of(level).sweep(level);
		});
		// A temporary block that is mined just goes away: no free obsidian or basalt.
		PlayerBlockBreakEvents.BEFORE.register((world, player, pos, state, blockEntity) -> {
			if (!(world instanceof ServerLevel level)) return true;
			TemporaryBlocks t = of(level);
			if (t.entries.remove(pos) == null) return true;
			t.setDirty();
			level.setBlockAndUpdate(pos, Blocks.AIR.defaultBlockState());
			level.playSound(null, pos, SoundEvents.STONE_BREAK, SoundSource.BLOCKS, 1.0F, 1.0F);
			return false;
		});
	}
}
