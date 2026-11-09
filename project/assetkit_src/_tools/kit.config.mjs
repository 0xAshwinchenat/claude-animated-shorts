// Asset kit build config: which source models go into which output GLB (family), with real-world scale + tags.
// Paths are relative to D:/youtube/assetkit_src. Output: D:/youtube/public/assetkit/<pack>/<file>.glb
import fs from 'fs';
import path from 'path';

export const SRC = 'D:/youtube/assetkit_src';
export const OUT = 'D:/youtube/public/assetkit';

const ls = (dir, rx) => fs.readdirSync(path.join(SRC, dir)).filter((f) => rx.test(f)).sort();
const base = (f) => f.replace(/\.gltf\.glb$|\.gltf$|\.glb$/i, '');

// ---------- license / source blocks ----------
export const PACKS = {
  q_village: { style: 'stylised hand-painted PBR (2K trim sheets: albedo + normal + roughness/ORM, resized to 1K) - closest to the target look', title: 'Medieval Village MegaKit (Standard, free tier)', author: 'Quaternius', license: 'CC0-1.0', url: 'https://quaternius.com/packs/medievalvillagemegakit.html', dl: 'https://quaternius.itch.io/medieval-village-megakit' },
  q_props: { style: 'stylised hand-painted PBR (trim sheets with albedo + normal + ORM, 1K) - closest to the target look', title: 'Fantasy Props MegaKit (Standard, free tier)', author: 'Quaternius', license: 'CC0-1.0', url: 'https://quaternius.com/packs/fantasypropsmegakit.html', dl: 'https://quaternius.itch.io/fantasy-props-megakit' },
  q_nature: { style: 'stylised textured (bark albedo + normal, alpha-cut painted leaf cards, vertex AO) - target look', title: 'Stylized Nature MegaKit (Standard, free tier)', author: 'Quaternius', license: 'CC0-1.0', url: 'https://quaternius.com/packs/stylizednaturemegakit.html', dl: 'https://quaternius.itch.io/stylized-nature-megakit' },
  q_pirate: { style: 'smooth-shaded stylised, single small colour atlas (flat colours, bevelled shapes)', title: 'Pirate Kit (Nov 2023)', author: 'Quaternius', license: 'CC0-1.0', url: 'https://quaternius.com/packs/piratekit.html', dl: 'https://drive.google.com/drive/folders/1KjMzhVsDcyvYMWeVjZcRfuu8auBLpNi2' },
  q_animals: { style: 'faceted low-poly, flat material colours, rigged + animated', title: 'Ultimate Animated Animal Pack', author: 'Quaternius', license: 'CC0-1.0', url: 'https://quaternius.com/packs/ultimateanimatedanimals.html', dl: 'https://drive.google.com/drive/folders/1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk' },
  q_farm: { style: 'faceted low-poly, flat material colours (static)', title: 'Farm Animals Pack', author: 'Quaternius', license: 'CC0-1.0', url: 'https://quaternius.com/packs/farmanimal.html', dl: 'https://drive.google.com/drive/folders/1is1ax2V0mIEDS7BbbzBV_x2Pabya1dVJ' },
  q_ships: { style: 'faceted low-poly, flat material colours', title: 'Ships Pack', author: 'Quaternius', license: 'CC0-1.0', url: 'https://quaternius.com/packs/ships.html', dl: 'https://drive.google.com/drive/folders/1Qf31QTnGfxRzYxx8dHmlVGDT4KmIa0Vy' },
  q_ruins: { style: 'bevelled low-poly, flat material colours', title: 'Ultimate Modular Ruins Pack', author: 'Quaternius', license: 'CC0-1.0', url: 'https://quaternius.com/packs/ultimatemodularruins.html', dl: 'https://drive.google.com/drive/folders/1ETp2ldaHaP0BkS4FBmkT-g9Yf88T_cIX' },
  k_hex: { style: 'KayKit smooth gradient-atlas low-poly, chunky toy proportions', title: 'KayKit Medieval Hexagon Pack 1.0', author: 'Kay Lousberg', license: 'CC0-1.0', url: 'https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0', dl: 'https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0' },
  k_dungeon: { style: 'KayKit smooth gradient-atlas low-poly, chunky proportions', title: 'KayKit Dungeon Remastered 1.0', author: 'Kay Lousberg', license: 'CC0-1.0', url: 'https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0', dl: 'https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0' },
  k_food: { style: 'KayKit smooth gradient-atlas low-poly', title: 'KayKit Restaurant Bits 1.0', author: 'Kay Lousberg', license: 'CC0-1.0', url: 'https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0', dl: 'https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0' },
  k_grave: { style: 'KayKit smooth gradient-atlas low-poly', title: 'KayKit Halloween Bits 1.0', author: 'Kay Lousberg', license: 'CC0-1.0', url: 'https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0', dl: 'https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0' },
  k_weapons: { style: 'KayKit smooth gradient-atlas low-poly', title: 'KayKit Adventurers Character Pack 1.0 (weapon/prop models only)', author: 'Kay Lousberg', license: 'CC0-1.0', url: 'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0', dl: 'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0' },
  pp: { style: 'see entry (mostly flat-colour low-poly)', title: 'Poly Pizza single models (various authors)', author: 'various (see entry)', license: 'see entry', url: 'https://poly.pizza', dl: 'https://poly.pizza' },
};

// ---------- helpers ----------
const ERA = { any: ['ancient', 'medieval', 'early_modern'], med: ['medieval', 'early_modern'], anc: ['ancient'], ancmed: ['ancient', 'medieval'], em: ['early_modern'] };

const items = (pack, dir, rx, fn) => ls(dir, rx).map((f) => {
  const n = base(f); const o = fn(n);
  if (!o) return null;
  return { pack, node: n, src: path.join(dir, f), ...o };
}).filter(Boolean);

// ---------- families ----------
export const FAMILIES = [];

// Quaternius Medieval Village MegaKit: modular building pieces (2 m wall grid, 3 m storey), native pivots, real scale
{
  const dir = 'q_village/x/Medieval Village MegaKit[Standard]/glTF';
  FAMILIES.push({ pack: 'q_village', file: 'q_village/village_modular.glb', maxTex: 1024, items: items('q_village', dir, /\.gltf$/, (n) => ({
    scale: 1, eras: ERA.med,
    category: /^Prop_(Crate|Wagon|Brick)/.test(n) ? 'prop' : /^Prop_Vine/.test(n) ? 'building_modular/decor' : /^Prop_/.test(n) ? 'building_modular/fence_trim' : /^Roof|Overhang_Roof|Window_Roof/.test(n) ? 'building_modular/roof' : /^Wall|Corner|Overhang/.test(n) ? 'building_modular/wall' : /^Floor|HoleCover/.test(n) ? 'building_modular/floor' : /^Stair/.test(n) ? 'building_modular/stairs' : /^Door|Window|Balcony/.test(n) ? 'building_modular/door_window' : 'building_modular',
    notes: 'modular piece: native pivot kept (walls 2 m wide x 3 m storey, centred on x, base at y=0)',
  })), prefabs: VILLAGE_PREFABS() });
}

// Ready-made houses assembled from the village pieces (W x D modules of 2 m, 3 m storeys; origin = ground centre,
// front door faces +z, roof ridge along z). Each storey: { mat: 'Plaster' | 'UnevenBrick', door?: bool, win?: 'Wide' | 'Thin' | 'Grid' }
function VILLAGE_PREFABS() {
  const house = (node, W, D, storeys, notes) => {
    const parts = []; const hx = W, hz = D; // half extents in metres (module = 2 m)
    storeys.forEach((st, s) => {
      const y = 3 * s; const M = st.mat;
      const winPiece = st.win === 'Thin' ? [`Wall_${M}_Window_Thin_Round`, 'Window_Thin_Round1'] : st.win === 'Grid' && M === 'Plaster' ? ['Wall_Plaster_WoodGrid', null] : st.win ? [`Wall_${M}_Window_Wide_Round`, 'Window_Wide_Round1'] : [`Wall_${M}_Straight`, null];
      const side = (n, at, rot, front) => {
        for (let i = 0; i < n; i++) {
          const u = -n + 1 + 2 * i; const [x, z] = at(u);
          const mid = i === Math.floor((n - 1) / 2);
          let wall = `Wall_${M}_Straight`, insert = null;
          if (front && st.door && mid) { wall = `Wall_${M}_Door_Round`; insert = 'Door_1_Round'; }
          else if (st.win && (front || i % 2 === 0)) [wall, insert] = winPiece;
          parts.push([wall, x, y, z, rot]); if (insert) parts.push([insert, x, y, z, rot]);
        }
      };
      side(W, (u) => [u, hz], 0, true);
      side(W, (u) => [-u, -hz], 180, false);
      side(D, (u) => [hx, -u], 90, false);
      side(D, (u) => [-hx, u], -90, false);
      const corner = M === 'UnevenBrick' ? 'Corner_Exterior_Brick' : 'Corner_Exterior_Wood';
      for (const [cx, cz] of [[hx, hz], [-hx, hz], [hx, -hz], [-hx, -hz]]) parts.push([corner, cx, y, cz, 0]);
      if (s > 0) for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) parts.push(['Floor_WoodDark', -hx + 1 + 2 * i, y, -hz + 1 + 2 * j, 0]);
    });
    const top = 3 * storeys.length;
    parts.push([`Roof_RoundTiles_${2 * W}x${2 * D}`, 0, top, 0, 0]);
    parts.push([`Roof_Front_Brick${2 * W}`, 0, top, hz, 0]);
    parts.push([`Roof_Front_Brick${2 * W}`, 0, top, -hz, 180]);
    return { node, parts, category: 'building_prefab', eras: ['medieval', 'early_modern'], notes: `prefab house ${2 * W}x${2 * D} m, ${storeys.length} storey(s), assembled from village pieces (shares their meshes); origin ground centre, door faces +z. ${notes || ''}` };
  };
  return [
    house('House_StonePlaster_4x4', 2, 2, [{ mat: 'UnevenBrick', door: true, win: 'Thin' }, { mat: 'Plaster', win: 'Wide' }]),
    house('House_Plaster_4x6', 2, 3, [{ mat: 'Plaster', door: true, win: 'Wide' }, { mat: 'Plaster', win: 'Thin' }]),
    house('House_Stone_6x8', 3, 4, [{ mat: 'UnevenBrick', door: true, win: 'Wide' }], 'single-storey hall / barn / tavern'),
    house('House_Tall_4x4', 2, 2, [{ mat: 'UnevenBrick', door: true }, { mat: 'Plaster', win: 'Wide' }, { mat: 'Plaster', win: 'Thin' }], 'three-storey townhouse'),
  ];
}

// Quaternius Fantasy Props MegaKit: real-world scale props sharing 4 trim sheets
{
  const dir = 'q_props/x/Exports/glTF';
  const skip = /^(Potion_[0-9]|SmallBottle$|SmallBottles_1|Key_|Coin$|Table_(Fork|Knife|Spoon))/;
  const cat = (n) => /Sword|Axe|Shield|WeaponStand|Dummy|Pickaxe/.test(n) ? 'military' : /Book|Scroll/.test(n) ? 'prop_book_scroll' : /Barrel|Crate|Chest|Bag|Pouch|Bucket|Pot_|Vase|Cauldron|Coin_Pile/.test(n) ? 'prop_container' : /Table|Chair|Stool|Bench|Bed|Cabinet|Shelf|Bookcase|Nightstand|Workbench|Peg_Rack/.test(n) ? 'furniture' : /Candle|Lantern|Torch|Chandelier/.test(n) ? 'light' : /Stall|FarmCrate|Carrot|Barrel_Apples/.test(n) ? 'market' : /Anvil|Whetstone|Rope|Chain|Cage/.test(n) ? 'prop_tool' : /Banner/.test(n) ? 'decor_banner' : 'prop';
  FAMILIES.push({ pack: 'q_props', file: 'q_props/fantasy_props.glb', maxTex: 1024, items: items('q_props', dir, /\.gltf$/, (n) => skip.test(n) ? null : ({ scale: 1, eras: /Book|Scroll|Chandelier|Bookcase/.test(n) ? ERA.med : ERA.any, category: cat(n) })) });
}

// Quaternius Stylized Nature MegaKit: trees by species (shared bark/leaf textures), plants, rocks
{
  const dir = 'q_nature/x/glTF';
  const tree = (rx, file) => FAMILIES.push({ pack: 'q_nature', file, maxTex: 1024, items: items('q_nature', dir, rx, () => ({ scale: 1, eras: ERA.any, category: 'nature_tree' })) });
  tree(/^CommonTree_\d\.gltf$/, 'q_nature/trees_common.glb');
  tree(/^Pine_\d\.gltf$/, 'q_nature/trees_pine.glb');
  FAMILIES.push({ pack: 'q_nature', file: 'q_nature/trees_cypress.glb', maxTex: 1024, items: [
    ...items('q_nature', dir, /^Pine_3\.gltf$/, () => ({ scaleXYZ: [0.42, 1.3, 0.42], eras: ERA.any, category: 'nature_tree', node: 'Cypress_1', notes: 'slim conifer, Pine_3 squeezed (x0.42, y1.3, z0.42); only a DISTANT cypress stand-in (bare lower trunk, real cypress foliage reaches the ground)' })),
    ...items('q_nature', dir, /^Pine_1\.gltf$/, () => ({ scaleXYZ: [0.36, 1.15, 0.36], eras: ERA.any, category: 'nature_tree', node: 'Cypress_2', notes: 'slim conifer, Pine_1 squeezed (x0.36, y1.15, z0.36); only a DISTANT cypress stand-in (bare lower trunk)' })),
  ] });
  tree(/^TwistedTree_\d\.gltf$/, 'q_nature/trees_twisted.glb');
  tree(/^DeadTree_\d\.gltf$/, 'q_nature/trees_dead.glb');
  // small plants are modelled ~2x real size in this kit -> 0.45
  FAMILIES.push({ pack: 'q_nature', file: 'q_nature/plants.glb', maxTex: 1024, items: items('q_nature', dir, /^(Bush|Clover|Fern|Flower|Grass|Plant|Mushroom)_.*\.gltf$/, (n) => ({ scale: /^Bush/.test(n) ? 0.8 : /^Mushroom/.test(n) ? 0.35 : 0.45, eras: ERA.any, category: 'nature_plant' })) });
  // recoloured variants: the red maple-like TwistedTree leaves hue-shifted to a grey olive green (olive / oak stand-in), green bush
  FAMILIES.push({ pack: 'q_nature', file: 'q_nature/trees_twisted_olive.glb', maxTex: 1024, recolor: [{ rx: /Leaves_TwistedTree/, hue: 95, saturation: 0.55, brightness: 1.25 }],
    items: [...items('q_nature', dir, /^TwistedTree_\d\.gltf$/, (n) => ({ scale: 0.75, eras: ERA.any, category: 'nature_tree', node: n.replace('TwistedTree', 'TwistedTree_Olive'), notes: 'leaf texture hue-shifted from the red original (olive/oak stand-in), scaled 0.75' })),
      ...items('q_nature', dir, /^Bush_Common\.gltf$/, () => ({ scale: 0.8, eras: ERA.any, category: 'nature_plant', node: 'Bush_Common_Green', notes: 'leaf texture hue-shifted from red to green' }))] });
  FAMILIES.push({ pack: 'q_nature', file: 'q_nature/rocks.glb', maxTex: 1024, items: items('q_nature', dir, /^(Rock_Medium_\d|RockPath_(Round|Square)_(Wide|Thin)|Pebble_(Round|Square)_[1-3])\.gltf$/, (n) => ({ scale: 1, eras: ERA.any, category: /RockPath/.test(n) ? 'nature_rock/path' : 'nature_rock' })) });
}

// Quaternius Pirate Kit: one atlas, chunky stylised scale -> per-model real-world scale
{
  const dir = 'q_pirate/gltf';
  const S = { Environment_PalmTree_1: 2.6, Environment_PalmTree_2: 2.8, Environment_PalmTree_3: 2.8, Environment_Rock_1: 1.6, Environment_Rock_2: 1.6, Environment_Rock_3: 1.6, Environment_Rock_4: 1.6, Environment_Rock_5: 1.6, Prop_Anchor: 1.6, Prop_Barrel: 1.3, Prop_Bottle_1: 0.35, Prop_Bottle_2: 0.6, Prop_Bucket: 0.55, Prop_Bucket_Fishes: 0.55, Prop_Cannon: 1.2, Prop_CannonBall: 0.45, Prop_Chest_Closed: 0.7, Prop_Chest_Gold: 0.7, Prop_Coins: 0.6, Prop_Fish_Mackerel: 0.3, Prop_Fish_Tuna: 0.7, Prop_GoldBag: 0.6, Ship_Large: 1.6, Ship_Small: 1.2, UI_ChickenLeg: 0.35, UI_Wheat: 1.4, UI_Wood: 1.2, Weapon_Axe: 0.8, Weapon_Cutlass: 0.75, Weapon_DoubleAxe: 0.9, Weapon_Lute: 0.75, Weapon_Sword_1: 0.72, Weapon_Sword_2: 0.75 };
  const skip = /^(Environment_(LargeBones|Skulls|House\d)|Prop_(Bomb|Skull|Bottle_\d|Chest_Gold)|UI_(Rocks|Wheat)|Weapon_(Dagger|Sword_2))/;
  const cat = (n) => /PalmTree/.test(n) ? 'nature_tree' : /Rock|Cliff/.test(n) ? 'nature_rock' : /Ship/.test(n) ? 'boat' : /Dock/.test(n) ? 'structure_dock' : /House|Sawmill/.test(n) ? 'building' : /Weapon_Lute/.test(n) ? 'prop' : /Weapon|Cannon/.test(n) ? 'military' : /Fish|Chicken|Wheat/.test(n) ? 'food' : /Wood/.test(n) ? 'prop_resource' : 'prop_container';
  FAMILIES.push({ pack: 'q_pirate', file: 'q_pirate/pirate_kit.glb', maxTex: 1024, items: items('q_pirate', dir, /\.gltf$/, (n) => skip.test(n) ? null : ({ scale: S[n] ?? 1, eras: /Cannon|Ship_Large/.test(n) ? ERA.em : ERA.any, category: cat(n), node: n.replace(/^Environment_|^UI_/, '') })) });
}

// Quaternius animated animals: one GLB each (rigged + animated), scaled to a real height
{
  const dir = 'q_animals/gltf';
  const H = { Horse: 2.0, Horse_White: 2.0, Cow: 1.55, Bull: 1.65, Donkey: 1.45, Deer: 1.6, Stag: 2.1, Husky: 0.75, ShibaInu: 0.62, Wolf: 0.85, Fox: 0.5, Alpaca: 1.8 };
  for (const f of ls(dir, /\.gltf$/)) {
    const n = base(f);
    FAMILIES.push({ pack: 'q_animals', file: `q_animals/${n.toLowerCase()}.glb`, maxTex: 1024, keepAnims: true, items: [{ pack: 'q_animals', node: n, src: path.join(dir, f), targetH: H[n], eras: ERA.any, category: 'animal', notes: 'rigged + animated (skinned); faceted low-poly look' }] });
  }
}

// OBJ-converted Quaternius packs (farm animals, ships, ruins) -- flat colour materials
FAMILIES.push({ pack: 'q_farm', file: 'q_farm/farm_animals.glb', maxTex: 1024, items: [
  { pack: 'q_farm', node: 'Pig', src: '_conv/q_farm/Pig.glb', targetH: 0.95, eras: ERA.any, category: 'animal', notes: 'static (not rigged); faceted low-poly' },
  { pack: 'q_farm', node: 'Sheep', src: '_conv/q_farm/Sheep.glb', targetH: 1.05, eras: ERA.any, category: 'animal', notes: 'static (not rigged); faceted low-poly' },
] });
FAMILIES.push({ pack: 'q_ships', file: 'q_ships/ships.glb', maxTex: 1024, items: [
  { pack: 'q_ships', node: 'Viking_boat', src: '_conv/q_ships/Viking_boat.glb', targetL: 18, eras: ['medieval'], category: 'boat' },
  { pack: 'q_ships', node: 'Sail_ship', src: '_conv/q_ships/Sail_ship.glb', targetL: 30, eras: ERA.em, category: 'boat' },
  { pack: 'q_ships', node: 'BoatWSail', src: '_conv/q_ships/BoatWSail.glb', targetL: 6, eras: ERA.any, category: 'boat' },
  { pack: 'q_ships', node: 'Boat', src: '_conv/q_ships/Boat.glb', targetL: 4, eras: ERA.any, category: 'boat' },
] });
{
  const R = ['Column_Round', 'Column_Round_Short', 'Column_Square', 'Arch_Round', 'Arch_Round_RoundColumn', 'Wall_ArchRound_Broken', 'Wall_Broken', 'Stairs', 'Pot1', 'Pot2', 'Pot3', 'Pot1_Broken', 'Pot2_Broken', 'Pot3_Broken', 'Bricks', 'Statue_Stag'];
  // the ruins kit is ~ real scale already (column 4 m, pot 0.96 m)
  FAMILIES.push({ pack: 'q_ruins', file: 'q_ruins/ruins.glb', maxTex: 1024, items: R.map((n) => ({ pack: 'q_ruins', node: n, src: `_conv/q_ruins/${n}.glb`, scale: /^Pot/.test(n) ? 0.8 : 1, eras: /Column|Arch|Pot/.test(n) ? ERA.ancmed : ERA.any, category: /Pot/.test(n) ? 'prop_container' : /Cart/.test(n) ? 'vehicle' : /Torch/.test(n) ? 'light' : /Statue/.test(n) ? 'decor' : 'structure_ruin' })) });
}

// KayKit Medieval Hexagon: toy-scale buildings (x7) and props (x4.3), single gradient atlas
{
  const H = 'k_medieval-hexagon-pack/x/KayKit-Medieval-Hexagon-Pack-1.0-main/addons/kaykit_medieval_hexagon_pack/Assets/gltf';
  const b = items('k_hex', `${H}/buildings/blue`, /\.gltf$/, (n) => ({ scale: /well/.test(n) ? 3.5 : 7, eras: ERA.med, category: 'building', node: n.replace(/_blue$/, '') }));
  const nb = items('k_hex', `${H}/buildings/neutral`, /\.gltf$/, (n) => /dirt|grain|bridge|projectile/.test(n) ? null : ({ scale: /fence/.test(n) ? 2 : /projectile/.test(n) ? 3 : 7, eras: ERA.med, category: /wall|fence/.test(n) ? 'structure_wall' : /bridge/.test(n) ? 'structure_bridge' : 'building' }));
  const pr = items('k_hex', `${H}/decoration/props`, /\.gltf$/, (n) => /^(flag_|crate_[AB]_|bucket_(empty|water)|barrel$|crate_long_empty|pallet|weaponrack|tent|sack)/.test(n) ? null : ({ scale: 4.3, eras: ERA.med, category: /weaponrack|target|bucket_arrows/.test(n) ? 'military' : /tent/.test(n) ? 'structure_tent' : /flag/.test(n) ? 'decor_banner' : 'prop' }));
  const cl = items('k_hex', `${H}/decoration/nature`, /^cloud_.*\.gltf$/, () => ({ scale: 12, eras: ERA.any, category: 'sky_cloud' }));
  const red = items('k_hex', `${H}/buildings/red`, /\.gltf$/, (n) => /tower_(A|B|base|catapult)|archeryrange|barracks|mine|lumbermill|castle/.test(n) ? null : ({ scale: /well/.test(n) ? 3.5 : 7, eras: ERA.med, category: 'building', notes: 'red-roof colour variant' }));
  FAMILIES.push({ pack: 'k_hex', file: 'k_hex/hex_buildings.glb', maxTex: 1024, items: [...b, ...nb, ...red] });
  FAMILIES.push({ pack: 'k_hex', file: 'k_hex/hex_props.glb', maxTex: 1024, items: [...pr, ...cl] });
}

// KayKit Dungeon Remastered: chunky ~1.4x scale -> 0.7
{
  const D = 'k_dungeon-remastered/x/KayKit-Dungeon-Remastered-1.0-main/addons/kaykit_dungeon_remastered/Assets/gltf';
  const keep = /^(banner_(red|blue|patternA_red|patternB_blue|patternC_green|shield_red|thin_brown|triple_yellow)|barrel_|bed_(decorated|frame)|box_|chair|chest|coin_stack|crates_stacked|keg|pillar|plate|rubble|shelf_(large|small)$|shelves|stairs$|stairs_wood|stool|sword_shield|table_(long|medium|small)|torch|trunk_(large|medium|small)_A|wall(_arched|_broken|_corner|_doorway|_half|_pillar|_window_open|_window_closed|_gated|_endcap)?$|floor_tile_large|floor_wood_large)/;
  const skip = /labeled|decorated_C|broken$|table_small_decorated_B|^wall_doorway$/; // wall_doorway: its ring knocker reads as a '6'
  FAMILIES.push({ pack: 'k_dungeon', file: 'k_dungeon/dungeon_props.glb', maxTex: 1024, items: items('k_dungeon', D, /\.glb$/, (n) => (!keep.test(n) || skip.test(n)) ? null : ({ scale: /^coin_stack/.test(n) ? 0.2 : /^plate/.test(n) ? 0.26 : 0.7, eras: ERA.med, category: /wall|pillar|column|stairs|floor|barrier|rubble/.test(n) ? 'structure_stone' : /banner/.test(n) ? 'decor_banner' : /sword/.test(n) ? 'military' : /candle|torch/.test(n) ? 'light' : /chair|stool|table|bed|shelf|shelves/.test(n) ? 'furniture' : 'prop_container' })) });
}

// KayKit Restaurant Bits: market food crates + produce + cookware (modern appliances skipped)
{
  const D = 'k_restaurant-bits/x/KayKit-Restaurant-Bits-1.0-main/addons/kaykit_restaurant_bits/Assets/gltf';
  const keep = /^(crate(_(carrots|cheese|ham|lettuce|onions|potatoes|steak|tomatoes|buns))?$|food_ingredient_(carrot|cheese|ham|ham_cooked|lettuce|onion|potato|steak|tomato)$|food_stew|food_dinner|jar_[CD]_(large|small)|pot_(A|B)(_stew)?$|bowl$|plate$|cuttingboard|stew_bowl)/;
  const sc = (n) => /^crate/.test(n) ? 0.4 : /^food_ingredient/.test(n) ? 0.2 : /^jar/.test(n) ? 0.45 : /^pot_large/.test(n) ? 0.4 : /^pot_/.test(n) ? 0.35 : /^(bowl|plate|stew_bowl|food_stew|food_dinner)/.test(n) ? 0.3 : /^cuttingboard|pan_A|knife/.test(n) ? 0.3 : 0.75;
  FAMILIES.push({ pack: 'k_food', file: 'k_food/food_market.glb', maxTex: 1024, items: items('k_food', D, /\.gltf$/, (n) => !keep.test(n) ? null : ({ scale: sc(n), eras: /tomato|potato/.test(n) ? ERA.em : ERA.any, category: /^(crate|food)/.test(n) ? 'food' : /chair|table/.test(n) ? 'furniture' : 'prop_kitchen' })) });
}

// KayKit Halloween Bits: graveyard / fences / lanterns / dead + autumn trees
{
  const D = 'k_halloween-bits/x/KayKit-Halloween-Bits-1.0-main/addons/kaykit_halloween_bits/Assets/gltf';
  const skip = /^(candle|plaque|pumpkin_.*(jackolantern|small)|skull|post_skull|floor_dirt|bone_|coffin_decorated|gravestone|grave_A|ribcage|shrine_candles|tree_|bench_decorated)/;
  const sc = (n) => /^fence/.test(n) ? 0.6 : /^arch/.test(n) ? 0.8 : /^grave|gravestone|gravemarker/.test(n) ? 0.7 : /^lantern/.test(n) ? 0.5 : /^skull/.test(n) ? 0.25 : /^bone/.test(n) ? 0.4 : /^ribcage/.test(n) ? 0.5 : /^pumpkin/.test(n) ? 0.5 : /^(pillar|coffin|crypt|shrine|post)/.test(n) ? 0.75 : 1;
  FAMILIES.push({ pack: 'k_grave', file: 'k_grave/graveyard.glb', maxTex: 1024, items: items('k_grave', D, /\.gltf$/, (n) => skip.test(n) ? null : ({ scale: sc(n), eras: /pumpkin/.test(n) ? ERA.em : ERA.any, category: /^tree/.test(n) ? 'nature_tree' : /^fence|^arch|^post|^pillar/.test(n) ? 'structure_fence' : /^lantern/.test(n) ? 'light' : /^path|^floor/.test(n) ? 'terrain_path' : /^pumpkin/.test(n) ? 'food' : 'decor_grave' })) });
}

// KayKit Adventurers: weapon + prop models only (no characters)
{
  const D = 'k_adventurers/x/KayKit-Character-Pack-Adventures-1.0-main/addons/kaykit_character_pack_adventures/Assets/gltf';
  const keep = /^(arrow|arrow_bundle|axe_1handed|axe_2handed|crossbow_2handed|dagger|mug_full|quiver|shield_(round|round_color|square|square_color)|sword_1handed)$/;
  const sc = (n) => /^shield/.test(n) ? 0.85 : /^arrow/.test(n) ? 1.0 : /^mug/.test(n) ? 0.3 : /^staff/.test(n) ? 0.8 : 0.55;
  FAMILIES.push({ pack: 'k_weapons', file: 'k_weapons/weapons.glb', maxTex: 1024, items: items('k_weapons', D, /\.gltf$/, (n) => !keep.test(n) ? null : ({ scale: sc(n), eras: /crossbow/.test(n) ? ERA.med : ERA.any, category: /mug/.test(n) ? 'prop' : 'military' })) });
}

// Poly Pizza singles: one GLB each, scaled to a target height (H) or length (L)
{
  const P = [
    ['DGIM5HGISb', 'market_stand_a', 'H', 2.6, 'market', ERA.any], ['hts7l0NZxW', 'market_stand_b', 'H', 2.6, 'market', ERA.any],
    ['l7bDe7ak6j', 'market_cart', 'H', 2.4, 'market', ERA.any], ['NBDHe8J7f9', 'cart_broken', 'L', 2.8, 'vehicle', ERA.any],
    ['QlqncKYxXb', 'well_roofed', 'H', 3.2, 'structure', ERA.med], ['5Q7qIrfDxA', 'tent_army', 'H', 2.0, 'structure_tent', ERA.any],
    ['n8ZvVFcJhl', 'plinth_round', 'H', 1.4, 'structure_column', ERA.anc], ['VE1kTjVgJf', 'pedestal_a', 'H', 1.2, 'structure_column', ERA.anc],
    ['wUeoDKnFBF', 'pedestal_b', 'H', 1.2, 'structure_column', ERA.anc],     ['3zA9NtYBEi', 'spear_a', 'L', 2.2, 'military', ERA.any], ['fH1zmvjPNx', 'spear_b', 'H', 2.2, 'military', ERA.any],
    ['QnpqjLSKFU', 'bow_wood', 'H', 1.4, 'military', ERA.any], ['H6vbuPvWtg', 'bow_b', 'L', 1.3, 'military', ERA.any],
    ['3PTJlHnOfU', 'quiver_b', 'L', 0.7, 'military', ERA.any], ['UKXj8qjiF8', 'shield_round_rim', 'H', 0.85, 'military', ERA.any],
    ['srN1KGAO7f', 'shield_kite', 'H', 1.0, 'military', ERA.med], ['fHMy0Xrb0V', 'pot_ceramic_large', 'H', 0.6, 'prop_container', ERA.any],
    ['FfvhIuFaLu', 'jug_clay', 'H', 0.45, 'prop_container', ERA.any], ['aXulVWHOeV', 'fruit_crate', 'L', 0.6, 'market', ERA.any],
    ['G6FktIrBkj', 'fruit_bowl', 'L', 0.35, 'food', ERA.any], ['y4oGHRpJVH', 'bread_loaf', 'L', 0.3, 'food', ERA.any],
    ['IjbI8PCtUg', 'pots_stacked', 'H', 0.6, 'prop_container', ERA.any], ['XWl86YFtpF', 'fish_salmon', 'L', 0.6, 'food', ERA.any],
    ['fei4I7FfrJ', 'log_pile', 'L', 2.5, 'prop_resource', ERA.any],
    ['ux44tbeQvj', 'bell_tower', 'H', 16, 'building', ERA.med], ['svYG8KZxjq', 'banner_hanging', 'H', 2.5, 'decor_banner', ERA.any],
    ['AK9CmjFnL6', 'horse_statue', 'H', 4.0, 'decor', ERA.any], ['Yu8TOERkpw', 'hay_sheaf', 'H', 1.2, 'prop_resource', ERA.any],
    ['9ahVI0EijEi', 'catapult_a', 'L', 5, 'siege', ERA.ancmed], ['7P_ZOjZbbMJ', 'catapult_b', 'L', 5, 'siege', ERA.ancmed],
    ['57i2bNkXblU', 'camel_a', 'H', 2.1, 'animal', ERA.any],
    ['3AfO8NwcxD', 'elephant_a', 'H', 3.0, 'animal', ERA.any],
    ['cdMQnl19MB9', 'greek_temple', 'L', 30, 'building', ERA.anc], ['3GnC-e_xWS-', 'roman_pillar', 'H', 5, 'structure_column', ERA.anc],
    ['5VD5-v8NBZ4', 'doric_column', 'H', 6, 'structure_column', ERA.anc], ['agiRDMN0VR', 'roman_arch', 'H', 8, 'structure', ERA.anc],
  ];
  for (const [pid, name, mode, v, category, eras] of P) {
    const meta = JSON.parse(fs.readFileSync(path.join(SRC, 'polypizza', pid, 'meta.json'), 'utf8'));
    FAMILIES.push({ pack: 'pp', file: `pp/${name}.glb`, maxTex: 1024, keepAnims: true, items: [{ pack: 'pp', node: name, src: `polypizza/${pid}/model.glb`, [mode === 'H' ? 'targetH' : 'targetL']: v, eras, category,
      style: 'flat-colour low-poly (' + meta.creator + ')', license: meta.Licence.startsWith('CC0') ? 'CC0-1.0' : meta.Licence.replace('CC-BY 3.0', 'CC-BY-3.0'), author: meta.creator, source_url: meta.url, title: meta.Title }] });
  }
}
