package dk.ulfen.lavagun;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

/**
 * The numbers shared with the Bedrock add-on, generated from src/rules.mjs and
 * src/creatures.mjs into data/lavagun/{rules,creatures}.json by tools/java.mjs.
 * Field names match the JSON.
 */
public final class LavaData {
	public record Rules(Map<String, Gun> guns, Sprayer sprayer, Grenade grenade, Sword sword, Golem golem, Temporary temporary,
		Shell shell, List<String> fireproof, Tank tank, Slug slug, Armor armor) {}

	public record Gun(String ammo, int ammoPerShot, String projectile, float cooldown, float speed, float gravity, float damage, int fire,
		boolean encase, Splash splash, Obsidian obsidian) {}

	public record Splash(float radius, float damage, int fire, boolean lava) {}

	/** The obsidian gun: lava that sets into obsidian, in a disc of this radius. */
	public record Obsidian(int radius) {}

	public record Sprayer(String id, String ammo, float range, float cone, int pulseTicks, float damage, int fire, int ticksPerCharge) {}

	public record Grenade(String id, float damage, float radius, int fire, int ring) {}

	public record Sword(int fire) {}

	public record Golem(float slam, float slamRadius, int slamLava) {}

	public record Temporary(float lava, float shell, float walker) {}

	public record Shell(int maxWidth, int maxHeight, float immunity, int burnAfter, List<String> exempt) {}

	public record Tank(int capacity, int stages, int cellsPerBucket) {}

	public record Slug(int milkCooldown) {}

	public record Armor(int walkerRadius) {}

	public record Creature(String id, float width, float height, double health, double speed, double attack, double knockbackResistance,
		double followRange, int xp, List<String> animations, Sounds sounds, Spawn spawn) {}

	public record Sounds(String ambient, String hurt, String death, String step, float pitchMin, float pitchMax) {}

	public record Spawn(List<String> biomes, int weight, int min, int max) {}

	private static Rules rules;
	private static Map<String, Creature> creatures;

	private LavaData() {}

	private static <T> T read(String file, Type type) {
		try (InputStream in = LavaData.class.getResourceAsStream("/data/lavagun/" + file)) {
			if (in == null) throw new IllegalStateException(file + " missing from the mod jar (run `npm run build`)");
			return new Gson().fromJson(new InputStreamReader(in, StandardCharsets.UTF_8), type);
		} catch (IOException e) {
			throw new IllegalStateException("Could not read " + file, e);
		}
	}

	public static Rules rules() {
		if (rules == null) rules = read("rules.json", Rules.class);
		return rules;
	}

	public static Creature creature(String id) {
		if (creatures == null) {
			List<Creature> list = read("creatures.json", new TypeToken<List<Creature>>() {}.getType());
			creatures = new java.util.HashMap<>();
			for (Creature c : list) creatures.put(c.id(), c);
		}
		Creature c = creatures.get(id);
		if (c == null) throw new IllegalArgumentException("No creature " + id + " in creatures.json");
		return c;
	}
}
