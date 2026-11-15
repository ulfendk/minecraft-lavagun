package dk.ulfen.lavagun.world;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;

import dk.ulfen.lavagun.Lava;
import dk.ulfen.lavagun.LavaData;
import dk.ulfen.lavagun.LavaRegistry;
import dk.ulfen.lavagun.block.VolcanoVentBlock;
import dk.ulfen.lavagun.entity.LavaShot;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.BlockTags;
import net.minecraft.util.RandomSource;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.block.BaseFireBlock;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.material.Fluids;
import net.minecraft.world.phys.Vec3;

/**
 * Volcanoes: a cone of basalt round a crater of lava, with the vent on the crater's
 * floor. The shape is the same sum as volcanoColumns and volcanoBlock in
 * src/lib/temp.mjs (the Bedrock volcanoes are built from it). The vent keeps the
 * crater full, so lava runs out over the notch in the rim all the time, and now and
 * then, when a player is near, erupts: it throws out lava bombs that land as magma
 * and basalt that stay.
 */
public final class Volcano {
	/** One column of the volcano: solid up to `top` (blocks above the base), with lava above it up to `lava` in the crater (or -1). */
	public record Column(int dx, int dz, int top, int lava) {}

	public static final double BOMB_GRAVITY = 0.05;

	private static final Map<ServerLevel, Map<BlockPos, Long>> NEXT = new WeakHashMap<>();
	private static final Map<ServerLevel, Map<BlockPos, Integer>> ERUPTING = new WeakHashMap<>();

	private Volcano() {}

	private static LavaData.Volcano rules() {
		return LavaData.rules().volcano();
	}

	// ---------------------------------------------------------------- the shape

	/** A number in [0, 1) from a seed and a position; the same as hash01 in temp.mjs. */
	public static double hash01(int seed, int x, int y, int z) {
		int h = x * 0x27d4eb2d + y * 0x165667b1 + z * 0x9e3779b1 + seed;
		h = (h ^ (h >>> 15)) * 0x85ebca6b;
		h = (h ^ (h >>> 13)) * 0xc2b2ae35;
		h ^= h >>> 16;
		return (h & 0xffffffffL) / 4294967296.0;
	}

	public static double notchAngle(int seed) {
		return hash01(seed, 7, 7, 7) * 2 * Math.PI;
	}

	public static List<Column> columns(int seed) {
		LavaData.Volcano v = rules();
		int R = v.radius(), H = v.height(), cR = v.crater().radius(), floor = H - v.crater().depth();
		double[] phases = {hash01(seed, 1, 0, 0) * 2 * Math.PI, hash01(seed, 2, 0, 0) * 2 * Math.PI, hash01(seed, 3, 0, 0) * 2 * Math.PI};
		double notch = notchAngle(seed), nx = Math.cos(notch), nz = Math.sin(notch);
		List<Column> out = new ArrayList<>();
		for (int dx = -R; dx <= R; dx++) {
			for (int dz = -R; dz <= R; dz++) {
				double r = Math.sqrt(dx * dx + dz * dz);
				if (r > R) continue;
				double a = Math.atan2(dz, dx);
				double wobble = (Math.cos(a + phases[0]) + Math.cos(2 * a + phases[1]) + Math.cos(3 * a + phases[2])) / 3;
				double foot = R - 1.5 + 1.5 * wobble;
				if (r < cR + 0.5) {
					out.add(new Column(dx, dz, floor, H - 1));
					continue;
				}
				if (r >= foot) continue;
				double along = dx * nx + dz * nz, across = Math.abs(dz * nx - dx * nz);
				boolean groove = along > 0 && across < 0.75;
				int top = r < cR + 1.5 ? H : (int) Math.round(H * Math.pow((foot - r) / (foot - cR - 1), v.profile()));
				if (groove) top = Math.min(top - 1, H - 2);
				if (top < 0) continue;
				out.add(new Column(dx, dz, top, -1));
			}
		}
		return out;
	}

	/** What the block at height `y` of a column is made of (volcanoBlock in temp.mjs). */
	public static BlockState block(int seed, Column col, int y) {
		LavaData.Volcano v = rules();
		if (col.dx() == 0 && col.dz() == 0 && y == col.top()) return LavaRegistry.VOLCANO_VENT.defaultBlockState().setValue(VolcanoVentBlock.GROWN, true);
		double r = Math.sqrt(col.dx() * col.dx() + col.dz() * col.dz());
		if (r < v.crater().radius() + 1.5 && y >= v.height() - v.crater().depth() - 2) return Blocks.MAGMA_BLOCK.defaultBlockState();
		if (col.top() - y >= 2 && col.top() > 2) return Blocks.STONE.defaultBlockState();
		double n = hash01(seed, col.dx(), y, col.dz());
		double magma = 0.04 + 0.12 * Math.max(0, y) / v.height();
		if (n < magma) return Blocks.MAGMA_BLOCK.defaultBlockState();
		if (n < magma + 0.15) return Blocks.BLACKSTONE.defaultBlockState();
		if (n < magma + 0.25) return Blocks.TUFF.defaultBlockState();
		return Blocks.BASALT.defaultBlockState();
	}

	/** Which shape grows at (x, z). */
	public static int seedAt(BlockPos pos) {
		return (int) (hash01(0, pos.getX(), 0, pos.getZ()) * rules().variants());
	}

	/** What the rock under a volcano may fill: air, plants and liquids. */
	private static boolean fills(BlockState state) {
		return state.isAir() || state.canBeReplaced() || !state.getFluidState().isEmpty();
	}

	/** Trees and plants in the way of the cone. */
	private static boolean clears(BlockState state) {
		return !state.isAir() && (state.canBeReplaced() || state.is(BlockTags.LOGS) || state.is(BlockTags.LEAVES));
	}

	/**
	 * Build a volcano on `base` (the block above the ground), with rock under it down
	 * to the ground. Returns where its vent is.
	 */
	public static BlockPos build(LevelAccessor level, BlockPos base, int seed) {
		LavaData.Volcano v = rules();
		BlockPos.MutableBlockPos p = new BlockPos.MutableBlockPos();
		BlockState lava = Blocks.LAVA.defaultBlockState(), air = Blocks.AIR.defaultBlockState();
		for (Column col : columns(seed)) {
			int x = base.getX() + col.dx(), z = base.getZ() + col.dz();
			for (int k = 1; k <= v.skirt(); k++) {
				p.set(x, base.getY() - k, z);
				if (!fills(level.getBlockState(p))) break;
				level.setBlock(p, block(seed, col, -k), 2);
			}
			for (int y = 0; y <= col.top(); y++) level.setBlock(p.set(x, base.getY() + y, z), block(seed, col, y), 2);
			if (col.lava() >= 0) {
				for (int y = col.top() + 1; y <= col.lava(); y++) {
					level.setBlock(p.set(x, base.getY() + y, z), lava, 2);
					level.scheduleTick(p.immutable(), Fluids.LAVA, 1);
				}
				for (int y = col.lava() + 1; y <= v.height() + 2; y++) level.setBlock(p.set(x, base.getY() + y, z), air, 2);
			} else {
				for (int y = col.top() + 1; y <= v.height() + 4; y++) {
					if (clears(level.getBlockState(p.set(x, base.getY() + y, z)))) level.setBlock(p, air, 2);
				}
			}
		}
		BlockPos vent = base.above(v.height() - v.crater().depth());
		level.scheduleTick(vent, LavaRegistry.VOLCANO_VENT, 20);
		return vent;
	}

	// ---------------------------------------------------------------- the vent at work

	private static double between(RandomSource random, float[] range) {
		return range[0] + random.nextDouble() * (range[1] - range[0]);
	}

	/** Lava in the crater above the vent, where it has been taken out or has run off. */
	public static void refill(ServerLevel level, BlockPos vent) {
		LavaData.Volcano v = rules();
		int cR = v.crater().radius();
		for (int y = 1; y < v.crater().depth(); y++) {
			for (BlockPos p : Lava.ring(vent.above(y), cR, true)) {
				BlockState s = level.getBlockState(p);
				if (s.isAir() || (s.is(Blocks.LAVA) && !s.getFluidState().isSource())) level.setBlockAndUpdate(p, Blocks.LAVA.defaultBlockState());
			}
		}
	}

	public static boolean isErupting(ServerLevel level, BlockPos vent) {
		return ERUPTING.computeIfAbsent(level, l -> new HashMap<>()).containsKey(vent);
	}

	/** Start an eruption: a rumble, then a few seconds of lava bombs. False if one is going on. */
	public static boolean erupt(ServerLevel level, BlockPos vent) {
		Map<BlockPos, Integer> erupting = ERUPTING.computeIfAbsent(level, l -> new HashMap<>());
		if (erupting.containsKey(vent)) return false;
		erupting.put(vent.immutable(), 0);
		Vec3 top = Vec3.atCenterOf(vent.above(rules().crater().depth()));
		level.playSound(null, top.x, top.y, top.z, SoundEvents.LIGHTNING_BOLT_THUNDER, SoundSource.BLOCKS, 4.0F, 0.4F);
		level.scheduleTick(vent, LavaRegistry.VOLCANO_VENT, rules().eruption().pulseTicks());
		return true;
	}

	/** Throw one lava bomb out of the crater, landing about `reach` blocks away on level ground. */
	public static LavaShot throwBomb(ServerLevel level, BlockPos vent, double reach) {
		LavaData.Eruption e = rules().eruption();
		RandomSource random = level.getRandom();
		double angle = between(random, e.angle()), yaw = random.nextDouble() * 2 * Math.PI;
		double speed = Lava.shotSpeed(reach, angle, BOMB_GRAVITY, 0), a = Math.toRadians(angle);
		LavaShot bomb = new LavaShot(LavaRegistry.VOLCANO_BOMB, level);
		bomb.setItem(new ItemStack(Items.MAGMA_BLOCK));
		bomb.setPos(vent.getX() + 0.5, vent.getY() + rules().crater().depth() + 0.5, vent.getZ() + 0.5);
		bomb.setDeltaMovement(Math.cos(yaw) * Math.cos(a) * speed, Math.sin(a) * speed, Math.sin(yaw) * Math.cos(a) * speed);
		level.addFreshEntity(bomb);
		return bomb;
	}

	/** Where a bomb lands: magma or basalt that stays, and sometimes fire on it. Not with mobGriefing off. */
	public static void rubble(ServerLevel level, BlockPos at) {
		if (!Lava.mayGrief(level)) return;
		LavaData.Eruption e = rules().eruption();
		RandomSource random = level.getRandom();
		BlockState rock = random.nextFloat() < e.magma() ? Blocks.MAGMA_BLOCK.defaultBlockState() : Blocks.BASALT.defaultBlockState();
		if (!Lava.placeLasting(level, at, rock, TemporaryBlocks::replaceable)) return;
		if (random.nextFloat() < e.fireChance()) Lava.placeLasting(level, at.above(), BaseFireBlock.getState(level, at.above()), TemporaryBlocks::replaceable);
	}

	/** A grown vent's scheduled tick: returns the ticks until the next one. */
	public static int tick(ServerLevel level, BlockPos vent, RandomSource random) {
		LavaData.Volcano v = rules();
		LavaData.Eruption e = v.eruption();
		Vec3 top = Vec3.atCenterOf(vent.above(v.crater().depth()));
		Map<BlockPos, Integer> erupting = ERUPTING.computeIfAbsent(level, l -> new HashMap<>());
		Integer t = erupting.get(vent);
		if (t != null) {
			t += e.pulseTicks();
			level.sendParticles(ParticleTypes.LARGE_SMOKE, top.x, top.y, top.z, 6, 0.8, 0.4, 0.8, 0.05);
			if (t > (e.rumble() + e.length()) * 20) {
				erupting.remove(vent);
				return 20;
			}
			erupting.put(vent, t);
			if (t > e.rumble() * 20) {
				level.playSound(null, top.x, top.y, top.z, SoundEvents.GHAST_SHOOT, SoundSource.BLOCKS, 3.0F, 0.5F);
				level.sendParticles(ParticleTypes.LAVA, top.x, top.y, top.z, 6, 0.5, 0.2, 0.5, 0);
				int n = e.bombsPerPulse()[0] + random.nextInt(e.bombsPerPulse()[1] - e.bombsPerPulse()[0] + 1);
				for (int i = 0; i < n; i++) throwBomb(level, vent, between(random, e.reach()));
			}
			return e.pulseTicks();
		}
		level.sendParticles(ParticleTypes.CAMPFIRE_COSY_SMOKE, top.x, top.y, top.z, 1, 0.4, 0.1, 0.4, 0.02);
		if (level.getGameTime() % 100 < 20) refill(level, vent);
		Map<BlockPos, Long> next = NEXT.computeIfAbsent(level, l -> new HashMap<>());
		long now = level.getGameTime();
		Long at = next.get(vent);
		if (at == null) {
			next.put(vent.immutable(), now + Math.round(between(random, e.every()) * 20));
			return 20;
		}
		if (now < at || level.getNearestPlayer(top.x, top.y, top.z, e.nearby(), false) == null) return 20;
		next.put(vent.immutable(), now + Math.round(between(random, e.every()) * 20));
		erupt(level, vent);
		return e.pulseTicks();
	}

	/** The vent was broken: forget it. */
	public static void forget(ServerLevel level, BlockPos vent) {
		NEXT.computeIfAbsent(level, l -> new HashMap<>()).remove(vent);
		ERUPTING.computeIfAbsent(level, l -> new HashMap<>()).remove(vent);
	}
}
