package dk.ulfen.lavagun.test;

import dk.ulfen.lavagun.Gear;
import dk.ulfen.lavagun.Lava;
import dk.ulfen.lavagun.LavaData;
import dk.ulfen.lavagun.LavaRegistry;
import dk.ulfen.lavagun.block.LavaTankBlock;
import dk.ulfen.lavagun.block.VolcanoVentBlock;
import dk.ulfen.lavagun.entity.LavaCannon;
import dk.ulfen.lavagun.entity.LavaShot;
import dk.ulfen.lavagun.entity.LavaSlug;
import dk.ulfen.lavagun.world.Encasement;
import dk.ulfen.lavagun.world.TemporaryBlocks;
import dk.ulfen.lavagun.world.Volcano;
import dk.ulfen.lavagun.world.VolcanoFeature;
import net.fabricmc.fabric.api.gametest.v1.GameTest;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.EntityTypes;
import net.minecraft.world.entity.animal.pig.Pig;
import net.minecraft.world.entity.monster.Ravager;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.gamerules.GameRules;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.Vec3;

/** Server-side checks run by `./gradlew runGameTest` (and in CI). */
public class LavaGunGameTests {
	private static final String AREA = "lavagun-test:empty_large";
	/** Ticks until temporary blocks are gone: their time plus a sweep or two. */
	private static int gone(float seconds) {
		return Math.round(seconds * 20) + 15;
	}

	/** A blob from the lava gun that lands on the floor leaves lava, which is gone again a few seconds later. */
	@GameTest(structure = AREA, maxTicks = 300)
	public void blobLeavesTemporaryLava(GameTestHelper helper) {
		BlockPos floor = new BlockPos(10, 1, 10);
		LavaShot blob = new LavaShot(LavaRegistry.LAVA_BLOB, helper.getLevel());
		Vec3 at = helper.absoluteVec(Vec3.atBottomCenterOf(floor).add(0, 3, 0));
		blob.setPos(at.x, at.y, at.z);
		blob.setDeltaMovement(0, -1, 0);
		helper.getLevel().addFreshEntity(blob);
		helper.runAfterDelay(20, () -> {
			if (!helper.getBlockState(floor).is(Blocks.LAVA)) helper.fail("No lava where the blob landed: " + helper.getBlockState(floor));
		});
		helper.runAfterDelay(20 + gone(LavaData.rules().temporary().lava()), () -> {
			if (helper.getBlockState(floor).is(Blocks.LAVA) && helper.getBlockState(floor).getFluidState().isSource()) helper.fail("The lava did not go away");
			helper.succeed();
		});
	}

	/** A blob from the obsidian gun sets into obsidian where it lands, and the obsidian stays. */
	@GameTest(structure = AREA, maxTicks = 300)
	public void obsidianBlobLeavesObsidianThatStays(GameTestHelper helper) {
		BlockPos floor = new BlockPos(16, 1, 4);
		LavaShot blob = new LavaShot(LavaRegistry.OBSIDIAN_BLOB, helper.getLevel());
		Vec3 at = helper.absoluteVec(Vec3.atBottomCenterOf(floor).add(0, 3, 0));
		blob.setPos(at.x, at.y, at.z);
		blob.setDeltaMovement(0, -1, 0);
		helper.getLevel().addFreshEntity(blob);
		helper.runAfterDelay(20 + gone(LavaData.rules().temporary().lava()), () -> {
			helper.assertBlockPresent(Blocks.OBSIDIAN, floor);
			helper.assertBlockPresent(Blocks.OBSIDIAN, floor.east());
			if (TemporaryBlocks.isTemporary(helper.getLevel(), helper.absolutePos(floor))) helper.fail("The obsidian is temporary");
			helper.succeed();
		});
	}

	/** The obsidian gun's lava sets lava into obsidian too, but leaves water and stone alone. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void obsidianSetsOnLavaNotWater(GameTestHelper helper) {
		BlockPos c = new BlockPos(16, 1, 10);
		helper.setBlock(c, Blocks.LAVA);
		helper.setBlock(c.east(), Blocks.WATER);
		helper.setBlock(c.west(), Blocks.STONE);
		Lava.setObsidian(helper.getLevel(), helper.absolutePos(c), Direction.Axis.Y, null);
		helper.assertBlockPresent(Blocks.OBSIDIAN, c);
		helper.assertBlockPresent(Blocks.OBSIDIAN, c.north());
		helper.assertBlockPresent(Blocks.WATER, c.east());
		helper.assertBlockPresent(Blocks.STONE, c.west());
		helper.succeed();
	}

	/** A pig hit by the obsidian gun gets obsidian round its feet, but not where it stands. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void obsidianSetsRoundAPig(GameTestHelper helper) {
		Pig pig = helper.spawn(EntityTypes.PIG, new BlockPos(16, 1, 16));
		BlockPos feet = pig.blockPosition();
		Lava.setObsidian(helper.getLevel(), feet, Direction.Axis.Y, pig.getBoundingBox());
		if (helper.getLevel().getBlockState(feet).is(Blocks.OBSIDIAN)) helper.fail("The pig was set into the obsidian");
		if (!helper.getLevel().getBlockState(feet.east()).is(Blocks.OBSIDIAN)) helper.fail("No obsidian round the pig");
		helper.succeed();
	}

	/** The lava cannon at ranges 1 and 2: the lava lands about that far off, and stays. */
	@GameTest(structure = AREA, maxTicks = 300)
	public void cannonLavaLandsAtItsRangeAndStays(GameTestHelper helper) {
		var rules = LavaData.rules().cannon();
		for (int setting = 1; setting <= 2; setting++) {
			LavaCannon cannon = helper.spawn(LavaRegistry.LAVA_CANNON, new BlockPos(2, 1, 6 + setting * 10));
			cannon.face(-90); // east, +x
			while (cannon.range() != setting) cannon.stepRange(null);
			if (!cannon.fire(null)) helper.fail("The cannon did not fire");
		}
		helper.runAfterDelay(gone(LavaData.rules().temporary().lava()) + 40, () -> {
			for (int setting = 1; setting <= 2; setting++) {
				int range = rules.ranges().get(setting - 1);
				Integer landed = null;
				for (int dx = 2; dx <= range + 6 && landed == null; dx++)
					for (int dz = -2; dz <= 2 && landed == null; dz++)
						for (int y = 1; y <= 3 && landed == null; y++) {
							BlockPos pos = new BlockPos(2 + dx, y, 6 + setting * 10 + dz);
							var fluid = helper.getBlockState(pos).getFluidState();
							if (fluid.isSource() && helper.getBlockState(pos).is(Blocks.LAVA)) landed = dx;
						}
				if (landed == null) helper.fail("No lava from the cannon at range " + range);
				else if (Math.abs(landed - range) > 2) helper.fail("The lava landed " + landed + " blocks off, not about " + range);
			}
			helper.succeed();
		});
	}

	/** Sneak-use steps the range round 1 to 5; firing uses two lava cells and then waits. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void cannonStepsRangeAndUsesLavaCells(GameTestHelper helper) {
		LavaCannon cannon = helper.spawn(LavaRegistry.LAVA_CANNON, new BlockPos(30, 1, 30));
		int count = LavaData.rules().cannon().ranges().size();
		int start = cannon.range();
		for (int i = 0; i < count; i++) cannon.stepRange(null);
		if (cannon.range() != start) helper.fail("The range did not go round");
		ServerPlayer player = survivalPlayer(helper);
		if (cannon.fire(player)) helper.fail("Fired with no lava cells");
		player.getInventory().add(new ItemStack(LavaRegistry.LAVA_CELL, 3));
		if (!cannon.fire(player)) helper.fail("Did not fire with lava cells");
		if (player.getInventory().countItem(LavaRegistry.LAVA_CELL) != 1) helper.fail("Did not use two lava cells");
		if (cannon.fire(player)) helper.fail("Fired again at once");
		helper.succeed();
	}

	/** Only a player can break the cannon. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void cannonIgnoresOtherDamage(GameTestHelper helper) {
		LavaCannon cannon = helper.spawn(LavaRegistry.LAVA_CANNON, new BlockPos(34, 1, 30));
		cannon.hurtServer(helper.getLevel(), helper.getLevel().damageSources().lava(), 100);
		cannon.hurtServer(helper.getLevel(), helper.getLevel().damageSources().explosion(null, null), 100);
		if (!cannon.isAlive() || cannon.getHealth() < cannon.getMaxHealth()) helper.fail("The cannon was hurt by lava or an explosion");
		helper.succeed();
	}

	/** A pig hit by the lava gun is shut in obsidian, and let out (and the obsidian gone) after the shell's time. */
	@GameTest(structure = AREA, maxTicks = 200)
	public void pigIsShutInAndLetOut(GameTestHelper helper) {
		Pig pig = helper.spawn(EntityTypes.PIG, new BlockPos(5, 1, 5));
		helper.runAfterDelay(2, () -> {
			if (!Encasement.encase(helper.getLevel(), pig)) helper.fail("The pig was not shut in");
			BlockPos side = pig.blockPosition().east();
			if (!helper.getLevel().getBlockState(side).is(Blocks.OBSIDIAN)) helper.fail("No obsidian next to the pig");
		});
		helper.runAfterDelay(2 + gone(LavaData.rules().temporary().shell()), () -> {
			if (Encasement.isHeld(pig)) helper.fail("The pig is still held");
			if (helper.getLevel().getBlockState(pig.blockPosition().east()).is(Blocks.OBSIDIAN)) helper.fail("The obsidian is still there");
			if (!pig.isAlive()) helper.fail("The pig did not survive being shut in");
			helper.succeed();
		});
	}

	/** Too big to shut in. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void ravagerIsNotShutIn(GameTestHelper helper) {
		Ravager ravager = helper.spawn(EntityTypes.RAVAGER, new BlockPos(5, 1, 5));
		if (Encasement.encase(helper.getLevel(), ravager)) helper.fail("The ravager was shut in");
		helper.succeed();
	}

	/** With mobGriefing off nothing is built: the mob is only frozen (toggled within one tick: tests run in parallel). */
	@GameTest(structure = AREA, maxTicks = 20)
	public void noObsidianWithoutMobGriefing(GameTestHelper helper) {
		Pig pig = helper.spawn(EntityTypes.PIG, new BlockPos(5, 1, 5));
		var rules = helper.getLevel().getGameRules();
		rules.set(GameRules.MOB_GRIEFING, false, helper.getLevel().getServer());
		boolean held = Encasement.encase(helper.getLevel(), pig);
		rules.set(GameRules.MOB_GRIEFING, true, helper.getLevel().getServer());
		if (!held) helper.fail("The pig was not frozen");
		if (helper.getLevel().getBlockState(pig.blockPosition().east()).is(Blocks.OBSIDIAN)) helper.fail("Obsidian was placed without mobGriefing");
		helper.succeed();
	}

	/** Mining a temporary block gives nothing. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void temporaryObsidianDropsNothing(GameTestHelper helper) {
		BlockPos pos = new BlockPos(3, 1, 3);
		TemporaryBlocks.place(helper.getLevel(), helper.absolutePos(pos), Blocks.OBSIDIAN, 5);
		ServerPlayer player = survivalPlayer(helper);
		// A diamond pickaxe would normally get the obsidian.
		player.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(Items.DIAMOND_PICKAXE));
		player.gameMode.destroyBlock(helper.absolutePos(pos));
		helper.assertBlockPresent(Blocks.AIR, pos);
		helper.assertItemEntityNotPresent(Items.OBSIDIAN);
		helper.succeed();
	}

	/** A mock player in survival (in creative, buckets aren't used up and ores aren't smelted). */
	@SuppressWarnings("removal")
	private static ServerPlayer survivalPlayer(GameTestHelper helper) {
		ServerPlayer player = helper.makeMockServerPlayerInLevel();
		player.setGameMode(GameType.SURVIVAL);
		return player;
	}

	/** The tank: lava in with a bucket, lava cells out with iron ingots. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void tankFillsAndMakesCells(GameTestHelper helper) {
		BlockPos pos = new BlockPos(4, 1, 4);
		helper.setBlock(pos, LavaRegistry.LAVA_TANK);
		ServerPlayer player = survivalPlayer(helper);
		BlockPos abs = helper.absolutePos(pos);
		BlockHitResult hit = new BlockHitResult(Vec3.atCenterOf(abs), Direction.UP, abs, false);
		player.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(Items.LAVA_BUCKET));
		helper.getLevel().getBlockState(abs).useItemOn(player.getMainHandItem(), helper.getLevel(), player, InteractionHand.MAIN_HAND, hit);
		if (helper.getLevel().getBlockState(abs).getValue(LavaTankBlock.BUCKETS) != 1) helper.fail("The lava did not go into the tank");
		if (!player.getMainHandItem().is(Items.BUCKET)) helper.fail("No empty bucket back");
		player.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(Items.IRON_INGOT, 4));
		helper.getLevel().getBlockState(abs).useItemOn(player.getMainHandItem(), helper.getLevel(), player, InteractionHand.MAIN_HAND, hit);
		if (helper.getLevel().getBlockState(abs).getValue(LavaTankBlock.BUCKETS) != 0) helper.fail("The tank was not emptied");
		if (!player.getInventory().hasAnyMatching(s -> s.is(LavaRegistry.LAVA_CELL) && s.getCount() == LavaData.rules().tank().cellsPerBucket())) {
			helper.fail("No lava cells");
		}
		helper.succeed();
	}

	/** The magmasteel pickaxe melts iron ore into an ingot. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void pickaxeSmeltsIronOre(GameTestHelper helper) {
		BlockPos pos = new BlockPos(6, 1, 6);
		helper.setBlock(pos, Blocks.IRON_ORE);
		ServerPlayer player = survivalPlayer(helper);
		player.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(LavaRegistry.MAGMASTEEL_PICKAXE));
		player.gameMode.destroyBlock(helper.absolutePos(pos));
		helper.assertBlockPresent(Blocks.AIR, pos);
		helper.assertItemEntityPresent(Gear.smelted(Blocks.IRON_ORE));
		helper.assertItemEntityNotPresent(Items.RAW_IRON);
		helper.succeed();
	}

	/** A lava slug fills a bucket, and then not again for a while. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void slugFillsABucket(GameTestHelper helper) {
		LavaSlug slug = helper.spawn(LavaRegistry.LAVA_SLUG, new BlockPos(7, 1, 7));
		ServerPlayer player = survivalPlayer(helper);
		player.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(Items.BUCKET));
		player.interactOn(slug, InteractionHand.MAIN_HAND, slug.position());
		if (!player.getMainHandItem().is(Items.LAVA_BUCKET)) helper.fail("No lava bucket: " + player.getMainHandItem());
		if (slug.canFillBucket()) helper.fail("The slug can fill another bucket at once");
		helper.succeed();
	}

	/** Both creatures can be spawned and are fire-proof. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void creaturesSpawn(GameTestHelper helper) {
		var golem = helper.spawn(LavaRegistry.MAGMA_GOLEM, new BlockPos(12, 1, 12));
		var slug = helper.spawn(LavaRegistry.LAVA_SLUG, new BlockPos(14, 1, 14));
		if (!golem.fireImmune() || !slug.fireImmune()) helper.fail("The creatures are not fire-proof");
		if (golem.getBbHeight() < 2.5F) helper.fail("The golem is only " + golem.getBbHeight() + " blocks tall");
		helper.succeed();
	}

	// ---------------------------------------------------------------- volcanoes

	/** The middle of the test area, on its floor: a volcano fits round it. */
	private static final BlockPos VOLCANO = new BlockPos(20, 1, 20);

	private static int floor() {
		var v = LavaData.rules().volcano();
		return v.height() - v.crater().depth();
	}

	/** A volcano vent put down grows a volcano round itself, with a lake of lava in its crater. */
	@GameTest(structure = AREA, maxTicks = 100)
	public void ventGrowsVolcano(GameTestHelper helper) {
		helper.setBlock(VOLCANO, LavaRegistry.VOLCANO_VENT);
		helper.runAfterDelay(50, () -> {
			BlockPos vent = VOLCANO.above(floor());
			helper.assertBlockPresent(LavaRegistry.VOLCANO_VENT, vent);
			if (!helper.getBlockState(vent).getValue(VolcanoVentBlock.GROWN)) helper.fail("The vent has not grown");
			helper.assertBlockPresent(Blocks.LAVA, vent.above());
			if (helper.getBlockState(VOLCANO.offset(8, 0, 0)).isAir()) helper.fail("The volcano has no side");
			if (helper.getBlockState(VOLCANO.offset(0, 0, 0)).is(LavaRegistry.VOLCANO_VENT)) helper.fail("The vent is still on the ground");
			helper.succeed();
		});
	}

	/** Lava runs out over the notch in the rim and down the side. */
	@GameTest(structure = AREA, maxTicks = 300)
	public void volcanoLavaRunsOver(GameTestHelper helper) {
		Volcano.build(helper.getLevel(), helper.absolutePos(VOLCANO), 1);
		int cR = LavaData.rules().volcano().crater().radius();
		helper.succeedWhen(() -> {
			for (int dx = -15; dx <= 15; dx++)
				for (int dz = -15; dz <= 15; dz++) {
					if (Math.hypot(dx, dz) < cR + 1) continue;
					for (int y = 0; y < floor() + 3; y++) {
						if (helper.getBlockState(VOLCANO.offset(dx, y, dz)).is(Blocks.LAVA)) return;
					}
				}
			helper.fail("No lava outside the crater");
		});
	}

	/** Take the lava out of the crater and the vent puts it back. */
	@GameTest(structure = AREA, maxTicks = 200)
	public void ventRefillsCrater(GameTestHelper helper) {
		Volcano.build(helper.getLevel(), helper.absolutePos(VOLCANO), 2);
		BlockPos lake = VOLCANO.above(floor() + 1);
		helper.runAfterDelay(5, () -> helper.setBlock(lake, Blocks.AIR));
		helper.runAfterDelay(10, () -> helper.succeedWhen(() -> {
			if (!helper.getBlockState(lake).is(Blocks.LAVA) || !helper.getBlockState(lake).getFluidState().isSource()) helper.fail("The crater was not filled again");
		}));
	}

	/** The volcano feature builds a volcano on the ground it is given. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void featureBuildsVolcano(GameTestHelper helper) {
		var level = helper.getLevel();
		if (!new VolcanoFeature().place(level, level.getChunkSource().getGenerator(), level.getRandom(), helper.absolutePos(VOLCANO))) {
			helper.fail("The feature placed nothing");
		}
		helper.assertBlockPresent(LavaRegistry.VOLCANO_VENT, VOLCANO.above(floor()));
		helper.assertBlockPresent(Blocks.LAVA, VOLCANO.above(floor() + 1));
		helper.succeed();
	}

	/** A lava bomb lands as magma or basalt, and it stays. */
	@GameTest(structure = AREA, maxTicks = 400)
	public void bombLeavesRubbleThatStays(GameTestHelper helper) {
		Volcano.throwBomb(helper.getLevel(), helper.absolutePos(VOLCANO), 6);
		helper.runAfterDelay(60 + gone(LavaData.rules().temporary().lava()), () -> {
			for (int dx = -16; dx <= 16; dx++)
				for (int dz = -16; dz <= 16; dz++)
					for (int y = 1; y <= 2; y++) {
						BlockPos p = VOLCANO.offset(dx, y - 1, dz);
						var state = helper.getBlockState(p);
						if (!state.is(Blocks.MAGMA_BLOCK) && !state.is(Blocks.BASALT)) continue;
						if (TemporaryBlocks.isTemporary(helper.getLevel(), helper.absolutePos(p))) helper.fail("The rubble is temporary");
						helper.succeed();
						return;
					}
			helper.fail("The bomb left no rubble");
		});
	}

	/** With mobGriefing off a bomb leaves nothing. */
	@GameTest(structure = AREA, maxTicks = 20)
	public void noRubbleWithoutMobGriefing(GameTestHelper helper) {
		var rules = helper.getLevel().getGameRules();
		rules.set(GameRules.MOB_GRIEFING, false, helper.getLevel().getServer());
		Volcano.rubble(helper.getLevel(), helper.absolutePos(VOLCANO));
		rules.set(GameRules.MOB_GRIEFING, true, helper.getLevel().getServer());
		helper.assertBlockPresent(Blocks.AIR, VOLCANO);
		helper.succeed();
	}
}
