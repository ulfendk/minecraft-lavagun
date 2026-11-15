package dk.ulfen.lavagun;

import java.util.ArrayList;
import java.util.List;

import dk.ulfen.lavagun.world.TemporaryBlocks;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.FluidTags;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.gamerules.GameRules;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/** What lava does when it hits: damage, fire, splashes and puddles of temporary lava. Shared by the guns, the grenade and the golem. */
public final class Lava {
	private Lava() {}

	public static boolean mayGrief(ServerLevel level) {
		return level.getGameRules().get(GameRules.MOB_GRIEFING);
	}

	public static boolean isFireproof(Entity e) {
		return e.fireImmune() || LavaData.rules().fireproof().contains(BuiltInRegistries.ENTITY_TYPE.getKey(e.getType()).toString());
	}

	/** May `attacker` hurt `target`? Not themselves, and other players only with PvP on. */
	public static boolean mayHurt(ServerLevel level, Entity target, @Nullable Entity attacker) {
		if (!(target instanceof LivingEntity living) || !living.isAlive() || target == attacker) return false;
		return !(target instanceof Player && attacker instanceof Player && !level.getGameRules().get(GameRules.PVP));
	}

	/** Hit and burn. Fire-proof mobs only feel the hit. */
	public static void hurt(ServerLevel level, Entity target, DamageSource source, float damage, int fireSeconds) {
		target.hurtServer(level, source, damage);
		if (fireSeconds > 0 && !isFireproof(target)) target.igniteForSeconds(fireSeconds);
	}

	/** Everything within `radius` takes damage that falls off with distance. */
	public static void splash(ServerLevel level, Vec3 at, float radius, float damage, int fire, DamageSource source, @Nullable Entity attacker) {
		for (Entity e : level.getEntities((Entity) null, new AABB(at, at).inflate(radius), e -> mayHurt(level, e, attacker))) {
			double d = e.position().distanceTo(at);
			if (d >= radius) continue;
			float dmg = Math.max(1, Math.round(damage * (1 - d / radius)));
			hurt(level, e, source, dmg, fire);
		}
	}

	/** Lava on the ground at each position: on the first replaceable block with solid ground under it. */
	public static int puddle(ServerLevel level, List<BlockPos> positions, float seconds) {
		int placed = 0;
		for (BlockPos p : positions) {
			for (int dy = 1; dy >= -2; dy--) {
				BlockPos pos = p.above(dy);
				BlockState below = level.getBlockState(pos.below());
				if (below.isAir() || !below.getFluidState().isEmpty()) continue;
				if (TemporaryBlocks.place(level, pos, Blocks.LAVA, seconds)) placed++;
				break;
			}
		}
		return placed;
	}

	/**
	 * The obsidian gun's lava sets into obsidian that stays: a disc round `centre`, flat
	 * against the face that was hit (`axis` is the axis that face points along). Only
	 * where a shot may go, or on lava, never on one of our temporary blocks, and never
	 * inside `avoid` (the mob that was hit). Returns how many blocks were set.
	 */
	public static int setObsidian(ServerLevel level, BlockPos centre, Direction.Axis axis, @Nullable AABB avoid) {
		level.playSound(null, centre, SoundEvents.LAVA_EXTINGUISH, SoundSource.PLAYERS, 1.0F, 0.8F);
		level.sendParticles(ParticleTypes.LARGE_SMOKE, centre.getX() + 0.5, centre.getY() + 0.5, centre.getZ() + 0.5, 8, 0.5, 0.3, 0.5, 0);
		if (!mayGrief(level)) return 0;
		int r = LavaData.rules().guns().get("obsidian_gun").obsidian().radius();
		int set = 0;
		for (BlockPos flat : ring(BlockPos.ZERO, r, true)) {
			int a = flat.getX(), b = flat.getZ();
			BlockPos pos = switch (axis) {
				case X -> centre.offset(0, a, b);
				case Z -> centre.offset(a, b, 0);
				case Y -> centre.offset(a, 0, b);
			};
			if (avoid != null && avoid.intersects(new AABB(pos))) continue;
			BlockState state = level.getBlockState(pos);
			if (TemporaryBlocks.isTemporary(level, pos)) continue;
			if (!TemporaryBlocks.replaceable(state) && !state.getFluidState().is(FluidTags.LAVA)) continue;
			level.setBlockAndUpdate(pos, Blocks.OBSIDIAN.defaultBlockState());
			set++;
		}
		return set;
	}

	/**
	 * A block that stays (lava from the lava cannon): only where `replace` allows, and
	 * never on one of our temporary blocks. True if it was placed.
	 */
	public static boolean placeLasting(ServerLevel level, BlockPos pos, BlockState state, java.util.function.Predicate<BlockState> replace) {
		if (TemporaryBlocks.isTemporary(level, pos) || !replace.test(level.getBlockState(pos))) return false;
		level.setBlockAndUpdate(pos, state);
		return true;
	}

	/** Lava that stays, at `pos` or (if that is taken) just above. Not with mobGriefing off. */
	public static boolean lastingLava(ServerLevel level, BlockPos pos) {
		if (!mayGrief(level)) return false;
		BlockState lava = Blocks.LAVA.defaultBlockState();
		return placeLasting(level, pos, lava, TemporaryBlocks::replaceable) || placeLasting(level, pos.above(), lava, TemporaryBlocks::replaceable);
	}

	/**
	 * How far a shot flies over flat ground: it leaves at `speed` blocks a tick, `angle`
	 * degrees up, `height` blocks above the ground, and each tick moves, slows by 1 %
	 * and falls by `gravity`. The same sum as shotRange in src/lib/temp.mjs.
	 */
	public static double shotRange(double speed, double angle, double gravity, double height) {
		double a = Math.toRadians(angle), x = 0, y = height, vx = speed * Math.cos(a), vy = speed * Math.sin(a);
		for (int t = 0; t < 1200; t++) {
			x += vx;
			y += vy;
			if (y <= 0) return x;
			vx *= 0.99;
			vy = vy * 0.99 - gravity;
		}
		return x;
	}

	/** The speed that carries a shot `range` blocks (see shotRange). */
	public static double shotSpeed(double range, double angle, double gravity, double height) {
		double lo = 0.05, hi = 8;
		for (int i = 0; i < 40; i++) {
			double mid = (lo + hi) / 2;
			if (shotRange(mid, angle, gravity, height) < range) lo = mid;
			else hi = mid;
		}
		return (lo + hi) / 2;
	}

	/** Blocks in a flat ring (or a disc) round a centre. */
	public static List<BlockPos> ring(BlockPos c, int radius, boolean filled) {
		List<BlockPos> out = new ArrayList<>();
		for (int x = -radius; x <= radius; x++)
			for (int z = -radius; z <= radius; z++) {
				double d = Math.hypot(x, z);
				if (filled ? d <= radius + 0.25 : d > radius - 0.5 && d <= radius + 0.5) out.add(c.offset(x, 0, z));
			}
		return out;
	}

	/** The magma grenade bursts: fire all round, and a ring of lava on the ground. */
	public static void burst(ServerLevel level, Vec3 at, DamageSource source, @Nullable Entity attacker) {
		LavaData.Grenade g = LavaData.rules().grenade();
		splash(level, at, g.radius(), g.damage(), g.fire(), source, attacker);
		level.playSound(null, at.x, at.y, at.z, SoundEvents.GENERIC_EXPLODE.value(), SoundSource.PLAYERS, 0.8F, 1.4F);
		level.sendParticles(ParticleTypes.EXPLOSION_EMITTER, at.x, at.y, at.z, 1, 0, 0, 0, 0);
		level.sendParticles(ParticleTypes.LAVA, at.x, at.y, at.z, 12, 0.5, 0.3, 0.5, 0);
		if (mayGrief(level)) puddle(level, ring(BlockPos.containing(at), g.ring(), false), LavaData.rules().temporary().lava());
	}

	/** The magma golem's slam: lava bursts out of the ground round what it hit (not under its feet). */
	public static void slam(ServerLevel level, Entity golem, Entity target) {
		level.playSound(null, target.blockPosition(), SoundEvents.GENERIC_EXPLODE.value(), SoundSource.HOSTILE, 0.6F, 0.5F);
		level.sendParticles(ParticleTypes.LAVA, target.getX(), target.getY(), target.getZ(), 8, 0.6, 0.2, 0.6, 0);
		target.push(0, 0.5, 0);
		if (!mayGrief(level)) return;
		BlockPos at = target.blockPosition();
		List<BlockPos> around = ring(at, LavaData.rules().golem().slamLava() + 1, true);
		around.removeIf(p -> p.getX() == at.getX() && p.getZ() == at.getZ());
		puddle(level, around, LavaData.rules().temporary().lava());
	}
}
