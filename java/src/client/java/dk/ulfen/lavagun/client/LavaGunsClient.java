package dk.ulfen.lavagun.client;

import dk.ulfen.lavagun.LavaRegistry;
import net.fabricmc.api.ClientModInitializer;
import net.minecraft.client.renderer.entity.EntityRenderers;
import net.minecraft.client.renderer.entity.ThrownItemRenderer;

public class LavaGunsClient implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
		EntityRenderers.register(LavaRegistry.MAGMA_GOLEM, ctx -> new CreatureRenderer<>(ctx, "magma_golem", 0.8F));
		EntityRenderers.register(LavaRegistry.LAVA_SLUG, ctx -> new CreatureRenderer<>(ctx, "lava_slug", 0.3F));
		EntityRenderers.register(LavaRegistry.LAVA_CANNON, ctx -> new CreatureRenderer<>(ctx, "lava_cannon", 0.9F));
		// The shots look like the item they are made of.
		EntityRenderers.register(LavaRegistry.LAVA_BOLT, ThrownItemRenderer::new);
		EntityRenderers.register(LavaRegistry.LAVA_BLOB, ThrownItemRenderer::new);
		EntityRenderers.register(LavaRegistry.OBSIDIAN_BLOB, ThrownItemRenderer::new);
		EntityRenderers.register(LavaRegistry.LAVA_BALL, ThrownItemRenderer::new);
		EntityRenderers.register(LavaRegistry.MAGMA_GRENADE_ENTITY, ThrownItemRenderer::new);
	}
}
