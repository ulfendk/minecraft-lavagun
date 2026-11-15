package dk.ulfen.lavagun.world;

import com.mojang.serialization.MapCodec;

import dk.ulfen.lavagun.LavaData;
import net.minecraft.core.BlockPos;
import net.minecraft.core.SectionPos;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.WorldGenLevel;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.levelgen.feature.Feature;

/**
 * A volcano that generates with the world (data/lavagun/worldgen, placed by
 * LavaRegistry for the biomes in src/rules.mjs). Not on water, and not where a
 * structure such as a village is.
 */
public record VolcanoFeature() implements Feature {
	public static final MapCodec<VolcanoFeature> CODEC = MapCodec.unit(VolcanoFeature::new);

	@Override
	public MapCodec<VolcanoFeature> codec() {
		return CODEC;
	}

	@Override
	public boolean place(WorldGenLevel level, ChunkGenerator generator, RandomSource random, BlockPos base) {
		LavaData.Volcano v = LavaData.rules().volcano();
		if (!level.getFluidState(base.below()).isEmpty() || !level.getBlockState(base.below()).isSolid()) return false;
		if (base.getY() + v.height() + 2 >= level.getMaxY() || base.getY() - v.skirt() <= level.getMinY()) return false;
		int R = v.radius();
		for (int cx = SectionPos.blockToSectionCoord(base.getX() - R); cx <= SectionPos.blockToSectionCoord(base.getX() + R); cx++) {
			for (int cz = SectionPos.blockToSectionCoord(base.getZ() - R); cz <= SectionPos.blockToSectionCoord(base.getZ() + R); cz++) {
				if (!level.getChunk(cx, cz).getAllReferences().isEmpty()) return false;
			}
		}
		Volcano.build(level, base, random.nextInt(v.variants()));
		return true;
	}
}
