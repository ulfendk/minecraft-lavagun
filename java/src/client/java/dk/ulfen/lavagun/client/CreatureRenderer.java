package dk.ulfen.lavagun.client;

import com.geckolib.model.DefaultedEntityGeoModel;
import com.geckolib.renderer.GeoEntityRenderer;

import dk.ulfen.lavagun.LavaRegistry;
import dk.ulfen.lavagun.entity.LavaCreature;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;

/** Draws a creature with GeckoLib from geckolib/models/entity/<id>.geo.json and friends (generated from the Bedrock model). */
public class CreatureRenderer<T extends LavaCreature> extends GeoEntityRenderer<T, LivingEntityRenderState> {
	public CreatureRenderer(EntityRendererProvider.Context context, String id, float shadow) {
		super(context, new DefaultedEntityGeoModel<>(LavaRegistry.id(id)));
		this.shadowRadius = shadow;
	}
}
