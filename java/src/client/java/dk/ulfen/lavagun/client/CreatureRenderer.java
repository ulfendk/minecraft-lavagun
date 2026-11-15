package dk.ulfen.lavagun.client;

import com.geckolib.animatable.GeoEntity;
import com.geckolib.model.DefaultedEntityGeoModel;
import com.geckolib.renderer.GeoEntityRenderer;

import dk.ulfen.lavagun.LavaRegistry;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;
import net.minecraft.world.entity.Mob;

/** Draws a creature (or the lava cannon) with GeckoLib from geckolib/models/entity/<id>.geo.json and friends (generated from the Bedrock model). */
public class CreatureRenderer<T extends Mob & GeoEntity> extends GeoEntityRenderer<T, LivingEntityRenderState> {
	public CreatureRenderer(EntityRendererProvider.Context context, String id, float shadow) {
		super(context, new DefaultedEntityGeoModel<>(LavaRegistry.id(id)));
		this.shadowRadius = shadow;
	}
}
