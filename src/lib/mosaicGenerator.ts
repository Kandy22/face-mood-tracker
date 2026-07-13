// Generates a textured "mosaic" of many swatch tiles derived from a song's
// two curated calibration colors. We only ever have two real, human-picked
// hex values per song (no per-second audio color data exists), so the
// mosaic is honestly a generated interpolation/jitter field between those
// two real colors — not a fabricated frame-by-frame analysis of the track.
// It's seeded per song so the same track always renders the same texture.
import { hslToHex } from "./colorUtils";
import { hexToHsl } from "./colorUtils";

function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h = (h ^= h >>> 16) >>> 0;
    return h / 4294967296;
  };
}

export interface MosaicTile {
  hex: string;
  row: number;
  col: number;
}

export function generateMosaic(
  colorA: string,
  colorB: string,
  seed: string,
  rows = 10,
  cols = 14,
): MosaicTile[] {
  const rng = seededRng(seed);
  const hslA = hexToHsl(colorA);
  const hslB = hexToHsl(colorB);
  const tiles: MosaicTile[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Base interpolation position across the grid (diagonal blend)
      const t = (row / (rows - 1) + col / (cols - 1)) / 2;

      const h = hslA.h + (hslB.h - hslA.h) * t + (rng() - 0.5) * 18;
      const s = Math.min(100, Math.max(0, hslA.s + (hslB.s - hslA.s) * t + (rng() - 0.5) * 16));
      const l = Math.min(92, Math.max(8, hslA.l + (hslB.l - hslA.l) * t + (rng() - 0.5) * 14));

      tiles.push({ hex: hslToHex(h, s, l), row, col });
    }
  }

  return tiles;
}
