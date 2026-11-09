// node objconv.mjs <outdir> <obj>...  : OBJ(+MTL) -> GLB with obj2gltf (metallic-roughness)
import obj2gltf from 'obj2gltf'; import fs from 'fs'; import path from 'path';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
for (const f of process.argv.slice(3)) {
  const glb = await obj2gltf(f, { binary: true });
  const o = path.join(out, path.basename(f).replace(/\.obj$/i, '').replace(/[^A-Za-z0-9_-]/g, '_') + '.glb');
  fs.writeFileSync(o, glb); console.log(o, glb.length);
}
