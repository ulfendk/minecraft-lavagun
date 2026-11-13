package dk.ulfen.lavagun;

import dk.ulfen.lavagun.world.Encasement;
import dk.ulfen.lavagun.world.TemporaryBlocks;
import net.fabricmc.api.ModInitializer;

public class LavaGuns implements ModInitializer {
	public static final String MOD_ID = "lavagun";

	@Override
	public void onInitialize() {
		LavaData.rules();
		LavaRegistry.register();
		TemporaryBlocks.register();
		Encasement.register();
		Gear.register();
	}
}
