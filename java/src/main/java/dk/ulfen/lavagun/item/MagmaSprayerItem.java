package dk.ulfen.lavagun.item;

import dk.ulfen.lavagun.Lava;
import dk.ulfen.lavagun.LavaData;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemUseAnimation;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.BaseFireBlock;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;

/** Hold it down to spray fire a few blocks ahead. Burns magma charges as it goes. */
public class MagmaSprayerItem extends Item {
	public MagmaSprayerItem(Properties properties) {
		super(properties);
	}

	@Override
	public ItemUseAnimation getUseAnimation(ItemStack stack) {
		return ItemUseAnimation.BOW;
	}

	@Override
	public int getUseDuration(ItemStack stack, LivingEntity user) {
		return 72000;
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		Item ammo = LavaGunItem.item(LavaData.rules().sprayer().ammo());
		if (!player.hasInfiniteMaterials() && !player.getInventory().hasAnyMatching(s -> s.is(ammo))) {
			if (!level.isClientSide()) player.sendOverlayMessage(Component.translatable("lavagun.hud.no_ammo", Component.translatable(ammo.getDescriptionId())));
			return InteractionResult.FAIL;
		}
		player.startUsingItem(hand);
		return InteractionResult.CONSUME;
	}

	@Override
	public void onUseTick(Level level, LivingEntity user, ItemStack stack, int remaining) {
		LavaData.Sprayer r = LavaData.rules().sprayer();
		int used = getUseDuration(stack, user) - remaining;
		if (!(level instanceof ServerLevel server) || !(user instanceof Player player) || used % r.pulseTicks() != 0) return;
		// A new charge every couple of seconds of spraying.
		if (used % r.ticksPerCharge() == 0) {
			if (!LavaGunItem.takeAmmo(player, LavaGunItem.item(r.ammo()), 1)) {
				player.stopUsingItem();
				return;
			}
			stack.hurtAndBreak(1, player, player.getUsedItemHand() == InteractionHand.OFF_HAND ? EquipmentSlot.OFFHAND : EquipmentSlot.MAINHAND);
		}
		Vec3 eye = player.getEyePosition();
		Vec3 dir = player.getLookAngle();
		for (double k = 1; k <= r.range(); k += 0.75) {
			Vec3 p = eye.add(dir.scale(k));
			server.sendParticles(ParticleTypes.FLAME, p.x, p.y - 0.2, p.z, 2, 0.08 * k, 0.08 * k, 0.08 * k, 0.01);
		}
		if (used % 12 == 0) level.playSound(null, player.blockPosition(), SoundEvents.GHAST_SHOOT, SoundSource.PLAYERS, 0.4F, 1.6F);
		double cos = Math.cos(Math.toRadians(r.cone()));
		var source = player.damageSources().playerAttack(player);
		for (Entity e : level.getEntities(player, new AABB(eye, eye).inflate(r.range() + 1), e -> Lava.mayHurt(server, e, player))) {
			Vec3 to = e.position().add(0, e.getBbHeight() / 2, 0).subtract(eye);
			double d = to.length();
			if (d > r.range() || (d > 0.75 && to.normalize().dot(dir) < cos)) continue;
			Lava.hurt(server, e, source, r.damage(), r.fire());
		}
		// Sets the ground alight, like flint and steel would.
		if (used % 20 == 0 && Lava.mayGrief(server)) {
			BlockHitResult hit = level.clip(new ClipContext(eye, eye.add(dir.scale(r.range())), ClipContext.Block.OUTLINE, ClipContext.Fluid.NONE, player));
			if (hit.getType() == HitResult.Type.BLOCK) {
				BlockPos above = hit.getBlockPos().above();
				if (level.getBlockState(above).isAir() && BaseFireBlock.canBePlacedAt(level, above, net.minecraft.core.Direction.UP)) {
					level.setBlockAndUpdate(above, BaseFireBlock.getState(level, above));
				}
			}
		}
	}
}
