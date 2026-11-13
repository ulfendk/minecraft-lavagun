package dk.ulfen.lavagun.entity;

import dk.ulfen.lavagun.Lava;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.ai.goal.target.HurtByTargetGoal;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;

/** Three blocks of cooling lava. Leaves you alone until you hit it; then it slams the ground so lava bursts out. */
public class MagmaGolem extends LavaCreature {
	public static final String ID = "magma_golem";

	public MagmaGolem(EntityType<? extends MagmaGolem> type, Level level) {
		super(type, level);
	}

	@Override
	protected String id() {
		return ID;
	}

	@Override
	protected void registerGoals() {
		this.goalSelector.addGoal(0, new FloatGoal(this));
		this.goalSelector.addGoal(3, new MeleeAttackGoal(this, 1.2, true));
		this.goalSelector.addGoal(8, new WaterAvoidingRandomStrollGoal(this, 0.9));
		this.goalSelector.addGoal(9, new LookAtPlayerGoal(this, Player.class, 8.0F));
		this.goalSelector.addGoal(10, new RandomLookAroundGoal(this));
		// Neutral: fights back, with its friends, when hurt.
		this.targetSelector.addGoal(1, new HurtByTargetGoal(this).setAlertOthers());
	}

	@Override
	public boolean doHurtTarget(ServerLevel level, Entity target) {
		triggerAnim("action", "attack");
		boolean hit = super.doHurtTarget(level, target);
		if (hit) Lava.slam(level, this, target);
		return hit;
	}
}
