import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const c = p.getAttribute('COLOR_0'); if (!c) continue;
    const n = c.getCount(), k = c.getElementSize(); const mn = Array(k).fill(1e9), mx = Array(k).fill(-1e9); const e = [];
    for (let i = 0; i < n; i++) { c.getElement(i, e); e.forEach((v, j) => { mn[j] = Math.min(mn[j], v); mx[j] = Math.max(mx[j], v); }); }
    console.log(f.split(/[\/]/).pop(), m.getName(), p.getMaterial()?.getName(), c.getComponentType(), c.getNormalized(), 'min', mn.map(v=>v.toFixed(2)).join(','), 'max', mx.map(v=>v.toFixed(2)).join(','));
  }
}
