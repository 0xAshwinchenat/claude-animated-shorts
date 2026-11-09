// node inspect.mjs <out.json> <file-or-dir>...   : bbox / tris / materials / textures / anims for each .gltf/.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import fs from 'fs'; import path from 'path';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const files = [];
const walk = (p) => { const st = fs.statSync(p); if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f)); else if (/\.(gltf|glb)$/i.test(p)) files.push(p); };
for (const a of process.argv.slice(3)) walk(a);
const out = [];
for (const f of files) {
  try {
    const doc = await io.read(f); const root = doc.getRoot();
    const scene = root.getDefaultScene() || root.listScenes()[0];
    const b = getBounds(scene);
    let tris = 0;
    for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const idx = p.getIndices(); const pos = p.getAttribute('POSITION'); const n = idx ? idx.getCount() : (pos ? pos.getCount() : 0); if (p.getMode() === 4) tris += n / 3; }
    const mats = root.listMaterials().map((m) => ({ name: m.getName(), base: !!m.getBaseColorTexture(), normal: !!m.getNormalTexture(), mr: !!m.getMetallicRoughnessTexture(), metal: m.getMetallicFactor(), rough: m.getRoughnessFactor(), alpha: m.getAlphaMode(), color: m.getBaseColorFactor().map((x) => +x.toFixed(2)) }));
    const texs = root.listTextures().map((t) => { const s = t.getSize(); return `${t.getName() || t.getURI()}:${s ? s.join('x') : '?'}:${t.getMimeType()}`; });
    const vcol = root.listMeshes().some((m) => m.listPrimitives().some((p) => p.getAttribute('COLOR_0')));
    out.push({ file: f, size: b.max.map((v, i) => +(v - b.min[i]).toFixed(3)), min: b.min.map((v) => +v.toFixed(3)), max: b.max.map((v) => +v.toFixed(3)), tris: Math.round(tris), meshes: root.listMeshes().length, nodes: root.listNodes().length, mats, texs, vcol, anims: root.listAnimations().map((a) => a.getName()), skins: root.listSkins().length });
  } catch (e) { out.push({ file: f, error: String(e) }); }
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
for (const o of out) console.log(o.error ? `ERR ${o.file} ${o.error}` : `${path.basename(o.file)}\t${o.size.join('x')}\ttris=${o.tris}\tmats=${o.mats.length}\ttex=${o.texs.length}\tanim=${o.anims.length}\tskin=${o.skins}${o.vcol ? '\tvcol' : ''}`);
