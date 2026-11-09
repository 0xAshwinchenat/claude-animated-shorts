// node build.mjs [familyFileRegex]   -> writes public/assetkit/<pack>/<file>.glb + _build/<file>.json, then MANIFEST.json
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, dedup, prune, getBounds, resample } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { FAMILIES, PACKS, SRC, OUT } from './kit.config.mjs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const BUILD = path.join(SRC, '_build');
fs.mkdirSync(BUILD, { recursive: true });
const r3 = (v) => +v.toFixed(3);

const subtree = (n) => { const out = [n]; for (const c of n.listChildren()) out.push(...subtree(c)); return out; };

async function processTextures(doc, maxTex, recolor = []) {
  const root = doc.getRoot();
  const report = [];
  for (const tex of root.listTextures()) {
    const img = tex.getImage(); if (!img) continue;
    const mats = root.listMaterials();
    const isNormal = mats.some((m) => m.getNormalTexture() === tex);
    const needAlpha = mats.some((m) => m.getBaseColorTexture() === tex && m.getAlphaMode() !== 'OPAQUE');
    const key = `${tex.getName()} ${tex.getURI()}`;
    const rc = recolor.find((r) => r.rx.test(key));
    let sh = sharp(Buffer.from(img)); const md = await sh.metadata();
    if (rc) sh = sh.modulate({ hue: rc.hue, saturation: rc.saturation, brightness: rc.brightness });
    const big = Math.max(md.width, md.height) > maxTex;
    if (big) sh = sh.resize({ width: maxTex, height: maxTex, fit: 'inside' });
    const nm = (tex.getName() || path.basename(tex.getURI() || 'tex')).replace(/\.(png|jpe?g)$/i, '').replace(/[^A-Za-z0-9_-]/g, '_');
    let out, mime;
    const isPng = tex.getMimeType() === 'image/png';
    if (isPng && !big && !rc && img.byteLength < 400000) { out = img; mime = 'image/png'; } // small gradient atlases / palettes: keep lossless (JPEG would bleed palette cells)
    else if (needAlpha && md.hasAlpha) { out = await sh.png({ compressionLevel: 9 }).toBuffer(); mime = 'image/png'; }
    else { out = await sh.removeAlpha().jpeg({ quality: isNormal ? 90 : 85, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer(); mime = 'image/jpeg'; }
    tex.setImage(new Uint8Array(out)).setMimeType(mime).setURI(nm + (mime === 'image/png' ? '.png' : '.jpg'));
    const m2 = await sharp(Buffer.from(out)).metadata();
    report.push(`${nm}:${m2.width}x${m2.height}:${mime === 'image/png' ? 'png' : 'jpg'}`);
  }
  return report;
}

function matNotes(doc, nodes) {
  const mats = new Set(); let vcol = false, skinned = false;
  for (const n of nodes) {
    if (n.getSkin()) skinned = true;
    const me = n.getMesh(); if (!me) continue;
    for (const p of me.listPrimitives()) { if (p.getMaterial()) mats.add(p.getMaterial()); if (p.getAttribute('COLOR_0')) vcol = true; }
  }
  const ms = [...mats];
  const has = (f) => ms.some(f);
  const flags = [];
  if (has((m) => m.getBaseColorTexture())) flags.push('map'); else flags.push('flat colour (no map)');
  if (has((m) => m.getNormalTexture())) flags.push('normalMap');
  if (has((m) => m.getMetallicRoughnessTexture())) flags.push('roughness/metal map (ORM-style)');
  if (has((m) => m.getOcclusionTexture())) flags.push('aoMap');
  if (has((m) => m.getEmissiveTexture() || m.getEmissiveFactor().some((v) => v > 0))) flags.push('emissive');
  if (has((m) => m.getMetallicFactor() > 0.01)) flags.push('metalness>0 on some mats');
  if (has((m) => m.getAlphaMode() !== 'OPAQUE')) flags.push('alpha (' + [...new Set(ms.map((m) => m.getAlphaMode()).filter((a) => a !== 'OPAQUE'))].join('/') + ')');
  if (vcol) flags.push('vertex colours (COLOR_0)');
  return { notes: flags.join(', '), materials: ms.map((m) => m.getName()), vcol, skinned };
}

const tris = (nodes) => { let t = 0; for (const n of nodes) { const me = n.getMesh(); if (!me) continue; for (const p of me.listPrimitives()) { if (p.getMode() !== 4) continue; const idx = p.getIndices(); t += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3; } } return Math.round(t); };

for (const fam of FAMILIES) {
  if (only && !only.test(fam.file)) continue;
  const doc = new Document(); doc.createBuffer('buffer');
  const scene = doc.createScene('kit'); doc.getRoot().setDefaultScene(scene);
  const recs = [];
  for (const it of fam.items) {
    const src = await io.read(path.join(SRC, it.src));
    const sroot = src.getRoot();
    const sscene = sroot.getDefaultScene() || sroot.listScenes()[0];
    for (const s of sroot.listScenes()) if (s !== sscene) s.dispose();
    if (!fam.keepAnims) for (const a of sroot.listAnimations()) a.dispose();
    const b = getBounds(sscene);
    const dims = [0, 1, 2].map((i) => b.max[i] - b.min[i]);
    let s = it.scale ?? 1;
    if (it.targetH) s = it.targetH / dims[1];
    if (it.targetL) s = it.targetL / Math.max(dims[0], dims[2]);
    const map = mergeDocuments(doc, src);
    const sc2 = map.get(sscene);
    const wrap = doc.createNode(it.node).setScale(it.scaleXYZ || [s, s, s]);
    for (const ch of sc2.listChildren()) { sc2.removeChild(ch); wrap.addChild(ch); }
    scene.addChild(wrap);
    for (const s2 of doc.getRoot().listScenes()) if (s2 !== scene) s2.dispose();
    if (!fam.keepAnims) { let k = 0; for (const n of subtree(wrap).slice(1)) n.setName(`${it.node}__${k++}`); }
    recs.push({ it, wrap, s });
  }
  // prefabs: assembled from the family's own pieces; new nodes that REUSE the piece meshes (no extra geometry/textures)
  for (const pf of fam.prefabs || []) {
    const byName = new Map(recs.map((r) => [r.it.node, r.wrap]));
    const clone = (n) => { const c = doc.createNode('x').setTranslation(n.getTranslation()).setRotation(n.getRotation()).setScale(n.getScale()).setMesh(n.getMesh()); for (const ch of n.listChildren()) c.addChild(clone(ch)); return c; };
    const wrap = doc.createNode(pf.node);
    for (const [piece, x, y, z, rotY] of pf.parts) {
      const src = byName.get(piece); if (!src) throw new Error(`prefab ${pf.node}: no piece ${piece}`);
      const h = (rotY * Math.PI) / 360;
      const part = doc.createNode('x').setTranslation([x, y, z]).setRotation([0, Math.sin(h), 0, Math.cos(h)]);
      part.addChild(clone(src)); wrap.addChild(part);
    }
    scene.addChild(wrap);
    let k = 0; for (const n of subtree(wrap).slice(1)) n.setName(`${pf.node}__${k++}`);
    recs.push({ it: { pack: fam.pack, node: pf.node, category: pf.category, eras: pf.eras, notes: pf.notes }, wrap, s: 1 });
  }
  await doc.transform(unpartition(), dedup());
  const texReport = await processTextures(doc, fam.maxTex, fam.recolor || []);
  const tf = [dedup(), prune()];
  if (fam.keepAnims) tf.push(resample());
  await doc.transform(...tf);
  const outPath = path.join(OUT, fam.file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await io.write(outPath, doc);
  const bytes = fs.statSync(outPath).size;
  const anims = doc.getRoot().listAnimations().map((a) => a.getName());
  const entries = recs.map(({ it, wrap, s }) => {
    const nodes = subtree(wrap);
    const bb = getBounds(wrap);
    const mn = matNotes(doc, nodes);
    const P = PACKS[it.pack];
    return {
      // node: name of the wrapper node inside a family GLB (gltf.scene.getObjectByName(node)); null = single-model file, use gltf.scene
      name: `${it.pack}/${it.node}`, file: fam.file, node: fam.items.length > 1 ? it.node : null, pack: it.pack, pack_title: P.title,
      category: it.category, eras: it.eras, style: it.style || P.style,
      size_m: [0, 1, 2].map((i) => r3(bb.max[i] - bb.min[i])), bbox_min: bb.min.map(r3), bbox_max: bb.max.map(r3),
      scale_applied: it.scaleXYZ ? it.scaleXYZ : r3(s), tris: tris(nodes),
      material_notes: mn.notes, rigged: mn.skinned, animations: fam.keepAnims && mn.skinned ? anims : (fam.keepAnims && anims.length ? anims : []),
      license: it.license || P.license, author: it.author || P.author, source_url: it.source_url || P.url,
      ...(it.title ? { source_title: it.title } : {}),
      notes: it.notes || '',
    };
  });
  const famRec = { file: fam.file, bytes, textures: texReport, count: entries.length, entries };
  fs.writeFileSync(path.join(BUILD, fam.file.replace(/[\\/]/g, '__') + '.json'), JSON.stringify(famRec, null, 1));
  console.log(`${fam.file}\t${entries.length} models\t${(bytes / 1e6).toFixed(2)} MB\ttex=${texReport.length}`);
}

// assemble MANIFEST.json from all family records that still exist on disk
const all = [];
for (const f of fs.readdirSync(BUILD).sort()) {
  const rec = JSON.parse(fs.readFileSync(path.join(BUILD, f), 'utf8'));
  if (!fs.existsSync(path.join(OUT, rec.file))) continue;
  all.push(...rec.entries);
}
fs.writeFileSync(path.join(OUT, 'MANIFEST.json'), JSON.stringify(all, null, 1));
console.log('MANIFEST entries:', all.length);
