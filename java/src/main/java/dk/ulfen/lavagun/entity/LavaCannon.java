package dk.ulfen.lavagun.entity;

import com.geckolib.animatable.GeoEntity;
import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.animation.AnimationController;
import com.geckolib.animation.RawAnimation;
import com.geckolib.animation.object.PlayState;
import com.geckolib.util.GeckoLibUtil;

import dk.ulfen.lavagun.Lava;
import dk.ulfen.lavagun.LavaData;
import dk.ulfen.lavagun.LavaRegistry;
import dk.ulfen.lavagun.item.LavaGunItem;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.DamageTypeTags;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * The lava cannon (src/cannon.mjs): it stands where it was put and never moves. Use
 * it and it turns to where you look and fires a ball of lava that leaves lava that
 * stays; sneak and use it to pick the range, 1 to 5. Only players can break it, and
 * then it drops itself.
 */
public class LavaCannon extends Mob implements GeoEntity {
	private final AnimatableInstanceCache geoCache = GeckoLibUtil.createInstanceCache(this);
	private int range = rules().startRange();
	private long readyAt;

	public LavaCannon(EntityType<? extends LavaCannon> type, Level level) {
		super(type, level);
	}

	private static LavaData.Cannon rules() {
		return LavaData.rules().cannon();
	}

	public static AttributeSupplier.Builder createAttributes() {
		return Mob.createMobAttributes()
			.add(Attributes.MAX_HEALTH, rules().health())
			.add(Attributes.MOVEMENT_SPEED, 0)
			.add(Attributes.KNOCKBACK_RESISTANCE, 1);
	}

	public int range() {
		return this.range;
	}

	/** Sneak and use: the next range, 1 to 5 and round again. */
	public int stepRange(@Nullable Player player) {
		this.range = this.range % rules().ranges().size() + 1;
		if (player != null) {
			player.sendOverlayMessage(Component.translatable("lavagun.hud.range", this.range, rules().ranges().get(this.range - 1)));
			this.playSound(SoundEvents.UI_BUTTON_CLICK.value(), 0.4F, 0.6F + this.range * 0.15F);
		}
		return this.range;
	}

	/** Turn to face `yaw`, the way a player looks. */
	public void face(float yaw) {
		this.setYRot(yaw);
		this.setYBodyRot(yaw);
		this.setYHeadRot(yaw);
		this.yRotO = yaw;
		this.yBodyRotO = yaw;
		this.yHeadRotO = yaw;
	}

	/** Fire at the cannon's range; with a player, turn to where they look and use their lava cells. */
	public boolean fire(@Nullable Player player) {
		if (!(this.level() instanceof ServerLevel level)) return false;
		LavaData.Cannon c = rules();
		long now = level.getGameTime();
		if (now < this.readyAt) return false;
		if (player != null && !LavaGunItem.takeAmmo(player, LavaRegistry.LAVA_CELL, c.ammoPerShot())) {
			player.sendOverlayMessage(Component.translatable("lavagun.hud.no_ammo", Component.translatable(LavaRegistry.LAVA_CELL.getDescriptionId())));
			this.playSound(SoundEvents.DISPENSER_FAIL, 0.6F, 1.6F);
			return false;
		}
		this.readyAt = now + Math.round(c.cooldown() * 20);
		if (player != null) face(player.getYRot());
		double yaw = Math.toRadians(this.getYRot()), a = Math.toRadians(c.angle());
		Vec3 ahead = new Vec3(-Math.sin(yaw), 0, Math.cos(yaw));
		Vec3 from = this.position().add(ahead.scale(c.muzzle().forward())).add(0, c.muzzle().up(), 0);
		// Ranges are from the cannon; the ball leaves from the muzzle, a little ahead of it.
		double speed = Lava.shotSpeed(c.ranges().get(this.range - 1) - c.muzzle().forward(), c.angle(), c.gravity(), c.muzzle().up());
		LavaShot ball = new LavaShot(LavaRegistry.LAVA_BALL, level);
		ball.setItem(new ItemStack(Items.MAGMA_BLOCK));
		if (player != null) ball.setOwner(player);
		ball.setPos(from);
		ball.setDeltaMovement(ahead.x * Math.cos(a) * speed, Math.sin(a) * speed, ahead.z * Math.cos(a) * speed);
		level.addFreshEntity(ball);
		this.triggerAnim("action", "fire");
		level.playSound(null, from.x, from.y, from.z, SoundEvents.GENERIC_EXPLODE.value(), SoundSource.PLAYERS, 1.2F, 0.7F);
		level.sendParticles(ParticleTypes.EXPLOSION, from.x, from.y, from.z, 1, 0, 0, 0, 0);
		level.sendParticles(ParticleTypes.LAVA, from.x, from.y, from.z, 4, 0.2, 0.2, 0.2, 0);
		return true;
	}

	@Override
	protected InteractionResult mobInteract(Player player, InteractionHand hand) {
		if (hand != InteractionHand.MAIN_HAND) return InteractionResult.PASS;
		if (!this.level().isClientSide()) {
			if (player.isShiftKeyDown()) stepRange(player);
			else fire(player);
		}
		return InteractionResult.SUCCESS;
	}

	// ---------------------------------------------------------------- a thing, not a mob

	/** Only players' hits break it (and anything that bypasses invulnerability, like /kill). */
	@Override
	public boolean hurtServer(ServerLevel level, DamageSource source, float amount) {
		if (source.is(DamageTypeTags.BYPASSES_INVULNERABILITY)) return super.hurtServer(level, source, amount);
		if (!(source.getEntity() instanceof Player player) || source.getDirectEntity() != player) return false;
		return super.hurtServer(level, source, player.hasInfiniteMaterials() ? this.getMaxHealth() : amount);
	}

	/** Gone at once when broken: no falling over. */
	@Override
	protected void tickDeath() {
		if (!this.level().isClientSide() && !this.isRemoved()) {
			this.level().broadcastEntityEvent(this, (byte) 60);
			this.remove(Entity.RemovalReason.KILLED);
		}
	}

	@Override
	protected SoundEvent getHurtSound(DamageSource source) {
		return SoundEvents.WOOD_HIT;
	}

	@Override
	protected SoundEvent getDeathSound() {
		return SoundEvents.WOOD_BREAK;
	}

	@Override
	public boolean isPushable() {
		return false;
	}

	@Override
	protected void doPush(Entity entity) {}

	@Override
	public boolean isPushedByFluid() {
		return false;
	}

	@Override
	public boolean canBeLeashed() {
		return false;
	}

	@Override
	public boolean removeWhenFarAway(double distance) {
		return false;
	}

	@Override
	public boolean requiresCustomPersistence() {
		return true;
	}

	@Override
	protected void addAdditionalSaveData(ValueOutput output) {
		super.addAdditionalSaveData(output);
		output.putInt("Range", this.range);
	}

	@Override
	protected void readAdditionalSaveData(ValueInput input) {
		super.readAdditionalSaveData(input);
		this.range = Math.clamp(input.getIntOr("Range", rules().startRange()), 1, rules().ranges().size());
	}

	// ---------------------------------------------------------------- GeckoLib

	@Override
	public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {
		AnimationController<LavaCannon> action = new AnimationController<>("action", 0, state -> PlayState.STOP);
		action.triggerableAnim("fire", RawAnimation.begin().thenPlay("animation.lavagun." + rules().id() + ".fire"));
		controllers.add(action);
	}

	@Override
	public AnimatableInstanceCache getAnimatableInstanceCache() {
		return this.geoCache;
	}
}
