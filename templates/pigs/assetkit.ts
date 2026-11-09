// Asset kit loader (2026-11-09). The kit = D:\youtube\public\assetkit (631 CC0/CC-BY stylised models, 9 PBR tiling
// textures, 3 HDRIs; MANIFEST.json + LICENSES.md; contact sheets D:\youtube\out\assetkit\sheet_*.png; rebuild tools
// D:\youtube\assetkit_src\_tools). Quaternius MegaKits (q_village, q_props, q_nature) are the on-target look; KayKit a notch
// below; pirate / older Quaternius / most Poly Pizza = flat low-poly, distance only. 8 Poly Pizza models are CC-BY 3.0
// (credit in the description when on screen): avoid them unless the user agrees.
//
// Usage (inside the short's kit promise, i.e. under Remotion's delayRender):
//   const ak = await loadAssetKit(["q_village/House_Plaster_4x6", "q_props/Barrel"], new GLTFLoader());
//   const tex = await loadGround(["cobblestone"]);
//   placeKit(root, ak, "q_props/Barrel", x, z, yaw)   // pbrTone materials, shadows on, standing on y = 0
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { toneObject, pbrTone } from "./pbr";

export type AssetKit = Record<string, THREE.Object3D>;
export type GroundTex = { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };
type ManEntry = { name: string; file: string; node: string | null; size_m: [number, number, number]; license: string; rigged?: boolean };

let manP: Promise<ManEntry[]> | null = null;
const manifest = () => (manP ??= fetch(staticFile("assetkit/MANIFEST.json")).then((r) => r.json() as Promise<ManEntry[]>));

/** models by manifest name, each normalised: centred on x/z, standing on y = 0, height = the manifest size.
 *  Skinned / rigged models (animals) need SkeletonUtils.clone instead of .clone(true): not handled here. */
export const loadAssetKit = async (names: string[], ld = new GLTFLoader()): Promise<AssetKit> => {
  if (!names.length) return {};
  const by = new Map((await manifest()).map((e) => [e.name, e]));
  const files = [...new Set(names.map((n) => by.get(n)?.file).filter(Boolean) as string[])];
  const scenes = new Map(await Promise.all(files.map(async (f) => [f, (await ld.loadAsync(staticFile(`assetkit/${f}`))).scene] as const)));
  const out: AssetKit = {};
  for (const n of names) {
    const e = by.get(n); if (!e) { console.warn(`assetkit: no "${n}" in MANIFEST.json`); continue; }
    if (e.license !== "CC0-1.0") console.warn(`assetkit: "${n}" is ${e.license}: credit it in the description`);
    const sc = scenes.get(e.file)!; const src = e.node ? sc.getObjectByName(e.node) : sc; if (!src) continue;
    const c = src.clone(true); c.position.set(0, 0, 0); c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c), sz = box.getSize(new THREE.Vector3()), k = e.size_m[1] / Math.max(sz.y, 1e-4);
    const g = new THREE.Group(), inner = new THREE.Group(); inner.add(c);
    inner.position.set(-(box.min.x + sz.x / 2), -box.min.y, -(box.min.z + sz.z / 2)); g.add(inner); g.scale.setScalar(Number.isFinite(k) ? k : 1);
    out[n] = g;
  }
  return out;
};

/** PBR tiling ground / wall textures (public/assetkit/tex/<name>/albedo|normal|rough.jpg; OpenGL normals) */
export const loadGround = async (names: string[]) => {
  const tl = new THREE.TextureLoader(), out: Record<string, GroundTex> = {};
  for (const n of names) {
    const [map, normalMap, roughnessMap] = await Promise.all(["albedo", "normal", "rough"].map((k) => tl.loadAsync(staticFile(`assetkit/tex/${n}/${k}.jpg`))));
    map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, normalMap, roughnessMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    out[n] = { map, normalMap, roughnessMap };
  }
  return out;
};

/** a ground material from a tiling set: tile = metres per texture repeat on a plane of w x d metres */
export const groundMat = (t: GroundTex, w: number, d: number, tile = 2) => {
  const rp = (x: THREE.Texture) => { const c = x.clone(); c.repeat.set(w / tile, d / tile); c.needsUpdate = true; return c; };
  return pbrTone(new THREE.MeshPhysicalMaterial({ map: rp(t.map), normalMap: rp(t.normalMap), roughnessMap: rp(t.roughnessMap), roughness: 1, metalness: 0 }));
};

/** place one kit model (pbrTone materials, casts + receives shadows); returns its group */
export const placeKit = (parent: THREE.Object3D, ak: AssetKit, name: string, x: number, z: number, yaw = 0, s = 1, y = 0) => {
  const src = ak[name]; if (!src) return null;
  const g = new THREE.Group(); g.add(toneObject(src.clone(true)));
  g.position.set(x, y, z); g.rotation.y = yaw; g.scale.setScalar(s); parent.add(g); return g;
};
