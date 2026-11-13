package dk.ulfen.lavagun.entity;

import com.geckolib.animatable.GeoEntity;
import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.animation.AnimationController;
import com.geckolib.animation.RawAnimation;
import com.geckolib.animation.object.PlayState;
import com.geckolib.constant.DataTickets;
import com.geckolib.util.GeckoLibUtil;

import dk.ulfen.lavagun.LavaData;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.util.RandomSource;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.PathfinderMob;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.ServerLevelAccessor;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/** A creature of the Nether made of lava: its stats, sounds and animations come from src/creatures.mjs. */
public abstract class LavaCreature extends PathfinderMob implements GeoEntity {
	private final AnimatableInstanceCache geoCache = GeckoLibUtil.createInstanceCache(this);

	protected LavaCreature(EntityType<? extends LavaCreature> type, Level level) {
		super(type, level);
	}

	protected abstract String id();

	protected LavaData.Creature data() {
		return LavaData.creature(id());
	}

	public static AttributeSupplier.Builder createAttributes(String id) {
		LavaData.Creature c = LavaData.creature(id);
		return Mob.createMobAttributes()
			.add(Attributes.MAX_HEALTH, c.health())
			.add(Attributes.MOVEMENT_SPEED, c.speed())
			.add(Attributes.ATTACK_DAMAGE, Math.max(1, c.attack()))
			.add(Attributes.FOLLOW_RANGE, c.followRange())
			.add(Attributes.KNOCKBACK_RESISTANCE, c.knockbackResistance());
	}

	/** Water hurts them, as it hurts a blaze. */
	@Override
	public boolean isSensitiveToWater() {
		return true;
	}

	@Override
	protected int getBaseExperienceReward(ServerLevel level) {
		return data().xp();
	}

	// ---------------------------------------------------------------- sounds

	private static SoundEvent sound(String id) {
		return BuiltInRegistries.SOUND_EVENT.getValue(Identifier.parse(id));
	}

	@Override
	protected @Nullable SoundEvent getAmbientSound() {
		return sound(data().sounds().ambient());
	}

	@Override
	protected SoundEvent getHurtSound(DamageSource source) {
		return sound(data().sounds().hurt());
	}

	@Override
	protected SoundEvent getDeathSound() {
		return sound(data().sounds().death());
	}

	@Override
	protected void playStepSound(BlockPos pos, BlockState state) {
		this.playSound(sound(data().sounds().step()), 0.5F, getVoicePitch());
	}

	@Override
	public float getVoicePitch() {
		LavaData.Sounds s = data().sounds();
		return s.pitchMin() + this.random.nextFloat() * (s.pitchMax() - s.pitchMin());
	}

	// ---------------------------------------------------------------- GeckoLib

	protected String animation(String name) {
		return "animation.lavagun." + id() + "." + name;
	}

	@Override
	public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {
		controllers.add(new AnimationController<LavaCreature>("move", 4, state -> {
			Vec3 v = state.getDataOrDefault(DataTickets.VELOCITY, Vec3.ZERO);
			double speed = Math.sqrt(v.x * v.x + v.z * v.z) * 20;
			return state.setAndContinue(RawAnimation.begin().thenLoop(animation(speed > 0.3 ? "walk" : "idle")));
		}));
		if (data().animations().contains("attack")) {
			AnimationController<LavaCreature> action = new AnimationController<>("action", 2, state -> PlayState.STOP);
			action.triggerableAnim("attack", RawAnimation.begin().thenPlay(animation("attack")));
			controllers.add(action);
		}
	}

	@Override
	public AnimatableInstanceCache getAnimatableInstanceCache() {
		return this.geoCache;
	}

	/** Spawn rule: on solid ground. */
	public static boolean checkSpawn(EntityType<? extends Mob> type, ServerLevelAccessor level, EntitySpawnReason reason, BlockPos pos, RandomSource random) {
		BlockPos below = pos.below();
		return level.getBlockState(below).isFaceSturdy(level, below, Direction.UP);
	}
}
