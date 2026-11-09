// Voice re-time hook. A NEW short builds story.ts on its own voice's word frames, so the warp is the identity:
// film frame g plays story frame g. Only when the voice is replaced AFTER the picture is built, generate this file
// with <name>-short/voice/make_warp.py (FILM_TOTAL + a smooth monotone table; see warp_pigs_example.ts.txt).
import { TOTAL } from "./story";
export const FILM_TOTAL = TOTAL;
export const warpF = (g: number): number => g;
