// In-game texts (both editions) and website texts, in English and Danish.
// Item, block and creature names live with their specs as [English, Danish].
import { NS } from './lib/constants.mjs';
import { cannon } from './cannon.mjs';

export const LOCALES = ['en_US', 'da_DK'];
const IDX = { en_US: 0, da_DK: 1 };

const GAME = {
  description: ['Lava guns, magmasteel gear, lava lamps and tanks, and magma creatures.', 'Lavakanoner, magmastålsudstyr, lavalamper og -tanke og magmavæsner.'],
  itemGroup: ['Lava Guns', 'Lavakanoner'],
  // Projectiles: shown in death messages.
  lava_bolt: ['Lava Bolt', 'Lavaskud'],
  lava_blob: ['Lava Blob', 'Lavaklump'],
  obsidian_blob: ['Obsidian Blob', 'Obsidianklump'],
  lava_ball: ['Lava Ball', 'Lavakugle'],
  magma_grenade: ['Magma Grenade', 'Magmagranat'],
  no_ammo: ['Out of %s', 'Ikke mere %s'],
  encased: ['Shut in obsidian!', 'Lukket inde i obsidian!'],
  tank: ['Lava tank: %s of %s buckets', 'Lavatank: %s af %s spande'],
  tank_full: ['The lava tank is full', 'Lavatanken er fuld'],
  tank_empty: ['The lava tank is empty', 'Lavatanken er tom'],
  fill_bucket: ['Fill Bucket', 'Fyld spand'],
  fire: ['Fire', 'Fyr'],
  range: ['Range %s: about %s blocks', 'Rækkevidde %s: cirka %s blokke'],
};

/** Bedrock .lang entries as [key, value] pairs (tools/java.mjs converts them for Java). */
export function langEntries(locale, { items, blocks, creatures, projectiles, version }) {
  const i = IDX[locale];
  const g = (k) => GAME[k][i];
  return [
    ['pack.description', `${g('description')} v${version}`],
    ...creatures.flatMap((c) => [
      [`entity.${NS}:${c.id}.name`, c.name[i]],
      [`item.spawn_egg.entity.${NS}:${c.id}.name`, i ? `${c.name[i]}-spawnæg` : `${c.name[i]} Spawn Egg`],
    ]),
    ...projectiles.map((p) => [`entity.${NS}:${p.id}.name`, g(p.id)]),
    [`entity.${NS}:${cannon.id}.name`, cannon.name[i]],
    ...items.map((it) => [`item.${NS}:${it.id}.name`, it.name[i]]),
    ...blocks.map((b) => [`tile.${NS}:${b.id}.name`, b.name[i]]),
    [`${NS}.hud.no_ammo`, g('no_ammo')],
    [`${NS}.hud.encased`, g('encased')],
    [`${NS}.hud.tank`, g('tank')],
    [`${NS}.hud.tank_full`, g('tank_full')],
    [`${NS}.hud.tank_empty`, g('tank_empty')],
    [`action.interact.${NS}.fill_bucket`, g('fill_bucket')],
    [`action.interact.${NS}.fire`, g('fire')],
    [`${NS}.hud.range`, g('range')],
    [`itemGroup.${NS}`, g('itemGroup')],
  ];
}

// ---------------------------------------------------------------- website

export const LANGUAGES = {
  en: { label: 'English', dir: '', htmlLang: 'en', dateLocale: 'en-GB' },
  da: { label: 'Dansk', dir: 'da', htmlLang: 'da', dateLocale: 'da-DK' },
};

const en = {
  allMods: 'All our mods',
  name: 'Lava Guns',
  title: 'Lava Guns – Minecraft add-on and mod',
  description: 'Lava guns for Minecraft Bedrock and Java Edition: a lava pistol, a lava gun that shuts mobs in obsidian, an obsidian gun that builds with lasting obsidian, a lava cannon, a magma sprayer and grenades, magmasteel tools and armour, lava lamps, lava tanks and magma creatures. Free download.',
  tagline: 'A lava pistol, a lava gun that shuts mobs in obsidian, an obsidian gun that builds with lasting obsidian, a lava cannon, a magma sprayer and magma grenades. Forge magmasteel tools and armour, light your base with lava lamps, keep lava in a tank – and meet the magma golems of the Nether.',
  download: 'iPad, phone, console & Windows: Bedrock',
  downloadJava: 'Mac & PC: Java Edition',
  which: '<b>Which one do I need?</b> Playing on an <b>iPad</b>, iPhone, Android, Xbox, PlayStation, Switch or Minecraft for Windows? That is <b>Bedrock Edition</b> – take the first download. Playing on a computer with the Minecraft <b>Java Edition</b> launcher (Mac, Windows or Linux)? Take the Java download. Not sure? If you bought Minecraft in the App Store or Google Play, it is Bedrock.',
  bedrockTitle: 'Install on iPad, phone, console or Windows (Bedrock)',
  javaTitle: 'Install on Mac or PC (Java Edition)',
  steps: (link) => [
    `<strong>Download</strong> ${link} on your Windows PC, Android phone or tablet, or iPhone or iPad.`,
    '<strong>Open the file.</strong> Minecraft starts and imports both packs.',
    '<strong>Create or edit a world.</strong> Under <em>Behavior Packs</em>, turn on <em>Lava Guns</em>. The resource pack is added automatically.',
    '<strong>Find everything</strong> in the creative inventory, or craft it: a lava bucket and four iron ingots make eight lava cells.',
  ],
  javaSteps: (jar, fabric, api, gecko) => [
    `<strong>Install</strong> ${fabric} for Minecraft 26.3.`,
    `<strong>Download</strong> ${jar}, plus ${api} and ${gecko}.`,
    '<strong>Put all three files</strong> in your <em>mods</em> folder and start Minecraft with the Fabric profile.',
    '<strong>Find everything</strong> in the <em>Lava Guns</em> creative tab, or craft it.',
  ],
  serverNote: (bp, rp) => `Running a server? Use the separate ${bp('behavior pack')} and ${rp('resource pack')}. Xbox, PlayStation and Switch can’t import add-ons from files, but you can join a world or Realm that has the add-on.`,
  upgradeTitle: 'Upgrading to a new version',
  upgradeSteps: [
    '<strong>Download the new version</strong> and open the file. A newer version replaces the one you have, and your worlds use it the next time you load them.',
    '<strong>Still running the old version?</strong> (or Minecraft says it is already installed): go to <em>Settings → Storage</em>, delete Lava Guns under both <em>Resource Packs</em> and <em>Behavior Packs</em>, then open the new file again.',
    '<strong>Check the world:</strong> in the world’s <em>Edit</em> screen, under <em>Behavior Packs</em> and <em>Resource Packs</em>, make sure Lava Guns is active. A world you imported or downloaded can carry its own old copy: deactivate it there, save, and activate the new one.',
  ],
  upgradeServer: 'On a server, replace the add-on’s folders in <em>behavior_packs</em> and <em>resource_packs</em> with the new ones and restart it.',
  upgradeJava: 'Delete the old Lava Guns jar from your <em>mods</em> folder and put the new one in its place. Keep only one version in the folder. If the new version needs a newer Fabric API or GeckoLib, update those too.',
  allVersions: 'All versions',
  latestVersion: 'Latest version',
  released: 'released',
  install: 'Install',

  gunsTitle: 'Lava guns',
  gunsLede: 'Every gun runs on ammunition from your inventory. Damage is in hearts.',
  guns: {
    lava_pistol: 'A quick bolt of lava. Fast to fire, sets the target on fire. Uses one lava cell a shot.',
    lava_gun: 'A heavy blob of lava. Hit a mob and it is shut in a shell of obsidian for 5 seconds, then burns. Miss, and it splashes lava where it lands. Uses two lava cells a shot.',
    obsidian_gun: 'Fires lava that sets into obsidian where it lands – and the obsidian stays. Build walls and bridges, or plug a lava lake. A mob that is hit burns, and the obsidian sets at its feet. Uses two lava cells a shot.',
    lava_cannon: 'A fat medieval cannon. Put it down and use it: it turns to where you look and fires a ball of lava, and the lava stays where it lands. Sneak and use it to pick the range from 1 to 5 – 8 to 40 blocks. Uses two lava cells a shot.',
    magma_sprayer: 'Hold it down to spray fire up to 6 blocks ahead. One magma charge lasts 2 seconds.',
    magma_grenade: 'Throw it. It bursts into a ring of lava and burns everything nearby – without breaking any blocks.',
  },
  statDamage: 'Damage',
  statFire: 'Burns',
  statAmmo: 'Ammo',
  statRange: 'Range',
  blockRange: (a, b) => `${a}–${b} blocks`,
  seconds: (n) => `${n} s`,
  hearts: (n) => `${n / 2} ♥`,
  perSecond: (n) => `${n / 2} ♥ a second`,
  shellTitle: 'The obsidian shell',
  shell: [
    ['5 seconds', 'A direct hit from the lava gun builds a hollow shell of obsidian around the mob. It stands in the air inside, so it does not suffocate, and cannot move.'],
    ['Then it burns', 'When the shell is gone the mob burns for 5 seconds. Fire-proof mobs like blazes and magma cubes only take the hit.'],
    ['Not the big ones', 'The Ender Dragon, the Wither, the Warden, ravagers and ghasts are too big to shut in. A mob that has just got out cannot be shut in again for 3 seconds.'],
    ['Nothing to keep', 'The obsidian disappears by itself. Mining it early gives you nothing.'],
  ],
  lavaTitle: 'Lava that goes away again',
  lava: [
    ['Temporary lava', 'Lava from the lava gun, the grenades and the magma golem disappears after 6 seconds. It only goes where there is air, grass or flowers.'],
    ['mobGriefing', 'With the game rule <em>mobGriefing</em> off, no lava and no obsidian is placed. The guns still hit and burn, and the lava gun freezes a mob in place for 5 seconds instead.'],
    ['PvP', 'The guns only hurt other players when PvP is on.'],
  ],
  gearTitle: 'Magmasteel',
  gearLede: 'Iron, magma cream and blaze powder make a magmasteel ingot. It is a little better than diamond, and it never stops being hot.',
  gear: [
    ['Sword', 'Sets what it hits on fire for 4 seconds.'],
    ['Pickaxe', 'Melts ores as you mine them: iron, gold and copper ore drop ingots, sand drops glass, cobblestone drops stone.'],
    ['Axe and shovel', 'As fast as diamond tools, and they last longer.'],
    ['Full armour', 'Wear all four pieces and you are immune to fire and lava.'],
    ['Lava walker boots', 'Lava under your feet hardens into basalt while you walk on it, and melts back 4 seconds later.'],
  ],
  blocksTitle: 'Blocks',
  blocks: [
    ['Lava lamps', 'Bubbling lamps in four colours that light up like a glowstone block.'],
    ['Lava tank', 'Holds 12 buckets of lava. Pour lava in with a bucket and take it out with an empty bucket. Use 4 iron ingots on it to turn a bucket of its lava into 8 lava cells.'],
    ['Magma blocks', 'Magma bricks, polished and chiseled magma and blocks of magmasteel glow softly – and unlike magma blocks, they don’t burn your feet.'],
  ],
  creaturesTitle: 'Creatures of the Nether',
  creatures: {
    magma_golem: 'Three blocks tall and made of cooling lava. It leaves you alone – until you hit it. Then it slams the ground hard enough to split it with lava. It drops the magma core you need for the lava gun.',
    lava_slug: 'A slow, harmless slug full of lava. Use an empty bucket on it to fill the bucket with lava (once every 5 minutes). Drops magma cream.',
  },
  itemsTitle: 'Everything in the add-on',
  footerSource: (src, issues) => `Lava Guns is free and open source. ${src('Source code on GitHub')} · ${issues('Report a problem')}`,
  footerLegal: 'Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.',
};

const da = {
  allMods: 'Alle vores mods',
  name: 'Lavakanoner',
  title: 'Lavakanoner – tilføjelse og mod til Minecraft',
  description: 'Lavakanoner til Minecraft Bedrock og Java Edition: en lavapistol, en lavakanon, der lukker væsner inde i obsidian, en obsidiankanon, der bygger med obsidian, som bliver, en lavabombarde, en magmasprøjte og granater, værktøj og rustning af magmastål, lavalamper, lavatanke og magmavæsner. Gratis download.',
  tagline: 'En lavapistol, en lavakanon, der lukker væsner inde i obsidian, en obsidiankanon, der bygger med obsidian, som bliver, en lavabombarde, en magmasprøjte og magmagranater. Smed værktøj og rustning af magmastål, oplys din base med lavalamper, gem lava i en tank – og mød Nethers magmagolemmer.',
  download: 'iPad, telefon, konsol & Windows: Bedrock',
  downloadJava: 'Mac & pc: Java Edition',
  which: '<b>Hvilken skal jeg bruge?</b> Spiller du på <b>iPad</b>, iPhone, Android, Xbox, PlayStation, Switch eller Minecraft til Windows? Så er det <b>Bedrock Edition</b> – tag den første download. Spiller du på en computer med Minecraft <b>Java Edition</b>-launcheren (Mac, Windows eller Linux)? Så tag Java-downloaden. I tvivl? Hvis Minecraft er købt i App Store eller Google Play, er det Bedrock.',
  bedrockTitle: 'Installér på iPad, telefon, konsol eller Windows (Bedrock)',
  javaTitle: 'Installér på Mac eller pc (Java Edition)',
  steps: (link) => [
    `<strong>Download</strong> ${link} på din Windows-pc, Android-telefon eller -tablet, iPhone eller iPad.`,
    '<strong>Åbn filen.</strong> Minecraft starter og importerer begge pakker.',
    '<strong>Opret eller redigér en verden.</strong> Slå <em>Lava Guns</em> til under <em>Adfærdspakker</em>. Ressourcepakken kommer automatisk med.',
    '<strong>Find det hele</strong> i den kreative oversigt, eller lav det selv: en lavaspand og fire jernbarrer bliver til otte lavapatroner.',
  ],
  javaSteps: (jar, fabric, api, gecko) => [
    `<strong>Installér</strong> ${fabric} til Minecraft 26.3.`,
    `<strong>Download</strong> ${jar} samt ${api} og ${gecko}.`,
    '<strong>Læg alle tre filer</strong> i din <em>mods</em>-mappe, og start Minecraft med Fabric-profilen.',
    '<strong>Find det hele</strong> under fanen <em>Lavakanoner</em> i kreativ tilstand, eller lav det selv.',
  ],
  serverNote: (bp, rp) => `Kører du en server? Brug den separate ${bp('adfærdspakke')} og ${rp('ressourcepakke')}. Xbox, PlayStation og Switch kan ikke importere tilføjelser fra filer, men du kan deltage i en verden eller Realm, der har tilføjelsen.`,
  upgradeTitle: 'Opdatering til en ny version',
  upgradeSteps: [
    '<strong>Hent den nye version</strong>, og åbn filen. En nyere version erstatter den, du har, og dine verdener bruger den, næste gang du åbner dem.',
    '<strong>Kører den gamle version stadig?</strong> (eller siger Minecraft, at den allerede er installeret): Gå til <em>Indstillinger → Lagerplads</em>, slet Lava Guns under både <em>Ressourcepakker</em> og <em>Adfærdspakker</em>, og åbn så den nye fil igen.',
    '<strong>Tjek verdenen:</strong> Sørg for, at Lava Guns er slået til under <em>Adfærdspakker</em> og <em>Ressourcepakker</em>, når du redigerer verdenen. En verden, du har importeret eller hentet, kan have sin egen gamle kopi med: Slå den fra dér, gem, og slå den nye til.',
  ],
  upgradeServer: 'På en server skal du erstatte tilføjelsens mapper i <em>behavior_packs</em> og <em>resource_packs</em> med de nye og genstarte den.',
  upgradeJava: 'Slet den gamle Lava Guns-jar fra din <em>mods</em>-mappe, og læg den nye i stedet. Hav kun én version i mappen. Kræver den nye version en nyere Fabric API eller GeckoLib, så opdatér dem også.',
  allVersions: 'Alle versioner',
  latestVersion: 'Nyeste version',
  released: 'udgivet',
  install: 'Installér',

  gunsTitle: 'Lavakanoner',
  gunsLede: 'Alle våbnene skyder med ammunition fra din oversigt. Skaden er i hjerter.',
  guns: {
    lava_pistol: 'Et hurtigt skud lava. Skyder hurtigt og sætter ild til målet. Bruger én lavapatron pr. skud.',
    lava_gun: 'En tung klump lava. Rammer du et væsen, bliver det lukket inde i en skal af obsidian i 5 sekunder og brænder bagefter. Rammer du ved siden af, sprøjter der lava ud, hvor den lander. Bruger to lavapatroner pr. skud.',
    obsidian_gun: 'Skyder lava, der størkner til obsidian, hvor den lander – og obsidianen bliver. Byg mure og broer, eller luk en lavasø. Et væsen, der bliver ramt, brænder, og obsidianen størkner ved dets fødder. Bruger to lavapatroner pr. skud.',
    lava_cannon: 'En tyk middelalderkanon. Sæt den ned og brug den: Den drejer derhen, hvor du kigger, og skyder en kugle af lava, og lavaen bliver liggende, hvor den lander. Snig og brug den for at vælge rækkevidde fra 1 til 5 – 8 til 40 blokke. Bruger to lavapatroner pr. skud.',
    magma_sprayer: 'Hold den nede for at sprøjte ild op til 6 blokke frem. Én magmaladning holder i 2 sekunder.',
    magma_grenade: 'Kast den. Den springer i en ring af lava og brænder alt i nærheden – uden at ødelægge blokke.',
  },
  statDamage: 'Skade',
  statFire: 'Brænder',
  statAmmo: 'Ammunition',
  statRange: 'Rækkevidde',
  blockRange: (a, b) => `${a}–${b} blokke`,
  seconds: (n) => `${n} s`,
  hearts: (n) => `${String(n / 2).replace('.', ',')} ♥`,
  perSecond: (n) => `${String(n / 2).replace('.', ',')} ♥ i sekundet`,
  shellTitle: 'Obsidianskallen',
  shell: [
    ['5 sekunder', 'Et direkte skud fra lavakanonen bygger en hul skal af obsidian rundt om væsenet. Det står i luften indeni, så det ikke bliver kvalt, og kan ikke bevæge sig.'],
    ['Så brænder det', 'Når skallen er væk, brænder væsenet i 5 sekunder. Brandsikre væsner som blazer og magmakuber tager kun skaden fra skuddet.'],
    ['Ikke de store', 'Enderdragen, Wither, Warden, ravagere og ghasts er for store til at blive lukket inde. Et væsen, der lige er sluppet ud, kan ikke lukkes inde igen de næste 3 sekunder.'],
    ['Intet at beholde', 'Obsidianen forsvinder af sig selv. Hakker du den væk før tid, får du ingenting.'],
  ],
  lavaTitle: 'Lava, der forsvinder igen',
  lava: [
    ['Midlertidig lava', 'Lava fra lavakanonen, granaterne og magmagolemmen forsvinder efter 6 sekunder. Den kommer kun der, hvor der er luft, græs eller blomster.'],
    ['mobGriefing', 'Er spilreglen <em>mobGriefing</em> slået fra, kommer der hverken lava eller obsidian. Våbnene rammer og brænder stadig, og lavakanonen fryser i stedet væsenet fast i 5 sekunder.'],
    ['PvP', 'Våbnene gør kun skade på andre spillere, når PvP er slået til.'],
  ],
  gearTitle: 'Magmastål',
  gearLede: 'Jern, magmacreme og blazepulver bliver til en magmastålbarre. Det er en anelse bedre end diamant og holder aldrig op med at være varmt.',
  gear: [
    ['Sværd', 'Sætter ild til det, det rammer, i 4 sekunder.'],
    ['Hakke', 'Smelter malmen, mens du hakker: jern-, guld- og kobbermalm giver barrer, sand giver glas, brosten giver sten.'],
    ['Økse og skovl', 'Lige så hurtige som diamantværktøj, og de holder længere.'],
    ['Hel rustning', 'Har du alle fire dele på, kan ild og lava ikke skade dig.'],
    ['Lavagængerstøvler', 'Lava under dine fødder størkner til basalt, mens du går på den, og smelter igen 4 sekunder senere.'],
  ],
  blocksTitle: 'Blokke',
  blocks: [
    ['Lavalamper', 'Boblende lamper i fire farver, der lyser lige så kraftigt som glødesten.'],
    ['Lavatank', 'Rummer 12 spande lava. Hæld lava i med en spand, og tag den ud med en tom spand. Brug 4 jernbarrer på den for at lave en spand af dens lava om til 8 lavapatroner.'],
    ['Magmablokke', 'Magmamursten, poleret og mejslet magma og blokke af magmastål gløder svagt – og i modsætning til magmablokke brænder de ikke dine fødder.'],
  ],
  creaturesTitle: 'Væsner fra Nether',
  creatures: {
    magma_golem: 'Tre blokke høj og lavet af størknende lava. Den lader dig være – indtil du slår den. Så hamrer den i jorden, så den revner med lava. Den taber den magmakerne, du skal bruge til lavakanonen.',
    lava_slug: 'En langsom, harmløs snegl fuld af lava. Brug en tom spand på den for at fylde spanden med lava (én gang hvert 5. minut). Taber magmacreme.',
  },
  itemsTitle: 'Alt i tilføjelsen',
  footerSource: (src, issues) => `Lavakanoner er gratis og open source. ${src('Kildekode på GitHub')} · ${issues('Meld et problem')}`,
  footerLegal: 'Ikke et officielt Minecraft-produkt. Ikke godkendt af eller tilknyttet Mojang eller Microsoft.',
};

export const STRINGS = { en, da };
