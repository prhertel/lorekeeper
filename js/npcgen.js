// Random NPC generator: people and humanoid demons with appearance, personality,
// 5e-style stats, gear, loot and plot hooks. All tables are original to Lorekeeper.

const R = Math.random;
const pick = (a) => a[Math.floor(R() * a.length)];
const pickN = (a, n) => { const c = [...a]; const out = []; while (c.length && out.length < n) out.push(c.splice(Math.floor(R() * c.length), 1)[0]); return out; };
const roll = (n, d) => { let t = 0; for (let i = 0; i < n; i++) t += 1 + Math.floor(R() * d); return t; };
const between = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
const chance = (p) => R() < p;
const weighted = (pairs) => {
  const total = pairs.reduce((t, [, w]) => t + w, 0);
  let r = R() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
};
const mod = (s) => Math.floor((s - 10) / 2);
const sgn = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABIL_NAME = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

// ---- names --------------------------------------------------------------------

const HUMAN_F = ['Gwendolyn', 'Elspeth', 'Mara', 'Rowena', 'Isolde', 'Brielle', 'Tamsin', 'Odette', 'Wynne', 'Hilda', 'Margery', 'Linnea', 'Agnes', 'Corra', 'Sabine', 'Leda', 'Mirela', 'Nessa', 'Ysolde', 'Fenna', 'Cerise', 'Della', 'Ilse', 'Joanna', 'Katrin', 'Maud', 'Petra', 'Rosalind', 'Theda', 'Beatrix'];
const HUMAN_M = ['Aldric', 'Bram', 'Cedric', 'Dunstan', 'Edric', 'Fulke', 'Garrick', 'Hollis', 'Ivo', 'Jory', 'Kellan', 'Leof', 'Matthias', 'Niall', 'Osric', 'Perrin', 'Roderick', 'Silas', 'Tobias', 'Ulric', 'Vance', 'Wystan', 'Yorick', 'Alaric', 'Benedikt', 'Corwin', 'Emeric', 'Gideon', 'Hugo', 'Anselm'];
const HUMAN_X = ['Ash', 'Rowan', 'Wren', 'Sage', 'Robin', 'Ellis', 'Quinn', 'Avery', 'Morgan', 'Linden'];
const HUMAN_LAST = ['Cromwell', 'Ashdown', 'Blackwood', 'Thorne', 'Fairweather', 'Hollow', 'Marsh', 'Pennywhistle', 'Ravensworth', 'Stone', 'Underhill', 'Vale', 'Whitlock', 'Brightwater', 'Coldiron', 'Dunmore', 'Greaves', 'Hartley', 'Kettering', 'Larkin', 'Merriweather', 'Northcott', 'Oakes', 'Pryce', 'Redfern', 'Saltmarsh', 'Tallow', 'Wick', 'Yarrow', 'Fenwick'];
const syl = (a, b) => pick(a) + pick(b);

const NAMERS = {
  human: (g) => `${pick(g === 'f' ? HUMAN_F : g === 'm' ? HUMAN_M : HUMAN_X)} ${pick(HUMAN_LAST)}`,
  elf: (g) => `${syl(['Ae', 'Ara', 'Cel', 'Ela', 'Fae', 'Gal', 'Ith', 'Lae', 'Lir', 'Mel', 'Nae', 'Sha', 'Syl', 'Tha', 'Va', 'Yla', 'Eri', 'Quel', 'Rua'],
    g === 'f' ? ['wyn', 'riel', 'lith', 'nore', 'thiel', 'ssa', 'lia', 'dria', 'via'] : g === 'm' ? ['ion', 'dor', 'thas', 'ril', 'van', 'las', 'ren', 'dil', 'mar'] : ['wen', 'ris', 'lan', 'eth', 'ael'])} ${pick(['Moonwhisper', 'Dawnpetal', 'Silverfrond', 'Starbrook', 'Leafsong', 'Mistvale', 'Nightbloom', 'Windrunner', 'Sunglade', 'Thornbough'])}`,
  halfelf: (g) => (chance(0.5) ? NAMERS.human(g) : `${NAMERS.elf(g).split(' ')[0]} ${pick(HUMAN_LAST)}`),
  dwarf: (g) => `${pick(g === 'f' ? ['Bryndis', 'Dagny', 'Helga', 'Ingrid', 'Kathra', 'Morna', 'Runa', 'Sigrun', 'Thora', 'Hedda'] : ['Brokk', 'Durgan', 'Faldrim', 'Gorrik', 'Harbek', 'Korgan', 'Morgrim', 'Orsik', 'Rurik', 'Thorgar'])} ${pick(['Ironfist', 'Stonebeard', 'Deepdelver', 'Anvilborn', 'Coppervein', 'Granitehand', 'Hammerfall', 'Goldseeker', 'Flintheart', 'Emberforge'])}`,
  halfling: (g) => `${pick(g === 'f' ? ['Andry', 'Bree', 'Callie', 'Daisy', 'Lavinia', 'Merla', 'Nedda', 'Poppy', 'Tansy', 'Marigold'] : ['Alton', 'Cade', 'Eldon', 'Finnan', 'Garret', 'Lyle', 'Osborn', 'Wellby', 'Tobble', 'Hobb'])} ${pick(['Applebrook', 'Puddlefoot', 'Honeypot', 'Fernbottom', 'Mossfoot', 'Quickhearth', 'Tumbledown', 'Warmwater', 'Hilltopple', 'Barleycorn'])}`,
  gnome: () => `${syl(['Nim', 'Bix', 'Fizz', 'Tink', 'Wob', 'Pip', 'Zan', 'Quib', 'Dob', 'Lop'], ['ble', 'wick', 'nock', 'ella', 'dle', 'sy', 'kin', 'mott', 'zel', 'bert'])} ${pick(['Cogsworth', 'Gearspinner', 'Fizzlebang', 'Tinkerton', 'Brassbottle', 'Sprocketsnap', 'Copperkettle', 'Wobblenock', 'Glimmerglass', 'Puddlesprocket'])}`,
  halforc: (g) => `${pick(g === 'f' ? ['Grasha', 'Murza', 'Ogra', 'Shagra', 'Ursha', 'Vorka', 'Zhara', 'Brakka', 'Durza', 'Kerra'] : ['Grukk', 'Mokran', 'Thrag', 'Urzog', 'Brugash', 'Gorbak', 'Karnak', 'Ruzgar', 'Vorn', 'Drogath'])}${chance(0.5) ? ' ' + pick(HUMAN_LAST) : ' of the ' + pick(['Broken Tusk', 'Red Hand', 'Ash Plains', 'Iron Jaw', 'Howling Pass'])}`,
  tiefling: (g) => `${chance(0.4) ? pick(['Hope', 'Sorrow', 'Ember', 'Vex', 'Torment', 'Reverie', 'Solace', 'Penance', 'Riddle', 'Whisper', 'Cinder', 'Quiet']) : pick(g === 'f' ? ['Belvexa', 'Drezna', 'Kallista', 'Nyxara', 'Zekhara', 'Sariel'] : ['Azrakel', 'Caziel', 'Malvoro', 'Orvath', 'Damaris', 'Vesk'])}${chance(0.5) ? ' ' + pick(HUMAN_LAST) : ''}`,
  dragonborn: () => `${syl(['Ar', 'Bal', 'Dra', 'Ghes', 'Kav', 'Mor', 'Rhog', 'Sur', 'Tor', 'Vyr'], ['ash', 'jhan', 'qar', 'nax', 'rin', 'thra', 'vex', 'zor', 'kith'])} of ${pick(['Clan Ashscale', 'Clan Thundermaw', 'Clan Ironclaw', 'Clan Embertooth', 'Clan Stormwing', 'Clan Goldcrest'])}`,
  demon: () => {
    const n = pick(['Vex', 'Zar', 'Mal', 'Kra', 'Ith', 'Sor', 'Bal', 'Xul', 'Gor', 'Naz', 'Ul', 'Thra', 'Az', 'Ruk']) + (chance(0.4) ? "'" : '') + pick(['goth', 'zul', 'rax', 'thek', 'morr', 'izz', 'aal', 'vok', 'nash', 'ruun', 'ghul', 'zeth']);
    return chance(0.35) ? `${n} ${pick(['the Flayer', 'the Hungering', 'of the Ninth Pit', 'Bonechewer', 'the Unclean', 'Ashtongue', 'the Grinning', 'Soulgnaw'])}` : n;
  },
  fiend: (g) => (g === 'm'
    ? pick(['Azrael', 'Malakar', 'Velthis', 'Corvane', 'Seraphon', 'Dravic', 'Lucan', 'Isembard'])
    : pick(['Lilitha', 'Seraxa', 'Vesperine', 'Malvina', 'Nyssa', 'Ophira', 'Carmilla', 'Xanthe'])),
};

// ---- races ----------------------------------------------------------------------

const HUMANLIKE_HAIR = ['black', 'dark brown', 'brown', 'chestnut', 'auburn', 'red', 'copper', 'blond', 'sandy', 'grey', 'white'];
const HUMANLIKE_EYES = ['brown', 'dark brown', 'blue', 'green', 'grey', 'hazel', 'amber'];

export const RACES = {
  human: { name: 'Human', group: 'mortal', weight: 62, age: [16, 72], height: [150, 190], speed: 30, bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, traits: [], namer: 'human',
    skin: ['pale', 'fair', 'olive', 'tan', 'golden', 'light brown', 'brown', 'dark brown', 'ebony', 'ruddy'], hair: HUMANLIKE_HAIR, eyes: HUMANLIKE_EYES },
  elf: { name: 'Elf', group: 'mortal', weight: 7, age: [90, 650], height: [150, 185], speed: 30, bonus: { dex: 2, int: 1 }, traits: ['Darkvision 60 ft', 'Fey Ancestry: advantage on saves against being charmed; magic can\'t put them to sleep'], namer: 'elf',
    skin: ['alabaster', 'pale', 'golden', 'copper', 'bronze', 'dusky'], hair: ['silver', 'golden', 'raven-black', 'copper', 'white', 'pale blond'], eyes: ['violet', 'silver', 'emerald', 'gold', 'sapphire', 'grey'] },
  halfelf: { name: 'Half-Elf', group: 'mortal', weight: 7, age: [18, 160], height: [152, 188], speed: 30, bonus: { cha: 2, dex: 1, wis: 1 }, traits: ['Darkvision 60 ft', 'Fey Ancestry: advantage on saves against being charmed'], namer: 'halfelf',
    skin: ['fair', 'olive', 'golden', 'tan', 'light brown', 'brown'], hair: [...HUMANLIKE_HAIR, 'silver'], eyes: [...HUMANLIKE_EYES, 'violet'] },
  dwarf: { name: 'Dwarf', group: 'mortal', weight: 7, age: [40, 320], height: [120, 150], speed: 25, bonus: { con: 2, str: 2 }, traits: ['Darkvision 60 ft', 'Dwarven Resilience: advantage on saves against poison, resistance to poison damage'], namer: 'dwarf',
    skin: ['ruddy', 'tan', 'weathered brown', 'pale', 'deep brown'], hair: ['black', 'brown', 'red', 'copper', 'iron-grey', 'white'], eyes: ['brown', 'grey', 'blue', 'dark'], beard: true },
  halfling: { name: 'Halfling', group: 'mortal', weight: 6, age: [18, 140], height: [85, 100], speed: 25, bonus: { dex: 2, cha: 1 }, traits: ['Lucky: rerolls natural 1s on attacks, checks and saves', 'Brave: advantage on saves against being frightened'], namer: 'halfling',
    skin: ['tan', 'ruddy', 'pale', 'olive', 'brown'], hair: ['brown', 'chestnut', 'sandy', 'black', 'auburn'], eyes: ['brown', 'hazel', 'green', 'blue'] },
  gnome: { name: 'Gnome', group: 'mortal', weight: 4, age: [40, 380], height: [90, 115], speed: 25, bonus: { int: 2, con: 1 }, traits: ['Darkvision 60 ft', 'Gnome Cunning: advantage on Int, Wis and Cha saves against magic'], namer: 'gnome',
    skin: ['ruddy', 'tan', 'pale', 'nut-brown'], hair: ['white', 'orange', 'brown', 'blond', 'bright pink', 'blue-black'], eyes: ['bright blue', 'green', 'brown', 'glittering black'] },
  halforc: { name: 'Half-Orc', group: 'mortal', weight: 4, age: [14, 65], height: [165, 200], speed: 30, bonus: { str: 2, con: 1 }, traits: ['Darkvision 60 ft', 'Relentless Endurance: drops to 1 HP instead of 0, once per long rest'], namer: 'halforc',
    skin: ['grey-green', 'olive-green', 'ash-grey', 'mottled green'], hair: ['black', 'dark brown', 'grey'], eyes: ['red', 'brown', 'yellow', 'black'] },
  tiefling: { name: 'Tiefling', group: 'mortal', weight: 3, age: [16, 95], height: [150, 190], speed: 30, bonus: { cha: 2, int: 1 }, traits: ['Darkvision 60 ft', 'Hellish Resistance: resistance to fire damage'], namer: 'tiefling',
    skin: ['crimson', 'deep red', 'violet', 'ash-grey', 'dusky blue', 'human-toned'], hair: ['black', 'dark red', 'violet', 'blue-black'], eyes: ['solid red', 'solid black', 'gold', 'silver', 'white'], horns: true, tail: true },
  dragonborn: { name: 'Dragonborn', group: 'mortal', weight: 2, age: [15, 75], height: [175, 210], speed: 30, bonus: { str: 2, cha: 1 }, traits: ['Breath Weapon: 2d6 elemental damage in a 15-ft cone (Dex save)', 'Resistance to the damage type of their draconic ancestry'], namer: 'dragonborn',
    scales: ['bronze', 'brass', 'copper', 'gold', 'silver', 'red', 'blue', 'green', 'black', 'white'], eyes: ['amber', 'red', 'gold', 'slit-pupilled yellow'] },
};

// ---- demon-touched races: a demonic version of every race ----------------------------
// They keep their race's look, size, lifespan and ability bonuses, and gain fiendish traits.
const DEMON_HORNS = ['curling ram horns', 'jagged black horns', 'a crown of small, sharp horns', 'long swept-back horns', 'one broken horn and one whole', 'long, twisted horns', 'stubby horns half-hidden in the hair'];
const DEMON_EXTRAS = ['leathery wings folded tight against the back', 'a barbed, restless tail', 'clawed, blackened fingers', 'cloven hooves where feet should be', 'a forked tongue', 'veins that glow faintly like embers'];
for (const key of Object.keys(RACES)) {
  const b = RACES[key];
  const bonus = { ...b.bonus };
  bonus.str = (bonus.str || 0) + 1;
  bonus.con = (bonus.con || 0) + 1;
  RACES['demon_' + key] = {
    ...b,
    name: `Demon ${b.name}`,
    group: 'demon',
    base: key,
    size: ['halfling', 'gnome'].includes(key) ? 'Small' : 'Medium',
    bonus,
    natArmor: 1,
    hpBonus: 8,
    traits: [
      ...b.traits.filter((t) => !/^Darkvision/.test(t)),
      'Darkvision 120 ft',
      'Fiendish Resistance: resistance to cold, fire and lightning damage',
      'Immune to poison',
      'Abyssal Hunger: regains 1d6 HP when it reduces a creature to 0 HP',
    ],
    natural: { name: 'Claws', dmg: '1d6', type: 'slashing' },
  };
}


// ---- classes ------------------------------------------------------------------------

const ARMOR = {
  none: { name: 'no armor', base: 10, dexMax: 99 }, padded: { name: 'padded armor', base: 11, dexMax: 99 },
  leather: { name: 'leather armor', base: 11, dexMax: 99 }, studded: { name: 'studded leather', base: 12, dexMax: 99 },
  hide: { name: 'hide armor', base: 12, dexMax: 2 }, chainshirt: { name: 'chain shirt', base: 13, dexMax: 2 },
  scale: { name: 'scale mail', base: 14, dexMax: 2 }, breastplate: { name: 'breastplate', base: 14, dexMax: 2 },
  halfplate: { name: 'half plate', base: 15, dexMax: 2 }, chainmail: { name: 'chain mail', base: 16, dexMax: 0 },
  splint: { name: 'splint armor', base: 17, dexMax: 0 }, plate: { name: 'plate armor', base: 18, dexMax: 0 },
};
const WEAPONS = {
  dagger: { dmg: '1d4', type: 'piercing', finesse: true }, club: { dmg: '1d4', type: 'bludgeoning' }, quarterstaff: { dmg: '1d6', type: 'bludgeoning' },
  mace: { dmg: '1d6', type: 'bludgeoning' }, handaxe: { dmg: '1d6', type: 'slashing' }, spear: { dmg: '1d6', type: 'piercing' },
  shortsword: { dmg: '1d6', type: 'piercing', finesse: true }, scimitar: { dmg: '1d6', type: 'slashing', finesse: true },
  rapier: { dmg: '1d8', type: 'piercing', finesse: true }, longsword: { dmg: '1d8', type: 'slashing' }, battleaxe: { dmg: '1d8', type: 'slashing' },
  warhammer: { dmg: '1d8', type: 'bludgeoning' }, morningstar: { dmg: '1d8', type: 'piercing' }, flail: { dmg: '1d8', type: 'bludgeoning' },
  greatsword: { dmg: '2d6', type: 'slashing' }, greataxe: { dmg: '1d12', type: 'slashing' }, maul: { dmg: '2d6', type: 'bludgeoning' },
  halberd: { dmg: '1d10', type: 'slashing' }, glaive: { dmg: '1d10', type: 'slashing' }, whip: { dmg: '1d4', type: 'slashing', finesse: true },
  shortbow: { dmg: '1d6', type: 'piercing', ranged: true }, longbow: { dmg: '1d8', type: 'piercing', ranged: true },
  'light crossbow': { dmg: '1d8', type: 'piercing', ranged: true }, 'hand crossbow': { dmg: '1d6', type: 'piercing', ranged: true },
  sling: { dmg: '1d4', type: 'bludgeoning', ranged: true }, javelin: { dmg: '1d6', type: 'piercing' },
  darts: { dmg: '1d4', type: 'piercing', finesse: true, ranged: true },
};

const SPELLS = {
  wizard: [['Fire Bolt', 'Mage Hand', 'Prestidigitation', 'Ray of Frost', 'Minor Illusion'], ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Charm Person'], ['Misty Step', 'Scorching Ray', 'Invisibility', 'Hold Person', 'Web'], ['Fireball', 'Counterspell', 'Fly', 'Lightning Bolt', 'Dispel Magic'], ['Greater Invisibility', 'Polymorph', 'Ice Storm', 'Wall of Fire'], ['Cone of Cold', 'Wall of Force', 'Hold Monster']],
  sorcerer: [['Fire Bolt', 'Chill Touch', 'Shocking Grasp', 'Ray of Frost'], ['Magic Missile', 'Shield', 'Chromatic Orb', 'Sleep'], ['Scorching Ray', 'Misty Step', 'Mirror Image'], ['Fireball', 'Haste', 'Lightning Bolt'], ['Polymorph', 'Greater Invisibility'], ['Cone of Cold', 'Hold Monster']],
  warlock: [['Eldritch Blast', 'Minor Illusion', 'Chill Touch'], ['Hex', 'Armor of Agathys', 'Hellish Rebuke'], ['Darkness', 'Misty Step', 'Hold Person'], ['Hunger of Hadar', 'Counterspell', 'Fly'], ['Banishment', 'Dimension Door'], ['Hold Monster', 'Dream']],
  cleric: [['Sacred Flame', 'Guidance', 'Light', 'Thaumaturgy'], ['Cure Wounds', 'Bless', 'Healing Word', 'Guiding Bolt', 'Command'], ['Spiritual Weapon', 'Hold Person', 'Lesser Restoration', 'Aid'], ['Spirit Guardians', 'Revivify', 'Dispel Magic'], ['Guardian of Faith', 'Banishment', 'Death Ward'], ['Flame Strike', 'Mass Cure Wounds', 'Raise Dead']],
  druid: [['Druidcraft', 'Produce Flame', 'Shillelagh', 'Guidance'], ['Entangle', 'Cure Wounds', 'Faerie Fire', 'Thunderwave', 'Goodberry'], ['Moonbeam', 'Barkskin', 'Pass without Trace', 'Spike Growth'], ['Call Lightning', 'Plant Growth', 'Conjure Animals'], ['Polymorph', 'Ice Storm', 'Stoneskin'], ['Insect Plague', 'Tree Stride']],
  bard: [['Vicious Mockery', 'Minor Illusion', 'Mage Hand'], ['Healing Word', 'Dissonant Whispers', 'Charm Person', 'Faerie Fire'], ['Suggestion', 'Shatter', 'Invisibility', 'Heat Metal'], ['Hypnotic Pattern', 'Fear', 'Dispel Magic'], ['Greater Invisibility', 'Confusion', 'Dimension Door'], ['Dominate Person', 'Mass Cure Wounds']],
  paladin: [[], ['Bless', 'Shield of Faith', 'Divine Favor', 'Cure Wounds'], ['Aid', 'Find Steed', 'Branding Smite'], ['Revivify', 'Aura of Vitality'], ['Death Ward', 'Banishment'], ['Destructive Wave']],
  ranger: [[], ["Hunter's Mark", 'Cure Wounds', 'Fog Cloud'], ['Pass without Trace', 'Spike Growth'], ['Conjure Barrage', 'Lightning Arrow'], ['Freedom of Movement'], ['Swift Quiver']],
};

export const CLASSES = {
  commoner: { name: 'Commoner', hd: 8, prio: ['con', 'str', 'wis', 'dex', 'int', 'cha'], armor: [['none'], ['padded'], ['leather']], shield: 0, weapons: ['club', 'dagger', 'quarterstaff', 'sling'] },
  fighter: { name: 'Fighter', hd: 10, prio: ['str', 'con', 'dex', 'wis', 'cha', 'int'], armor: [['chainmail', 'scale'], ['splint', 'halfplate'], ['plate']], shield: 0.5, weapons: ['longsword', 'battleaxe', 'warhammer', 'greatsword', 'halberd', 'maul', 'flail'], backup: ['longbow', 'handaxe', 'light crossbow'],
    kit: ["explorer's pack", 'whetstone', 'bedroll', 'a dented tin cup'], features: (l) => ['Second Wind', l >= 2 && 'Action Surge', l >= 5 && `Extra Attack${l >= 11 ? ' (3 attacks)' : ''}`, l >= 9 && 'Indomitable'] },
  rogue: { name: 'Rogue', hd: 8, prio: ['dex', 'con', 'int', 'wis', 'cha', 'str'], armor: [['leather'], ['studded'], ['studded']], shield: 0, weapons: ['rapier', 'shortsword', 'dagger', 'scimitar'], backup: ['shortbow', 'hand crossbow'],
    kit: ["thieves' tools", 'dark hooded cloak', 'crowbar', "burglar's pack", 'a ring of skeleton keys'], features: (l) => [`Sneak Attack ${Math.ceil(l / 2)}d6`, l >= 2 && 'Cunning Action', l >= 5 && 'Uncanny Dodge', l >= 7 && 'Evasion'] },
  wizard: { name: 'Wizard', hd: 6, prio: ['int', 'con', 'dex', 'wis', 'cha', 'str'], armor: [['none'], ['none'], ['none']], shield: 0, weapons: ['quarterstaff', 'dagger'], caster: 'wizard', cast: 'int', full: true,
    kit: ['spellbook', 'component pouch', 'ink and quill', "scholar's pack", 'a half-finished treatise'], features: () => ['Arcane Recovery'] },
  cleric: { name: 'Cleric', hd: 8, prio: ['wis', 'con', 'str', 'cha', 'dex', 'int'], armor: [['scale', 'chainshirt'], ['breastplate'], ['halfplate']], shield: 0.7, weapons: ['mace', 'warhammer', 'morningstar'], backup: ['light crossbow'], caster: 'cleric', cast: 'wis', full: true,
    kit: ['holy symbol', 'prayer book', "priest's pack", 'a vial of holy water'], features: (l) => [l >= 2 && 'Channel Divinity', l >= 5 && 'Destroy Undead'] },
  ranger: { name: 'Ranger', hd: 10, prio: ['dex', 'wis', 'con', 'str', 'int', 'cha'], armor: [['leather'], ['scale', 'studded'], ['breastplate']], shield: 0, weapons: ['longbow', 'shortbow'], backup: ['shortsword', 'scimitar', 'handaxe'], caster: 'ranger', cast: 'wis',
    kit: ['hunting trap', 'quiver of 20 arrows', "explorer's pack", 'a map of the local wilds'], features: (l) => ['Favored Enemy', 'Natural Explorer', l >= 5 && 'Extra Attack'] },
  paladin: { name: 'Paladin', hd: 10, prio: ['str', 'cha', 'con', 'wis', 'dex', 'int'], armor: [['chainmail'], ['splint'], ['plate']], shield: 0.6, weapons: ['longsword', 'warhammer', 'greatsword', 'morningstar'], backup: ['javelin'], caster: 'paladin', cast: 'cha',
    kit: ['holy symbol', 'signet ring', "explorer's pack", 'a tabard of their order'], features: (l) => [`Lay on Hands (${5 * l} HP)`, l >= 2 && 'Divine Smite', l >= 5 && 'Extra Attack', l >= 6 && 'Aura of Protection'] },
  barbarian: { name: 'Barbarian', hd: 12, prio: ['str', 'con', 'dex', 'wis', 'cha', 'int'], armor: 'barbarian', shield: 0, weapons: ['greataxe', 'greatsword', 'maul', 'battleaxe'], backup: ['handaxe', 'spear'],
    kit: ['a necklace of trophy teeth', "explorer's pack", 'a fur cloak'], features: (l) => [`Rage (+${l >= 16 ? 4 : l >= 9 ? 3 : 2} damage, resistance to physical damage)`, l >= 2 && 'Reckless Attack', l >= 5 && 'Extra Attack', l >= 7 && 'Feral Instinct'] },
  bard: { name: 'Bard', hd: 8, prio: ['cha', 'dex', 'con', 'wis', 'int', 'str'], armor: [['leather'], ['studded'], ['studded']], shield: 0, weapons: ['rapier', 'dagger', 'shortsword'], backup: ['hand crossbow'], caster: 'bard', cast: 'cha', full: true,
    instrument: true, kit: ["entertainer's pack", 'a fine set of clothes', 'a book of bawdy songs'], features: (l) => [`Bardic Inspiration (d${l >= 15 ? 12 : l >= 10 ? 10 : l >= 5 ? 8 : 6})`, l >= 2 && 'Jack of All Trades', l >= 2 && 'Song of Rest'] },
  warlock: { name: 'Warlock', hd: 8, prio: ['cha', 'con', 'dex', 'wis', 'int', 'str'], armor: [['leather'], ['studded'], ['studded']], shield: 0, weapons: ['dagger', 'quarterstaff', 'shortsword'], backup: ['light crossbow'], caster: 'warlock', cast: 'cha', full: true,
    kit: ['arcane focus (a carved bone charm)', 'a book of forbidden lore', 'a ritual knife'], features: (l) => ['Pact Magic', l >= 2 && 'Eldritch Invocations', l >= 3 && 'Pact Boon'] },
  sorcerer: { name: 'Sorcerer', hd: 6, prio: ['cha', 'con', 'dex', 'wis', 'int', 'str'], armor: [['none'], ['none'], ['none']], shield: 0, weapons: ['dagger', 'quarterstaff'], backup: ['light crossbow'], caster: 'sorcerer', cast: 'cha', full: true,
    kit: ['arcane focus (a smoky crystal)', "dungeoneer's pack", 'a family heirloom that hums faintly'], features: (l) => ['Sorcerous Origin', l >= 2 && `Sorcery Points (${l})`, l >= 3 && 'Metamagic'] },
  monk: { name: 'Monk', hd: 8, prio: ['dex', 'wis', 'con', 'str', 'int', 'cha'], armor: 'monk', shield: 0, weapons: ['quarterstaff', 'shortsword', 'spear'], backup: ['darts'],
    kit: ['prayer beads', '10 darts', 'simple travelling robes', 'a begging bowl'], features: (l) => [`Martial Arts (d${l >= 17 ? 10 : l >= 11 ? 8 : l >= 5 ? 6 : 4})`, l >= 2 && `Ki (${l} points)`, l >= 3 && 'Deflect Missiles', l >= 5 && 'Extra Attack', l >= 5 && 'Stunning Strike'] },
  druid: { name: 'Druid', hd: 8, prio: ['wis', 'con', 'dex', 'int', 'cha', 'str'], armor: [['leather'], ['hide'], ['hide']], shield: 0.4, weapons: ['quarterstaff', 'scimitar', 'spear'], backup: ['sling'], caster: 'druid', cast: 'wis', full: true,
    kit: ['druidic focus (a sprig of mistletoe)', 'herbalism kit', 'a pouch of seeds'], features: (l) => [l >= 2 && 'Wild Shape', l >= 2 && 'Druid Circle'] },
};

// ---- flavour tables -----------------------------------------------------------------

const OCCUPATIONS = [['jeweler', "jeweler's tools and a loupe"], ['blacksmith', "smith's tools"], ['baker', 'a flour-dusted apron'], ['innkeeper', 'a ring of room keys'], ['fisher', 'a fishing net and tackle'],
  ['farmer', 'a sickle'], ['merchant', 'a ledger and a set of scales'], ['town guard', 'a whistle and a badge of office'], ['sailor', 'a coil of rope and a clasp knife'], ['scribe', 'ink, quills and parchment'],
  ['tailor', 'needles, thread and shears'], ['carpenter', "carpenter's tools"], ['herbalist', 'an herbalism kit'], ['acolyte', 'a holy symbol and a prayer book'], ['hunter', 'a skinning knife and snares'],
  ['miner', 'a pick and a lantern'], ['stablehand', 'a curry comb and oats'], ['brewer', "brewer's supplies"], ['cartographer', "cartographer's tools"], ['apothecary', 'a case of tinctures'],
  ['butcher', 'a cleaver'], ['candlemaker', 'a bundle of tallow candles'], ['cobbler', "cobbler's tools"], ['cook', "cook's utensils"], ['ferryman', 'a long pole and a toll box'],
  ['gravedigger', 'a shovel'], ['mason', "mason's tools"], ['midwife', 'clean linens and a birthing knife'], ['minstrel', 'a battered lute'], ['moneylender', 'a strongbox key'],
  ['potter', "potter's tools"], ['rat-catcher', 'a cage, poison and a terrier'], ['shepherd', 'a crook'], ['tanner', 'a scraping knife'], ['weaver', "weaver's tools"],
  ['courier', 'a sealed satchel'], ['dockhand', 'a cargo hook'], ['lamplighter', 'a lighting pole and oil'], ['bookbinder', 'glue, thread and leather'], ['barber-surgeon', 'razors and a bone saw']];
const DEMON_ROLES = ['tormentor', 'pit overseer', 'soul-broker', 'scout', 'enforcer', 'cult handler', 'messenger', 'gatekeeper', 'hunter of escaped souls'];
const INSTRUMENTS = ['lute', 'flute', 'viol', 'lyre', 'hand drum', 'set of bagpipes', 'shawm'];

const HAIR_LEN = ['short', 'cropped', 'shoulder-length', 'long', 'very long', 'waist-length'];
const HAIR_STYLE = ['curly', 'straight', 'wavy', 'braided', 'tied-back', 'unkempt', 'neatly combed', 'matted'];
const BUILDS = ['lean', 'stocky', 'muscular', 'slight', 'heavyset', 'wiry', 'broad-shouldered', 'lanky', 'athletic', 'soft'];
const FACE_SHAPE = ['round', 'angular', 'oblong', 'heart-shaped', 'square', 'narrow'];
const FACE_LOOK = ['weathered', 'freckled', 'handsome', 'plain', 'striking', 'gaunt', 'kindly', 'stern', 'very fanciable', 'forgettable'];
const SKIN_TEXTURE = ['smooth', 'rough', 'weathered', 'sun-worn', 'scarred', 'freckled'];
const MARKS = ['2 piercings in the left eyebrow', 'a jagged scar across the chin', 'a tattoo of a serpent coiling up the neck', 'a missing little finger', 'a gold front tooth', 'eyes of two different colours',
  'a burn scar across one hand', 'an ornate nose ring', 'ink-stained fingers', 'a pronounced limp', 'a crooked, often-broken nose', 'a birthmark shaped like a crescent moon', 'a constant faint smell of smoke',
  'a pale streak through the hair', 'a voice far deeper than you would expect', 'calloused, scarred knuckles', 'a dozen tiny braids threaded with beads', 'one ear notched by an old wound'];
const DEMON_EYES = ['burning ember', 'solid black', 'sulfur-yellow', 'slit-pupilled crimson', 'pale, glowing white', 'molten gold'];
const DEMON_SKIN = ['blood-red', 'ash-grey', 'charcoal-black', 'bruise-purple', 'sickly green', 'obsidian', 'scorched bronze'];
const DEMON_MARKS = ['smouldering cracks across the skin', 'a faint smell of sulfur that follows them everywhere', 'a barbed, restless tail', 'a mouth of needle-thin teeth', 'chains of blackened iron fused into the flesh',
  'abyssal runes branded across the chest', 'a shadow that moves a heartbeat too late', 'a voice that echoes as if from a deep pit', 'a ritual brand burned into the chest', 'fresh scars that never fully heal'];

const TRAITS = ['Changes the subject very often.', 'Is very slow to trust other people.', 'Lies poorly, and seems to do it on purpose.', 'Laughs loudly at their own jokes.', 'Speaks in a near-whisper.',
  'Quotes scripture at every opportunity.', 'Constantly fidgets with a coin.', 'Is fiercely loyal to the few friends they have.', 'Haggles over absolutely everything.', 'Is endlessly curious about strangers.',
  'Hums while working.', 'Is blunt to the point of rudeness.', 'Is unfailingly polite, even to enemies.', 'Collects gossip like treasure.', 'Is deeply superstitious.', 'Never sits with their back to a door.',
  'Overshares about their family.', 'Remembers every slight, forever.', 'Is a hopeless romantic.', 'Pretends to be more important than they are.', 'Is terrified of deep water.', 'Can\'t resist a wager.',
  'Gives everyone a nickname.', 'Is quietly brave when it matters.', 'Is easily flustered.', 'Drinks more than they should.', 'Keeps meticulous notes on everything.', 'Is kind to animals, cold to people.',
  'Sings sad songs when alone.', 'Has a strong opinion on every topic.'];
// Demons are mortals converted by profane rituals performed by an unknown force, and now driven by a demon spirit.
const DEMON_TRAITS = ['Delights in other people\'s fear.', 'Sometimes speaks with two voices at once.', 'Hungers constantly, and not for food.', 'Respects strength and nothing else.',
  'Flinches at the sound of their old name.', 'Has moments where the old self surfaces: confused, pleading, then gone.', 'Keeps a habit from their mortal life that the demon cannot break.',
  'Collects the names of the slain.', 'Is easily goaded into rage.', 'Always flatters before betraying.', 'Laughs at wholly inappropriate moments.', 'Hums a hymn from the ritual under their breath.',
  'Recognises people from their old life, and toys with them.', 'Toys with prey before finishing the kill.', 'Feels no pain, and seems curious about it.'];
const DEMON_RITUALS = ['in a cellar beneath a burned chapel', 'on a hilltop altar during a blood moon', 'in a ring of black candles deep in the woods', 'in the flooded crypt of an old manor',
  'in a mine shaft no one admits to digging', 'in a ship\'s hold far out at sea', 'in a ruined monastery where the bells still ring at night', 'in their own home, while they slept'];
const DEMON_TAKEN = ['dragged from the road by hooded figures', 'lured by a stranger promising work', 'taken from a village that is now empty', 'sold to the cult by someone they trusted',
  'found wandering after a week missing', 'volunteered, believing it was a healing rite', 'captured during a raid on their town', 'answered a voice calling from a well'];
const DEITIES = ['Aurenna, goddess of the dawn and healing', 'Kharvos, god of the forge', 'Sel, the Quiet Moon, goddess of secrets', 'Torvane, god of storms and sailors', 'Mother Veyl, goddess of the harvest',
  'Ostrem, god of law and judgement', 'the Ashen King, god of death', 'Lirra, goddess of luck and travellers', 'Vashka, goddess of war', 'Brann, god of the hunt', 'Ithrae, god of knowledge', 'Corva, goddess of fire and purification'];
const DEVOTION = [['zealously worships', 'zealously worship'], ['quietly prays to', 'quietly pray to'], ['pays lip service to', 'pay lip service to'], ['has lost faith in', 'have lost faith in'], ['makes offerings to', 'make offerings to'], ['secretly curses', 'secretly curse']];
const DEMON_LORDS = ['Zarthul the Hungering Maw', 'Ixxaroth, the Thousand Eyes', 'Belquessa, Queen of Thorns', 'Morrugal the Rotting King', 'Shaal-Vek the Whisperer', 'Vorathrix, Lord of the Burning Pit'];
const RELATIONSHIPS = ['Single', 'Married', 'Recently widowed', 'Engaged', 'Divorced', 'In a secret affair', 'Courting someone above their station', 'Estranged from their spouse', 'Widowed long ago', 'Single, and happy about it'];
const FAMILY = ['has two young children', 'cares for an ailing parent', 'has a twin they haven\'t spoken to in years', 'is the eldest of seven siblings', 'was raised by an aunt', 'has no living family', 'has a grown son in the city guard', 'has a daughter who ran off with adventurers'];

const HOOKS = [
  (n) => `${n} has angered ${pick(DEMON_LORDS)} and needs help avoiding the consequences.`,
  (n) => `${n} owes a dangerous sum to a moneylender who has started sending "reminders".`,
  (n) => `${n} witnessed a murder in the docks and is being followed.`,
  (n) => `${n} is searching for a missing sibling, last seen heading into the old mines.`,
  (n) => `${n} found a strange map sewn into a secondhand coat and wants an escort to follow it.`,
  (n) => `${n} needs a family heirloom recovered from a bandit camp before a wedding next week.`,
  (n) => `${n} has been having the same nightmare as everyone else in their street, and it is getting worse.`,
  (n) => `${n} is being blackmailed by someone who knows about a crime from their youth.`,
  (n) => `${n} wants proof that a rival is cheating customers, and will pay well for it.`,
  (n) => `${n} has been chosen by lottery to be "offered" to something in the woods, and wants out.`,
  (n) => `${n} recently bought a cursed object at market and can't get rid of it.`,
  (n) => `${n} is hiding a wounded fugitive in their cellar.`,
  (n) => `${n} has heard demons speaking through the well behind their house.`,
  (n) => `${n} needs someone to deliver a sealed letter, no questions asked.`,
];
const DEMON_HOOKS = [
  (n, d) => `${n}'s family still leaves a candle in the window, and has offered a reward to anyone who can bring ${n} home and free them from ${d}.`,
  (n, d) => `${d} is guiding ${n} back to their old village to bring others to the ritual site.`,
  (n, d) => `${n} is hunting the survivors of the ritual that converted them, so none can reveal what they saw.`,
  (n, d) => `${d} is searching for a relic that would let it stay in ${n}'s body permanently.`,
  (n, d) => `For a few minutes each dawn ${n} is themself again, and has been leaving desperate notes for anyone who finds them.`,
  (n, d) => `${n} leads new converts back to the ritual site, where the unknown force waits for more bodies.`,
  (n, d) => `A priest believes ${n} can be exorcised, but only at the place where the ritual was performed.`,
  (n, d) => `${n} carries a fragment of the ritual's script. Whoever reads it might learn who, or what, is behind the conversions.`,
];
const SECRETS = ['Is secretly a member of a demon-worshipping cult.', 'Is the illegitimate child of a local noble.', 'Stole their savings from a temple.', 'Is a spy for a rival city.', 'Has a second family in another town.',
  'Killed a man in self-defence and hid the body.', 'Can hear the thoughts of the dead, faintly.', 'Is slowly being possessed and doesn\'t know it.', 'Is not who they claim to be; they took the name from a dead stranger.',
  'Sold information about the town\'s defences to bandits.', 'Is deeply in love with someone they serve.', 'Has a minor magical gift they hide out of fear.'];
const DEMON_SECRETS = ['The original person is still awake inside, and can sometimes move one hand.', 'Speaking the demon\'s true name aloud forces it to the surface, and weakens its hold.',
  'The ritual mark on their body is the anchor. Destroying it would free the host, or kill them.', 'They remember a voice at the ritual that was not human, and not a demon either.',
  'The demon is afraid of whatever performed the ritual.', 'Iron quenched in holy water burns them terribly.', 'Someone the party knows was at the same ritual, and was converted too.',
  'The possession is failing: the body is dying, and the demon needs a new host soon.'];

const TRINKETS = ['a tarnished locket holding a portrait of a stranger', 'a pouch of mismatched buttons', 'a wooden toy soldier', 'a deck of cards with one missing', 'a letter that was never sent',
  'a pressed flower in a waxed envelope', 'a carved bone die that always rolls a six', 'a lock of someone\'s hair tied with red thread', 'a tiny brass key to an unknown lock', 'a well-thumbed book of poetry',
  'a glass eye', 'a small clay idol of a forgotten god', 'a map of a town that does not exist', 'a broken compass', 'an IOU signed by a local lord', 'a silver ring engraved with initials not their own',
  'a smooth river stone they rub for luck', 'a whistle carved from a bird\'s bone'];
const DEMON_TRINKETS = ['a blackened coin, warm to the touch', 'a vial of ichor that hisses on contact with water', 'an obsidian shard etched with abyssal runes', 'a cultist\'s brass sigil',
  'a tooth from something much larger', 'a scrap of a summoning circle drawn on cured hide', 'a jar containing a screaming whisper', 'a chain link from the Abyss, cold as ice'];
const GEMS = [[10, ['azurite', 'banded agate', 'hematite', 'malachite', 'turquoise']], [50, ['bloodstone', 'carnelian', 'moonstone', 'onyx', 'zircon']], [100, ['amber', 'amethyst', 'garnet', 'jade', 'pearl']], [500, ['alexandrite', 'black pearl', 'topaz', 'aquamarine']], [1000, ['black opal', 'emerald', 'fire opal', 'sapphire']]];
const MAGIC = [
  ['Potion of Healing', 'Potion of Climbing', 'Spell Scroll (cantrip)', 'Potion of Water Breathing'],
  ['Potion of Greater Healing', '+1 {weapon}', 'Bag of Holding', 'Cloak of Protection', 'Boots of Elvenkind', 'Wand of Magic Missiles', 'Gloves of Thievery', 'Sending Stones', 'Spell Scroll (2nd level)'],
  ['Potion of Superior Healing', '+2 {weapon}', 'Ring of Protection', 'Cloak of Displacement', 'Flame Tongue {weapon}', 'Amulet of Health', 'Wand of Fireballs'],
  ['Potion of Supreme Healing', '+3 {weapon}', 'Belt of Stone Giant Strength', 'Ring of Regeneration', 'Staff of Power'],
];
const DEMON_MAGIC = ['an Abyssal Blade ({weapon}, +1, deals an extra 1d6 necrotic)', 'a Ring of Infernal Whispers (cast Suggestion once a day)', 'a Demonbone Amulet (resistance to fire)', 'a Scroll of Banishment, kept so no one can use it on them'];

// ---- generation -------------------------------------------------------------------------

function pronouns(g) {
  if (g === 'f') return { obj: 'her', subj: 'she', Subj: 'She', poss: 'her', has: 'has', is: 'is', v: (s) => s[0], word: 'female' };
  if (g === 'm') return { obj: 'him', subj: 'he', Subj: 'He', poss: 'his', has: 'has', is: 'is', v: (s) => s[0], word: 'male' };
  return { obj: 'them', subj: 'they', Subj: 'They', poss: 'their', has: 'have', is: 'are', v: (s) => s[1], word: 'nonbinary' };
}

function heightText(cm) {
  const inches = Math.round(cm / 2.54);
  return `${cm}cm (${Math.floor(inches / 12)}'${inches % 12}")`;
}

function rollAbilities(cls, isCommoner) {
  const scores = {};
  if (isCommoner) { for (const a of ABIL) scores[a] = roll(3, 6); return scores; }
  const arr = [15, 14, 13, 12, 10, 8];
  const order = [...cls.prio];
  for (let i = 2; i < order.length - 1; i++) if (chance(0.3)) [order[i], order[i + 1]] = [order[i + 1], order[i]];
  order.forEach((a, i) => { scores[a] = arr[i]; });
  return scores;
}

function levelFrom(range) {
  if (/^\d+$/.test(range)) return +range;
  const [lo, hi] = String(range || '1-5').split('-').map(Number);
  return between(lo || 1, hi || lo || 5);
}

/**
 * @param {object} o
 * @param {string[]} o.races race keys allowed (weighted)
 * @param {string[]} o.classes class keys allowed
 * @param {string} o.level "1-5" or "7"
 * @param {'any'|'f'|'m'} o.gender
 */
export function generateNpc(o) {
  const raceKey = weighted(o.races.filter((k) => RACES[k]).map((k) => [k, RACES[k].weight]));
  const race = RACES[raceKey];
  const isDemon = race.group === 'demon';
  const clsKey = isDemon
    ? weighted(o.classes.map((k) => [k, k === 'commoner' ? 3 : 1]))
    : weighted(o.classes.map((k) => [k, k === 'commoner' ? 6 : 1]));
  const cls = CLASSES[clsKey];
  const isCommoner = clsKey === 'commoner';
  const level = isCommoner && !isDemon ? 1 : levelFrom(o.level);
  const prof = 2 + Math.floor((level - 1) / 4);
  const g = race.gender || (o.gender === 'any' ? weighted([['f', 48], ['m', 48], ['x', 4]]) : o.gender);
  const P = pronouns(g);
  // Demons keep their mortal name; the spirit driving them has its own.
  const name = NAMERS[race.namer](g);
  const spirit = isDemon ? NAMERS.demon().split(' ')[0] : null;
  const first = name.split(' ')[0];

  // Abilities
  const sc = rollAbilities(cls, isCommoner);
  for (const [a, b] of Object.entries(race.bonus || {})) sc[a] = Math.max(3, sc[a] + b);
  for (const asi of [4, 8, 12, 16, 19]) if (level >= asi && !isCommoner) { const a = cls.prio[0]; sc[a] = Math.min(20, sc[a] + 2); }
  for (const a of ABIL) sc[a] = Math.min(20, sc[a]);
  const m = Object.fromEntries(ABIL.map((a) => [a, mod(sc[a])]));

  // Armor & AC
  const tier = level >= 11 ? 2 : level >= 5 ? 1 : 0;
  let armorKey = 'none', acNote = '';
  let ac;
  if (cls.armor === 'barbarian') { ac = 10 + m.dex + m.con; acNote = 'unarmored defense'; }
  else if (cls.armor === 'monk') { ac = 10 + m.dex + m.wis; acNote = 'unarmored defense'; }
  else {
    armorKey = pick(cls.armor[tier]);
    if (isCommoner) armorKey = pick(['none', 'none', 'none', 'padded', 'leather']);
    const A = ARMOR[armorKey];
    ac = A.base + Math.min(m.dex, A.dexMax);
    acNote = A.name;
  }
  if (isDemon && race.natArmor) {
    const natural = 10 + m.dex + race.natArmor + Math.floor(level / 5);
    if (natural >= ac) { ac = natural; acNote = 'natural armor'; armorKey = 'none'; }
  }
  const shield = chance(cls.shield || 0);
  if (shield) { ac += 2; acNote += ', shield'; }

  // HP
  const hdAvg = Math.floor(cls.hd / 2) + 1;
  let hp = cls.hd + m.con + (level - 1) * (hdAvg + m.con);
  if (isCommoner && !isDemon) hp = 4 + m.con;
  hp += (race.hpBonus || 0) + (isDemon ? Math.round((race.hpBonus || 0) * 0.1 * (level - 1)) : 0);
  hp = Math.max(1, hp);
  let speed = race.speed || 30;
  if (clsKey === 'monk' && level >= 2) speed += 10 + 5 * Math.floor((level - 2) / 4);

  // Weapons & attacks
  const weaponName = pick(cls.weapons);
  const weapons = [weaponName];
  if (cls.backup && chance(0.6)) weapons.push(pick(cls.backup));
  const attacks = [];
  const extra = /Extra Attack/.test((cls.features?.(level) || []).filter(Boolean).join(' '));
  for (const w of weapons) {
    const W = WEAPONS[w];
    if (!W) continue;
    const useDex = W.ranged || (W.finesse && m.dex > m.str);
    const am = useDex ? m.dex : m.str;
    attacks.push(`${cap(w)}: ${sgn(prof + am)} to hit, ${W.dmg}${am ? ` ${sgn(am)}` : ''} ${W.type}${W.ranged ? ' (ranged)' : ''}`);
  }
  if (race.natural) {
    const N = race.natural;
    attacks.push(`${N.name}: ${sgn(prof + m.str)} to hit, ${N.dmg} ${sgn(m.str)} ${N.type}`);
  }

  // Spells
  let spellsHtml = '';
  if (cls.caster) {
    const maxLvl = cls.full ? Math.min(5, Math.ceil(level / 2)) : level < 2 ? 0 : Math.min(5, Math.ceil(level / 4));
    const lists = SPELLS[cls.caster];
    const parts = [];
    if (lists[0].length) parts.push(`<em>Cantrips:</em> ${pickN(lists[0], 2 + (level >= 10 ? 1 : 0)).join(', ')}`);
    const ord = ['', '1st', '2nd', '3rd', '4th', '5th'];
    for (let sl = 1; sl <= maxLvl; sl++) parts.push(`<em>${ord[sl]}:</em> ${pickN(lists[sl], sl === maxLvl ? 1 : 2).join(', ')}`);
    if (parts.length) {
      const cm = m[cls.cast];
      spellsHtml = `<p><strong>Spells</strong> (save DC ${8 + prof + cm}, ${sgn(prof + cm)} to hit): ${parts.join('; ')}</p>`;
    }
  }

  // Role & description
  const occ = isCommoner ? pick(OCCUPATIONS) : null;
  const role = isCommoner ? (isDemon ? `former ${occ[0]}` : occ[0]) : cls.name.toLowerCase();
  const desc = [];
  const look = { race: isDemon ? race.base : raceKey, demon: isDemon, gender: g, cls: clsKey };
  {
    // Demons are mortals converted by a profane ritual: they keep their race's look, with the corruption layered on.
    const age = between(...race.age);
    const eyes = isDemon ? pick(DEMON_EYES) : pick(race.eyes);
    const skin = isDemon && chance(0.6) ? pick(DEMON_SKIN) : pick(race.skin || ['']);
    Object.assign(look, { eyes, skin });
    const kindWord = isDemon ? RACES[race.base].name.toLowerCase() : race.name.toLowerCase();
    desc.push(`${name} is ${/^(8|11|18)/.test(String(age)) ? 'an' : 'a'} ${age} year old ${P.word} ${kindWord} ${role}${isDemon ? ', converted by a profane ritual and now driven by a demon spirit' : ''}.`);
    if (isDemon) desc.push(`${P.Subj} ${P.v(['was', 'were'])} ${pick(DEMON_TAKEN)}, and converted ${pick(DEMON_RITUALS)}. Who, or what, performed the ritual is unknown.`);
    if (race.scales) {
      look.scales = isDemon ? pick(['obsidian', 'charred black', 'blood-red', 'ash-grey']) : pick(race.scales);
      desc.push(`${P.Subj} ${P.has} ${look.scales} scales and ${eyes} eyes.`);
    } else {
      look.hairColor = pick(race.hair);
      look.hairLen = (g === 'm' && chance(0.12)) ? 'bald' : pick(HAIR_LEN);
      const hair = look.hairLen === 'bald' ? 'a shaved head' : `${look.hairLen}, ${pick(HAIR_STYLE)}, ${look.hairColor} hair`;
      desc.push(`${P.Subj} ${P.has} ${hair} and ${eyes} eyes.`);
      if (race.horns && !isDemon) look.horns = 'tiefling';
      desc.push(`${P.Subj} ${P.has} ${pick(SKIN_TEXTURE)} ${skin} skin${look.horns ? ` and ${pick(['curling ram horns', 'swept-back horns', 'short, blunt horns', 'a crown of small horns'])}` : ''}.`);
    }
    look.beard = !!(race.beard && g !== 'f') || (g === 'm' && !race.scales && chance(0.25));
    if (race.beard && g !== 'f') desc.push(`${P.Subj} ${P.v(['wears', 'wear'])} ${pick(['a braided beard', 'a forked beard bound with iron rings', 'a long, magnificent beard', 'a neatly trimmed beard'])}.`);
    const build = pick(BUILDS), shape = pick(FACE_SHAPE);
    look.face = shape;
    desc.push(`${P.Subj} ${P.v(['stands', 'stand'])} ${heightText(between(...race.height))} tall and ${P.has} ${article(build)} ${build} build.`);
    desc.push(`${P.Subj} ${P.has} ${article(shape)} ${shape}, ${pick(FACE_LOOK)} face.`);
    if (isDemon) {
      look.horns = 'demon';
      look.extra = pick(DEMON_EXTRAS);
      desc.push(`The corruption has twisted ${P.poss} body: ${pick(DEMON_HORNS)}, ${look.extra}, and ${pick(DEMON_MARKS)}.`);
    } else if (chance(0.75)) {
      look.mark = pick(MARKS);
      desc.push(`${P.Subj} ${P.has} ${look.mark}.`);
    }
  }

  // Personality, faith, relationships
  const traits = pickN(isDemon ? DEMON_TRAITS : TRAITS, 3);
  const mortalFaith = `${P.Subj} ${P.v(pick(DEVOTION))} ${pick(DEITIES)}.`;
  const faith = isDemon
    ? `The demon spirit driving ${P.obj} calls itself ${spirit}. ${pick([`It answers to ${pick(DEMON_LORDS)}.`, 'It will not say who it serves.', 'It seems as much a prisoner of the ritual as its host.', 'It speaks of "the one who opened the way" with fear.'])}`
    : mortalFaith;
  const alignment = isDemon ? weighted([['Chaotic Evil', 8], ['Neutral Evil', 2]])
    : weighted([['Lawful Good', 3], ['Neutral Good', 4], ['Chaotic Good', 3], ['Lawful Neutral', 3], ['True Neutral', 6], ['Chaotic Neutral', 3], ['Lawful Evil', 1], ['Neutral Evil', 1], ['Chaotic Evil', 1]]);

  // Gear
  const gear = [];
  if (armorKey !== 'none' && ARMOR[armorKey]) gear.push(cap(ARMOR[armorKey].name));
  if (shield) gear.push('Shield');
  for (const w of weapons) gear.push(cap(w));
  if (cls.instrument) gear.push(cap(pick(INSTRUMENTS)));
  if (isCommoner && occ?.[1]) gear.push(cap(occ[1]));
  if (cls.kit) gear.push(...pickN(cls.kit, 3).map(cap));
  if (!isDemon) gear.push(pick(['Common clothes', 'Travelling clothes', 'A patched cloak', 'Fine clothes', 'Sturdy boots and a wool cloak']));

  // Loot (DM only)
  const loot = [];
  if (isCommoner && !isDemon) loot.push(`${roll(2, 6)} sp, ${roll(3, 10)} cp`);
  else {
    const gp = roll(Math.max(1, level), 10) * (level >= 11 ? 10 : level >= 5 ? 3 : 1);
    loot.push(`${gp} gp, ${roll(2, 10)} sp`);
  }
  if (level >= 3 && chance(0.25 + level * 0.03)) {
    const [value, gems] = GEMS[Math.min(GEMS.length - 1, Math.floor(level / 4))];
    const count = between(1, 3);
    loot.push(`${count} ${pick(gems)}${count > 1 ? ' gems' : ''} (${value} gp each)`);
  }
  loot.push(cap(pick(isDemon ? DEMON_TRINKETS : TRINKETS)));
  if (chance(Math.min(0.75, 0.08 + level * 0.035) + (isDemon ? 0.1 : 0))) {
    const t = Math.min(MAGIC.length - 1, Math.floor(level / 5));
    const item = isDemon && chance(0.5) ? pick(DEMON_MAGIC) : pick(MAGIC[Math.max(0, t - (chance(0.5) ? 1 : 0))]);
    loot.push('✨ ' + item.replace('{weapon}', cap(weaponName)));
  }

  // Combat summary
  const features = [...(race.traits || []), ...((cls.features?.(level)) || []).filter(Boolean)];
  const typeLine = isDemon && race.size === 'Small' ? `${race.name} (Small)` : race.name;
  const headline = `${typeLine} ${isCommoner ? cap(role) : `${cls.name} ${level}`} · ${alignment}`;

  const li = (arr) => `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const p = (arr) => arr.map((x) => `<p>${esc(x)}</p>`).join('');
  const abilityLine = ABIL.map((a) => `${a.toUpperCase()} ${sc[a]} (${sgn(m[a])})`).join(' · ');
  const overview = [
    `<p><strong>${esc(headline)}</strong></p>`,
    '<h2>Description</h2>', p(desc),
    '<h2>Personality</h2>', p([...traits, faith]),
    !isDemon
      ? `<h2>Relationships</h2>${p([`${pick(RELATIONSHIPS)}.`, `${cap(pick(FAMILY))}.`])}`
      : `<h2>Before the ritual</h2>${p([`${pick(RELATIONSHIPS)}.`, `${cap(pick(FAMILY))}.`, `${P.Subj} once worshipped ${pick(DEITIES)}${pick(['', ', and still cries out to that god in sleep', ', a faith the demon delights in mocking'])}.`])}`,
    '<h2>Stats</h2>',
    `<p><strong>AC</strong> ${ac} (${esc(acNote)}) · <strong>HP</strong> ${hp} · <strong>Speed</strong> ${speed} ft · <strong>Initiative</strong> ${sgn(m.dex)} · <strong>Proficiency</strong> ${sgn(prof)}</p>`,
    `<p>${abilityLine}</p>`,
    `<p><strong>Attacks</strong>${extra ? ' (Extra Attack)' : ''}</p>`, li(attacks),
    spellsHtml,
    features.length ? `<p><strong>Traits &amp; features</strong></p>${li(features)}` : '',
    '<h2>Gear</h2>', li(gear),
  ].join('');
  const hook = pick(isDemon ? DEMON_HOOKS : HOOKS)(first, spirit);
  const secrets = [
    '<h2>Plot hook</h2>', p([hook]),
    '<h2>Secret</h2>', p([pick(isDemon ? DEMON_SECRETS : SECRETS)]),
    '<h2>Loot</h2>', li(loot),
  ].join('');

  return {
    title: name,
    type: isDemon ? 'Creature' : 'NPC',
    raceKey, classKey: clsKey, level, isDemon,
    headline, ac, hp, speed, init: m.dex, role,
    summary: desc.slice(0, 2).join(' '),
    gear, loot, hook,
    overview, secrets, look, spirit,
    stats: { ac, maxHp: hp, initBonus: m.dex, speed: `${speed} ft` },
  };
}
