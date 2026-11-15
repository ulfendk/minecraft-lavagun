package dk.ulfen.lavagun.item;

import dk.ulfen.lavagun.LavaRegistry;
import dk.ulfen.lavagun.entity.LavaCannon;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.phys.Vec3;

/** Put the lava cannon down on the block you use it on, facing the way you look. */
public class LavaCannonItem extends Item {
	public LavaCannonItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult useOn(UseOnContext context) {
		if (!(context.getLevel() instanceof ServerLevel level)) return InteractionResult.SUCCESS;
		BlockPos pos = context.getClickedPos();
		if (!level.getBlockState(pos).getCollisionShape(level, pos).isEmpty()) pos = pos.relative(context.getClickedFace());
		Player player = context.getPlayer();
		LavaCannon cannon = new LavaCannon(LavaRegistry.LAVA_CANNON, level);
		cannon.snapTo(Vec3.atBottomCenterOf(pos), 0, 0);
		cannon.face(player != null ? player.getYRot() : 0);
		if (!level.noCollision(cannon, cannon.getBoundingBox())) return InteractionResult.FAIL;
		level.addFreshEntity(cannon);
		level.playSound(null, pos, SoundEvents.WOOD_PLACE, SoundSource.BLOCKS, 1.0F, 0.8F);
		context.getItemInHand().consume(1, player);
		return InteractionResult.SUCCESS;
	}
}
