// Asset kit contact sheet (internal QA only): every model in public/assetkit/MANIFEST.json in a numbered grid,
// one sheet per frame. Neutral studio light (hemisphere + directional + RoomEnvironment), materials as shipped.
// Render: npx remotion still src/sandboxes/assetkit_sheet/index.tsx AssetkitSheet out/assetkit/sheet_01.png --frame=0
// props: { filter?: regex on name/category/pack, cols?, rows? }
import React, { useEffect, useRef, useState } from "react";
import { Composition, registerRoot, staticFile, useCurrentFrame, delayRender, continueRender, CalculateMetadataFunction } from "remotion";
import * as THREE from "three";
import { GLTFLoader, GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

type Entry = { name: string; file: string; node: string | null; category: string; size_m: number[]; tris: number; license: string; rigged: boolean; animations: string[] };
type Props = { filter?: string; cols?: number; rows?: number; start?: number; az?: number };

const W = 1600, H = 1600;
const loadManifest = async (): Promise<Entry[]> => (await fetch(staticFile("assetkit/MANIFEST.json"))).json();
const pick = (all: Entry[], filter?: string) => {
  const rx = filter ? new RegExp(filter, "i") : null;
  return all.map((e, i) => ({ ...e, idx: i + 1 })).filter((e) => !rx || rx.test(`${e.name} ${e.category} ${e.file}`));
};

const gltfCache = new Map<string, Promise<GLTF>>();
const loadGltf = (file: string) => {
  if (!gltfCache.has(file)) gltfCache.set(file, new GLTFLoader().loadAsync(staticFile(`assetkit/${file}`)));
  return gltfCache.get(file)!;
};

// one fresh mount (and delayRender handle) per frame, so labels and canvas always belong to the same page
const Sheet: React.FC<Props> = (p) => { const frame = useCurrentFrame(); return <Page key={frame} frame={frame} {...p} />; };

const Page: React.FC<Props & { frame: number }> = ({ frame, filter, cols = 5, rows = 5, az: azDeg = 35 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [labels, setLabels] = useState<{ x: number; y: number; t1: string; t2: string; err?: boolean }[]>([]);
  const [handle] = useState(() => delayRender("assetkit sheet", { timeoutInMilliseconds: 240000 }));

  useEffect(() => {
    let done = false;
    let renderer: THREE.WebGLRenderer | null = null;
    (async () => {
      const all = pick(await loadManifest(), filter);
      const per = cols * rows;
      const list = all.slice(frame * per, frame * per + per);
      const cw = Math.floor(W / cols), ch = Math.floor(H / rows);
      renderer = new THREE.WebGLRenderer({ canvas: ref.current!, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(W, H, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.setScissorTest(true);
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.55;
      scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a5048, 1.1));
      const sun = new THREE.DirectionalLight(0xfff4e6, 2.2);
      sun.position.set(4, 7, 5);
      scene.add(sun);
      const out: typeof labels = [];
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        const c = i % cols, r = Math.floor(i / cols);
        const x = c * cw, y = r * ch;
        renderer.setViewport(x, H - y - ch, cw, ch);
        renderer.setScissor(x, H - y - ch, cw, ch);
        renderer.setClearColor((c + r) % 2 ? 0xc3c7cd : 0xcdd1d6, 1);
        renderer.clear();
        const t2 = `${e.size_m.map((v) => v.toFixed(2)).join("x")} m  ${e.tris}t${e.rigged ? "  rig" : ""}${e.license.startsWith("CC-BY") ? "  CC-BY" : ""}`;
        try {
          const g = await loadGltf(e.file);
          const obj = e.node ? g.scene.getObjectByName(e.node) : g.scene;
          if (!obj) throw new Error("node not found");
          const parent = obj.parent;
          scene.add(obj);
          let mixer: THREE.AnimationMixer | null = null;
          if (e.rigged && g.animations.length) {
            mixer = new THREE.AnimationMixer(obj);
            const clip = g.animations.find((a) => /^idle$/i.test(a.name)) || g.animations.find((a) => /idle/i.test(a.name)) || g.animations[0];
            mixer.clipAction(clip).play();
            mixer.update(0.3);
          }
          obj.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(obj, true);
          const sph = box.getBoundingSphere(new THREE.Sphere());
          const cam = new THREE.PerspectiveCamera(28, cw / ch, Math.max(0.001, sph.radius / 100), sph.radius * 100);
          const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(20);
          const dist = (sph.radius / Math.sin(THREE.MathUtils.degToRad(14))) * 1.02;
          cam.position.set(sph.center.x + dist * Math.cos(el) * Math.sin(az), sph.center.y + dist * Math.sin(el), sph.center.z + dist * Math.cos(el) * Math.cos(az));
          cam.lookAt(sph.center);
          renderer.render(scene, cam);
          scene.remove(obj);
          if (parent) parent.add(obj);
          mixer?.stopAllAction();
          out.push({ x, y, t1: `#${e.idx} ${e.name}`, t2 });
        } catch (err) {
          out.push({ x, y, t1: `#${e.idx} ${e.name}`, t2: `LOAD ERROR ${String(err).slice(0, 60)}`, err: true });
        }
      }
      if (done) return;
      setLabels(out);
      requestAnimationFrame(() => continueRender(handle));
    })().catch((err) => { console.error(err); continueRender(handle); });
    return () => { done = true; renderer?.dispose(); renderer?.forceContextLoss(); };
  }, [frame, filter, cols, rows, azDeg, handle]);

  const cw = Math.floor(W / cols);
  return (
    <div style={{ width: W, height: H, position: "relative", background: "#b0b4ba", fontFamily: "Arial, sans-serif" }}>
      <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />
      {labels.map((l, i) => (
        <div key={i} style={{ position: "absolute", left: l.x + 6, top: l.y + 4, width: cw - 12, fontSize: 15, lineHeight: "18px", color: l.err ? "#b00" : "#111" }}>
          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.t1}</div>
          <div style={{ color: l.err ? "#b00" : "#333", fontSize: 13 }}>{l.t2}</div>
        </div>
      ))}
    </div>
  );
};

const calc: CalculateMetadataFunction<Props> = async ({ props }) => {
  const n = pick(await loadManifest(), props.filter).length;
  const per = (props.cols ?? 5) * (props.rows ?? 5);
  return { durationInFrames: Math.max(1, Math.ceil(n / per)) };
};

// ---- environment check: the 3 HDRIs (background + chrome / rough spheres + a prefab house) and the tiling texture sets ----
const HDRIS = ["clear_midday_2k", "golden_hour_2k", "overcast_2k"];
const TEXS = ["cobblestone", "dirt_packed", "sand", "grass", "wood_planks", "plaster_white", "stone_blocks", "sandstone_blocks", "mud_brick"];
const EnvSheet: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender("assetkit env", { timeoutInMilliseconds: 240000 }));
  const [labels, setLabels] = useState<{ x: number; y: number; t: string }[]>([]);
  useEffect(() => {
    let renderer: THREE.WebGLRenderer | null = null;
    (async () => {
      renderer = new THREE.WebGLRenderer({ canvas: ref.current!, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(W, H, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.setScissorTest(true);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const out: { x: number; y: number; t: string }[] = [];
      const house = (await loadGltf("q_village/village_modular.glb")).scene.getObjectByName("House_StonePlaster_4x4")!;
      const pw = Math.floor(W / 3), ph = 640;
      for (let i = 0; i < HDRIS.length; i++) {
        const hdr = await new RGBELoader().loadAsync(staticFile(`assetkit/hdri/${HDRIS[i]}.hdr`));
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const scene = new THREE.Scene();
        scene.background = hdr; scene.environment = pmrem.fromEquirectangular(hdr).texture;
        const chrome = new THREE.Mesh(new THREE.SphereGeometry(1.2, 64, 32), new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.05 }));
        chrome.position.set(-3.2, 1.2, 3); scene.add(chrome);
        const matte = new THREE.Mesh(new THREE.SphereGeometry(1.2, 64, 32), new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.8 }));
        matte.position.set(3.4, 1.2, 3); scene.add(matte);
        const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 1 }));
        scene.add(ground);
        const parent = house.parent; scene.add(house);
        const cam = new THREE.PerspectiveCamera(50, pw / ph, 0.1, 500); cam.position.set(6, 5, 16); cam.lookAt(0, 3.5, 0);
        const x = i * pw;
        renderer.setViewport(x, H - ph, pw, ph); renderer.setScissor(x, H - ph, pw, ph);
        renderer.render(scene, cam);
        scene.remove(house); parent?.add(house);
        out.push({ x, y: 0, t: `hdri/${HDRIS[i]}.hdr (env + background, no extra lights)` });
      }
      const loader = new THREE.TextureLoader();
      const cols = 5, tw = Math.floor(W / cols), th = Math.floor((H - ph) / 2);
      for (let i = 0; i < TEXS.length; i++) {
        const ld = async (f: string, srgb: boolean) => { const t = await loader.loadAsync(staticFile(`assetkit/tex/${TEXS[i]}/${f}.jpg`)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
        const mat = new THREE.MeshStandardMaterial({ map: await ld("albedo", true), normalMap: await ld("normal", false), roughnessMap: await ld("rough", false) });
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a5048, 0.9));
        const sun = new THREE.DirectionalLight(0xfff0dd, 2.6); sun.position.set(-4, 3, 2); scene.add(sun);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2), mat); scene.add(floor);
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), mat); wall.position.set(0, 2, -2); scene.add(wall);
        const cam = new THREE.PerspectiveCamera(45, tw / th, 0.05, 100); cam.position.set(2.2, 2.4, 3.4); cam.lookAt(0, 1, -0.6);
        const c = i % cols, r = Math.floor(i / cols); const x = c * tw, y = ph + r * th;
        renderer.setViewport(x, H - y - th, tw, th); renderer.setScissor(x, H - y - th, tw, th);
        renderer.setClearColor(0xc3c7cd, 1); renderer.clear(); renderer.render(scene, cam);
        out.push({ x, y, t: `tex/${TEXS[i]} (4x4 m, 2x repeat)` });
      }
      setLabels(out);
      requestAnimationFrame(() => continueRender(handle));
    })().catch((e) => { console.error(e); continueRender(handle); });
    return () => { renderer?.dispose(); };
  }, [handle]);
  return (
    <div style={{ width: W, height: H, position: "relative", background: "#b0b4ba", fontFamily: "Arial, sans-serif" }}>
      <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />
      {labels.map((l, i) => <div key={i} style={{ position: "absolute", left: l.x + 6, top: l.y + 4, fontSize: 15, fontWeight: 700, color: "#111", background: "rgba(255,255,255,0.7)", padding: "1px 4px" }}>{l.t}</div>)}
    </div>
  );
};

const Root: React.FC = () => (
  <>
    <Composition id="AssetkitSheet" component={Sheet} durationInFrames={1} fps={30} width={W} height={H} defaultProps={{ cols: 5, rows: 5 } as Props} calculateMetadata={calc} />
    <Composition id="AssetkitEnv" component={EnvSheet} durationInFrames={1} fps={30} width={W} height={H} />
  </>
);
registerRoot(Root);
