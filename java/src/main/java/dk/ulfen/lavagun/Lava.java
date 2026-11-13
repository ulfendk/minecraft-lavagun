package dk.ulfen.lavagun;

import java.util.ArrayList;
import java.util.List;

import dk.ulfen.lavagun.world.TemporaryBlocks;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
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
