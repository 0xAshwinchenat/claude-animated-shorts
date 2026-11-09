// tiling PBR texture sets -> public/assetkit/tex/<name>/{albedo,normal,rough}.jpg
import sharp from 'sharp'; import fs from 'fs'; import path from 'path';
const S = 'D:/youtube/assetkit_src', O = 'D:/youtube/public/assetkit/tex';
const SETS = [
  ['cobblestone', 'acg_tex/PavingStones070/PavingStones070_2K-JPG', 2048],
  ['dirt_packed', 'acg_tex/Ground103/Ground103_2K-JPG', 2048],
  ['sand', 'acg_tex/Ground093C/Ground093C_2K-JPG', 2048],
  ['grass', 'acg_tex/Grass004/Grass004_2K-JPG', 2048],
  ['wood_planks', 'acg_tex/Planks037A/Planks037A_1K-JPG', 1024],
  ['plaster_white', 'acg_tex/Plaster002/Plaster002_1K-JPG', 1024],
  ['stone_blocks', 'acg_tex/Bricks066/Bricks066_1K-JPG', 1024],
  ['sandstone_blocks', 'acg_tex/Bricks084/Bricks084_1K-JPG', 1024],
];
const ph = ['mud_brick', 'ph_tex/clay_block_wall/clay_block_wall', 1024];
const out = [];
const enc = async (src, dst, size, q, gray) => {
  let s = sharp(path.join(S, src)).resize(size, size, { fit: 'fill' });
  if (gray) s = s.greyscale();
  await s.jpeg({ quality: q, mozjpeg: true }).toFile(dst);
  return fs.statSync(dst).size;
};
for (const [name, pre, size] of SETS) {
  const d = path.join(O, name); fs.mkdirSync(d, { recursive: true });
  const b = await enc(pre + '_Color.jpg', path.join(d, 'albedo.jpg'), size, 85) + await enc(pre + '_NormalGL.jpg', path.join(d, 'normal.jpg'), size, 88) + await enc(pre + '_Roughness.jpg', path.join(d, 'rough.jpg'), size, 82, true);
  out.push([name, size, b]);
}
{ const [name, pre, size] = ph; const d = path.join(O, name); fs.mkdirSync(d, { recursive: true });
  const b = await enc(pre + '_diff_1k.jpg', path.join(d, 'albedo.jpg'), size, 85) + await enc(pre + '_nor_gl_1k.jpg', path.join(d, 'normal.jpg'), size, 88) + await enc(pre + '_rough_1k.jpg', path.join(d, 'rough.jpg'), size, 82, true);
  out.push([name, size, b]); }
for (const o of out) console.log(o[0], o[1], (o[2] / 1e6).toFixed(2) + ' MB');
