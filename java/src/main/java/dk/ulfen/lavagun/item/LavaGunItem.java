package dk.ulfen.lavagun.item;

import dk.ulfen.lavagun.LavaData;
import dk.ulfen.lavagun.LavaRegistry;
import dk.ulfen.lavagun.entity.LavaShot;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;

/** The lava pistol, the lava gun and the obsidian gun: use to fire a shot, paid for with lava cells from your inventory. */
public class LavaGunItem extends Item {
	private final String gunId;

	public LavaGunItem(Properties properties, String gunId) {
		super(properties);
		this.gunId = gunId;
	}

	private LavaData.Gun gun() {
		return LavaData.rules().guns().get(gunId);
	}

	/** Take `n` of an item from the player's inventory, or nothing if they have fewer. */
	public static boolean takeAmmo(Player player, Item ammo, int n) {
		if (player.hasInfiniteMaterials()) return true;
		var inv = player.getInventory();
		int have = 0;
		for (int i = 0; i < inv.getContainerSize(); i++) if (inv.getItem(i).is(ammo)) have += inv.getItem(i).getCount();
		if (have < n) return false;
		for (int i = 0; i < inv.getContainerSize() && n > 0; i++) {
			ItemStack s = inv.getItem(i);
			if (!s.is(ammo)) continue;
			int take = Math.min(n, s.getCount());
			s.shrink(take);
			n -= take;
		}
		return true;
	}

	static Item item(String id) {
		return BuiltInRegistries.ITEM.getValue(LavaRegistry.id(id));
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);
		LavaData.Gun g = gun();
		if (player.getCooldowns().isOnCooldown(stack)) return InteractionResult.FAIL;
		Item ammo = item(g.ammo());
		if (!takeAmmo(player, ammo, g.ammoPerShot())) {
			if (!level.isClientSide()) {
				player.sendOverlayMessage(Component.translatable("lavagun.hud.no_ammo", Component.translatable(ammo.getDescriptionId())));
			}
			level.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.DISPENSER_FAIL, SoundSource.PLAYERS, 0.6F, 1.6F);
			return InteractionResult.FAIL;
		}
		if (level instanceof ServerLevel server) {
			@SuppressWarnings("unchecked")
			EntityType<LavaShot> type = (EntityType<LavaShot>) BuiltInRegistries.ENTITY_TYPE.getValue(LavaRegistry.id(g.projectile()));
			// The shot looks like what it is made of; the obsidian gun's like what it turns into.
			ItemStack looks = new ItemStack(g.obsidian() != null ? Items.OBSIDIAN : ammo);
			Projectile.spawnProjectileFromRotation((lvl, owner, s) -> new LavaShot(type, lvl, owner, s), server, looks, player, 0.0F, g.speed(), 0.5F);
			stack.hurtAndBreak(1, player, hand == InteractionHand.OFF_HAND ? EquipmentSlot.OFFHAND : EquipmentSlot.MAINHAND);
		}
		player.getCooldowns().addCooldown(stack, Math.round(g.cooldown() * 20));
		level.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.BLAZE_SHOOT, SoundSource.PLAYERS, 0.8F, "lava_pistol".equals(gunId) ? 1.3F : 0.6F);
		return InteractionResult.SUCCESS;
	}

	public static Identifier idOf(Item item) {
		return BuiltInRegistries.ITEM.getKey(item);
	}
}
