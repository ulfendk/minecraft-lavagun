package dk.ulfen.lavagun.entity;

import dk.ulfen.lavagun.Lava;
import dk.ulfen.lavagun.LavaData;
import dk.ulfen.lavagun.LavaRegistry;
import dk.ulfen.lavagun.world.Encasement;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrowableItemProjectile;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.EntityHitResult;
import net.minecraft.world.phys.HitResult;

/**
 * A shot from a lava gun. The lava pistol's bolt burns what it hits; the lava gun's
 * blob shuts a mob in obsidian, or splashes lava where it lands; the obsidian gun's
 * blob sets into obsidian that stays; the lava cannon's ball leaves lava that stays.
 * The numbers are in src/rules.mjs (guns.* and cannon).
 */
public class LavaShot extends ThrowableItemProjectile {
	public LavaShot(EntityType<? extends LavaShot> type, Level level) {
		super(type, level);
	}

	public LavaShot(EntityType<? extends LavaShot> type, Level level, LivingEntity owner, ItemStack stack) {
		super(type, owner, level, stack);
	}

	private boolean isBlob() {
		return this.getType() == LavaRegistry.LAVA_BLOB;
	}

	private boolean isObsidian() {
		return this.getType() == LavaRegistry.OBSIDIAN_BLOB;
	}

	private boolean isBall() {
		return this.getType() == LavaRegistry.LAVA_BALL;
	}

	private LavaData.Gun gun() {
		return LavaData.rules().guns().get(isObsidian() ? "obsidian_gun" : isBlob() ? "lava_gun" : "lava_pistol");
	}

	@Override
	protected Item getDefaultItem() {
		return isBall() ? Items.MAGMA_BLOCK : isObsidian() ? Items.OBSIDIAN : isBlob() ? LavaRegistry.MAGMA_CORE : LavaRegistry.MAGMA_CHARGE;
	}

	@Override
	protected double getDefaultGravity() {
		return isBall() ? LavaData.rules().cannon().gravity() : gun().gravity();
	}

	/** The cannon's ball flies past cannons. */
	@Override
	protected boolean canHitEntity(Entity target) {
		return super.canHitEntity(target) && !(target instanceof LavaCannon);
	}

	@Override
	public void tick() {
		super.tick();
		if (this.level().isClientSide() && this.tickCount % 2 == 0) {
			this.level().addParticle(isBlob() || isObsidian() || isBall() ? ParticleTypes.LAVA : ParticleTypes.FLAME, this.getX(), this.getY(), this.getZ(), 0, 0, 0);
		}
	}

	@Override
	protected void onHitEntity(EntityHitResult hit) {
		super.onHitEntity(hit);
		if (!(this.level() instanceof ServerLevel level)) return;
		Entity target = hit.getEntity();
		Entity owner = this.getOwner();
		if (!Lava.mayHurt(level, target, owner)) return;
		if (isBall()) {
			LavaData.Cannon c = LavaData.rules().cannon();
			BlockPos feet = target.blockPosition();
			Lava.hurt(level, target, this.damageSources().thrown(this, owner), c.damage(), c.fire());
			Lava.lastingLava(level, feet);
			return;
		}
		LavaData.Gun g = gun();
		var source = this.damageSources().thrown(this, owner);
		if (isObsidian()) {
			// Sets round its feet, not on it.
			var box = target.getBoundingBox();
			Lava.hurt(level, target, source, g.damage(), g.fire());
			Lava.setObsidian(level, target.blockPosition(), Direction.Axis.Y, box);
			return;
		}
		if (!isBlob()) {
			Lava.hurt(level, target, source, g.damage(), g.fire());
			return;
		}
		// Shut in first: it burns when it gets out.
		Lava.hurt(level, target, source, g.damage(), 0);
		boolean caught = target instanceof LivingEntity living && living.isAlive() && Encasement.encase(level, living);
		if (!caught && !Lava.isFireproof(target)) target.igniteForSeconds(g.fire());
	}

	@Override
	protected void onHitBlock(BlockHitResult hit) {
		super.onHitBlock(hit);
		if (!(this.level() instanceof ServerLevel level)) return;
		if (isBall()) {
			this.playSound(SoundEvents.BUCKET_EMPTY_LAVA, 1.0F, 0.8F);
			Lava.lastingLava(level, hit.getBlockPos().relative(hit.getDirection()));
			return;
		}
		if (isObsidian()) {
			Lava.setObsidian(level, hit.getBlockPos().relative(hit.getDirection()), hit.getDirection().getAxis(), null);
			return;
		}
		if (!isBlob()) return;
		LavaData.Splash s = gun().splash();
		Lava.splash(level, hit.getLocation(), s.radius(), s.damage(), s.fire(), this.damageSources().thrown(this, this.getOwner()), this.getOwner());
		if (s.lava() && Lava.mayGrief(level)) {
			BlockPos at = hit.getBlockPos().relative(hit.getDirection());
			Lava.puddle(level, java.util.List.of(at), LavaData.rules().temporary().lava());
		}
	}

	@Override
	protected void onHit(HitResult hit) {
		super.onHit(hit);
		if (this.level() instanceof ServerLevel level) {
			level.sendParticles(ParticleTypes.LAVA, this.getX(), this.getY(), this.getZ(), isBlob() || isObsidian() || isBall() ? 8 : 3, 0.2, 0.2, 0.2, 0);
			this.discard();
		}
	}
}
