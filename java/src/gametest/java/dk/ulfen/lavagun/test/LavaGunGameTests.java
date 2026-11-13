package dk.ulfen.lavagun.test;

import dk.ulfen.lavagun.Gear;
import dk.ulfen.lavagun.LavaData;
import dk.ulfen.lavagun.LavaRegistry;
import dk.ulfen.lavagun.block.LavaTankBlock;
import dk.ulfen.lavagun.entity.LavaShot;
import dk.ulfen.lavagun.entity.LavaSlug;
import dk.ulfen.lavagun.world.Encasement;
import dk.ulfen.lavagun.world.TemporaryBlocks;
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
}
