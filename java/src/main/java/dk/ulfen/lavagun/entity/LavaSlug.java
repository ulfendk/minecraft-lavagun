package dk.ulfen.lavagun.entity;

import dk.ulfen.lavagun.LavaData;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.PanicGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemUtils;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;

/** A slow, harmless slug full of lava. Use an empty bucket on it for a bucket of lava, once every few minutes. */
public class LavaSlug extends LavaCreature {
	public static final String ID = "lava_slug";

	/** Ticks until it can fill a bucket again. */
	private int milkCooldown;

	public LavaSlug(EntityType<? extends LavaSlug> type, Level level) {
		super(type, level);
	}

	@Override
	protected String id() {
		return ID;
	}

	@Override
	protected void registerGoals() {
		this.goalSelector.addGoal(0, new FloatGoal(this));
		this.goalSelector.addGoal(1, new PanicGoal(this, 1.3));
		this.goalSelector.addGoal(8, new WaterAvoidingRandomStrollGoal(this, 0.8));
		this.goalSelector.addGoal(9, new LookAtPlayerGoal(this, Player.class, 6.0F));
		this.goalSelector.addGoal(10, new RandomLookAroundGoal(this));
	}

	public boolean canFillBucket() {
		return this.milkCooldown <= 0;
	}

	@Override
	protected InteractionResult mobInteract(Player player, InteractionHand hand) {
		ItemStack held = player.getItemInHand(hand);
		if (!held.is(Items.BUCKET) || !canFillBucket()) return super.mobInteract(player, hand);
		if (!this.level().isClientSide()) {
			player.playSound(SoundEvents.BUCKET_FILL_LAVA, 1.0F, 1.0F);
			player.setItemInHand(hand, ItemUtils.createFilledResult(held, player, new ItemStack(Items.LAVA_BUCKET)));
			this.milkCooldown = LavaData.rules().slug().milkCooldown() * 20;
		}
		return InteractionResult.SUCCESS;
	}

	@Override
	public void aiStep() {
		super.aiStep();
		if (this.milkCooldown > 0) this.milkCooldown--;
	}

	@Override
	protected void addAdditionalSaveData(ValueOutput output) {
		super.addAdditionalSaveData(output);
		output.putInt("MilkCooldown", this.milkCooldown);
	}

	@Override
	protected void readAdditionalSaveData(ValueInput input) {
		super.readAdditionalSaveData(input);
		this.milkCooldown = input.getIntOr("MilkCooldown", 0);
	}
}
