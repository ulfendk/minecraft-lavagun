package dk.ulfen.lavagun.item;

import dk.ulfen.lavagun.Lava;
import dk.ulfen.lavagun.LavaData;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;

/** Sets what it hits on fire. */
public class MagmasteelSwordItem extends Item {
	public MagmasteelSwordItem(Properties properties) {
		super(properties);
	}

	@Override
	public void hurtEnemy(ItemStack stack, LivingEntity target, LivingEntity attacker) {
		super.hurtEnemy(stack, target, attacker);
		if (!Lava.isFireproof(target)) target.igniteForSeconds(LavaData.rules().sword().fire());
	}
}
