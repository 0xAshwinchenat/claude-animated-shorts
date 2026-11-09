# project/: project-side files (not part of the skill)

Copies of folders from the Remotion project at `D:\youtube`, kept here so they are backed up and versioned. Paths
mirror the project: `project/<path>` = `D:\youtube\<path>`. Restore by copying a folder back to the same path.
The skill itself (`SKILL.md`, `templates/`, `references/`) lives at the repo root and does not include these files.

| Folder | What | Notes |
|---|---|---|
| `public/assetkit/` | 3D asset kit: 631 stylised models (GLB), 9 PBR tiling texture sets, 3 HDRIs, `MANIFEST.json`, `LICENSES.md` | 88 MB. CC0 except 8 Poly Pizza models under CC-BY 3.0 (credit them in the video description if they appear). Loaded with `templates/pigs/assetkit.ts`. |
| `assetkit_src/_tools/` | Scripts that built the kit (`build.mjs`, `kit.config.mjs`, `tex.mjs`, download helpers) | `node_modules` and the downloaded source archives are not included: `npm i` in this folder, and re-download the packs (URLs in `LICENSES.md`) into `D:\youtube\assetkit_src\<pack>\` before rebuilding. |
| `sfx_lib/` | Recorded SFX library: 60 sounds generated with ElevenLabs sound generation (`<category>/<name>.wav` + the original `_take.mp3`), `index.json`, `build_lib.py`, build logs, `words_qa.txt` | `_cache/` (derived `.npy` files) is left out; `sfxbank.py` rebuilds it. Generated 2026-11-09 for 1,157 credits. |
| `src/videos/assetlab/` + `src/sandboxes/assetlab/` | Asset-kit / glossy-material test scene (market street), compositions `AssetLab` / `AssetLabHQ` | Findings in `src/videos/assetlab/LAB.md` (also `references/reports/assetlab_2026-11-09.md`). |
| `src/videos/fxlab/` + `src/sandboxes/fxlab/` | VFX lab (smoke, burst, explosion, dust trail, fire, rigid debris), compositions `FxLab` / `FxLabHQ` | API in `src/videos/fxlab/VFX.md` (also `references/reports/vfx_2026-11-09.md`). |
| `src/sandboxes/assetkit_sheet/` | Contact-sheet renderer for the asset kit (`AssetkitSheet`, `AssetkitEnv`) | |

Render any lab from `D:\youtube` with `TEMP=TMP=D:/remotion-tmp`, for example
`npx remotion still src/sandboxes/assetlab/index.tsx AssetLab out/assetlab/x.png --frame=45 --props='{"lab":{"kit":true,"cInf":2}}'`.
