package dk.ulfen.lavagun.world;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;

import dk.ulfen.lavagun.LavaData;
import dk.ulfen.lavagun.Lava;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Mth;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

/**
 * The lava gun's obsidian shell: a hollow box of temporary obsidian round a mob that
 * holds it for a few seconds, after which it burns. Without mobGriefing the mob is
 * only frozen in place. Matches shellPositions in src/lib/temp.mjs.
 */
public final class Encasement {
	private record Held(Vec3 at, long until) {}

	private static final Map<LivingEntity, Held> HELD = new WeakHashMap<>();
	private static final Map<LivingEntity, Long> IMMUNE = new WeakHashMap<>();

	private Encasement() {}

	/** The blocks of the shell round a hitbox, or null if it is too big to shut in. */
	public static List<BlockPos> shell(AABB box, int maxWidth, int maxHeight) {
		double eps = 1e-3;
		int x0 = Mth.floor(box.minX + eps), y0 = Mth.floor(box.minY + eps), z0 = Mth.floor(box.minZ + eps);
		int x1 = Math.max(x0, Mth.floor(box.maxX - eps)), y1 = Math.max(y0, Mth.floor(box.maxY - eps)), z1 = Math.max(z0, Mth.floor(box.maxZ - eps));
		if (x1 - x0 + 1 > maxWidth || z1 - z0 + 1 > maxWidth || y1 - y0 + 1 > maxHeight) return null;
		List<BlockPos> out = new ArrayList<>();
		for (int x = x0 - 1; x <= x1 + 1; x++)
			for (int y = y0 - 1; y <= y1 + 1; y++)
				for (int z = z0 - 1; z <= z1 + 1; z++) {
					boolean inside = x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1;
					if (!inside) out.add(new BlockPos(x, y, z));
				}
		return out;
	}

	public static boolean isHeld(LivingEntity e) {
		return HELD.containsKey(e);
	}

	/** Shut a mob in. True if it was caught. */
	public static boolean encase(ServerLevel level, LivingEntity target) {
		LavaData.Shell rules = LavaData.rules().shell();
		long now = level.getGameTime();
		String type = BuiltInRegistries.ENTITY_TYPE.getKey(target.getType()).toString();
		if (rules.exempt().contains(type) || HELD.containsKey(target) || IMMUNE.getOrDefault(target, 0L) > now) return false;
		List<BlockPos> shell = shell(target.getBoundingBox(), rules.maxWidth(), rules.maxHeight());
		if (shell == null) return false;
		float seconds = LavaData.rules().temporary().shell();
		if (Lava.mayGrief(level)) for (BlockPos p : shell) TemporaryBlocks.place(level, p, Blocks.OBSIDIAN, seconds);
		int ticks = Math.round(seconds * 20);
		HELD.put(target, new Held(target.position(), now + ticks));
		target.addEffect(new MobEffectInstance(MobEffects.SLOWNESS, ticks, 255, false, false));
		target.addEffect(new MobEffectInstance(MobEffects.MINING_FATIGUE, ticks, 4, false, false));
		target.setDeltaMovement(Vec3.ZERO);
		level.playSound(null, target.blockPosition(), SoundEvents.LAVA_EXTINGUISH, SoundSource.HOSTILE, 1.5F, 0.6F);
		if (target instanceof ServerPlayer player) player.sendOverlayMessage(Component.translatable("lavagun.hud.encased"));
		return true;
	}

	private static void tick(ServerLevel level) {
		long now = level.getGameTime();
		List<LivingEntity> done = new ArrayList<>();
		for (Map.Entry<LivingEntity, Held> e : HELD.entrySet()) {
			LivingEntity mob = e.getKey();
			if (mob.level() != level) continue;
			Held h = e.getValue();
			if (!mob.isAlive() || now >= h.until()) {
				done.add(mob);
				continue;
			}
			// Keep it where it was caught.
			if (mob.position().distanceToSqr(h.at()) > 0.0025) mob.teleportTo(h.at().x, h.at().y, h.at().z);
			mob.setDeltaMovement(Vec3.ZERO);
			if (now % 10 == 0) level.sendParticles(ParticleTypes.LAVA, h.at().x, h.at().y + 1, h.at().z, 1, 0.2, 0.2, 0.2, 0.0);
		}
		for (LivingEntity mob : done) {
			HELD.remove(mob);
			IMMUNE.put(mob, now + Math.round(LavaData.rules().shell().immunity() * 20));
			if (mob.isAlive() && !Lava.isFireproof(mob)) mob.igniteForSeconds(LavaData.rules().shell().burnAfter());
		}
	}

	public static void register() {
		ServerTickEvents.END_LEVEL_TICK.register(Encasement::tick);
	}
}
