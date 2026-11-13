package dk.ulfen.lavagun.entity;

import dk.ulfen.lavagun.Lava;
import dk.ulfen.lavagun.LavaRegistry;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrowableItemProjectile;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.HitResult;

/** A thrown magma grenade: it bursts on whatever it hits, without breaking any blocks. */
public class MagmaGrenade extends ThrowableItemProjectile {
	public MagmaGrenade(EntityType<? extends MagmaGrenade> type, Level level) {
		super(type, level);
	}

	public MagmaGrenade(Level level, LivingEntity owner, ItemStack stack) {
		super(LavaRegistry.MAGMA_GRENADE_ENTITY, owner, level, stack);
	}

	@Override
	protected Item getDefaultItem() {
		return LavaRegistry.MAGMA_GRENADE;
	}

	@Override
	protected void onHit(HitResult hit) {
		super.onHit(hit);
		if (this.level() instanceof ServerLevel level) {
			Lava.burst(level, hit.getLocation(), this.damageSources().thrown(this, this.getOwner()), this.getOwner());
			this.discard();
		}
	}
}
