# Claude Animated Shorts

The free Claude skill from the video **"How to Make Viral Animated Shorts Using Claude (Full Workflow)"**.

It makes 55-70 s vertical animated story shorts: 2D characters in a colourful 3D world, with ink outlines, a painted town, lens blur, gliding cameras, a march score and sound effects. Everything is rendered with three.js inside Remotion on your own PC, with no AI video generator.

**Gold standard: "The Dirt Wall Genghis Khan's Best General Couldn't Break"** (69 s, the 1232 Mongol siege of Kaifeng): 3D toon heroes, ~1000 card extras, 400 instanced trebuchets, a continuous camera, 120 fps motion blur, burned-in captions. Its full source and the step-by-step GOLDEN PIPELINE are included. Earlier proof: **The Bridge That Fell for a Song** (1831 Broughton bridge).

## What's inside
| Path | What it is |
|---|---|
| `SKILL.md` | The skill: the GOLDEN PIPELINE (how the Kaifeng short was made), every rule, every fix, the look values |
| `templates/kaifeng/` | The full source of the Kaifeng short: story/camera contract, world glue, wall + city, trebuchets + camp, 3D toon cast + crowds, venues, post |
| `templates/short_kit/` | Voice prep (cut, trim, tempo, word alignment), soundtrack generator, captions, final + splice scripts, the script and shot plan, `GOLDEN_PIPELINE.md`, `HELPER_BRIEFS.md` |
| `templates/camrig/`, `templates/toon3d_lab/` | The continuous camera rig and the 3D toon character lab |
| `templates/bridge/` | The full source of the bridge short: world, characters, ink, lens blur, grade, story/camera |
| `templates/audio/` | The synthesized sound: SFX, march music, the mix with ducking and loudness |
| `templates/scripts/` | Stills, camera gates (`cam_qa.mjs`), speed profile, contact sheets, sandbox merge, deep QA |
| `references/STYLE_BIBLE.md` | The script and visual formula measured from 20 reference shorts |
| `references/reports/` | Seven measured reports: motion, depth, textures, characters, lighting, outlines, grade |
| `references/frames/` | 38 full-size reference frames (540x960) to compare your frames against |
| `references/sheets/` | 20 contact sheets, one per reference short, 60 frames each (1,200 frames) |

## Install
1. Copy this folder to `~/.claude/skills/cartoon-3d-short/` (clone it there, or download the ZIP).
2. You need [Remotion](https://www.remotion.dev/) with `@remotion/three`, plus Node, Python 3 and ffmpeg.
3. Also: Python 3 with numpy, scipy, pillow and `faster-whisper`; ffmpeg built with rubberband.
4. In Claude Code, say: *"make a cartoon short about …"* (or *"use the cartoon short skill"*). Claude follows the GOLDEN PIPELINE: research + script (you approve), voice (yours or TTS), the story.ts contract, four helper agents building the sets and cast in parallel, camera gates, a preview review, then the 2K motion-blurred final with sound and captions.

Claude then follows `SKILL.md`: topic and facts, then script, then voice, then the shot plan in `story.ts`, then stills, then renders. Agents check your frames against the reports and the frames, and you get the final 2K render and sound mix.

## Notes
- Set `REMOTION_TMP` to a folder on a big drive. Every Remotion bundle copies `public/` (~1.3 GB) into the temp folder.
- Story, characters and voice should always be your own. Use the references for the look, not the content.

## License
The code and docs are MIT (see `LICENSE`). The reference frames are included for style study only.
