// Deterministic color-theory analysis for the calibration bank's dual-color
// spectrums. Every value here is computed directly from the song's actual
// hex codes (via hexToHsl) — nothing is hand-written per song, so it stays
// accurate as the track list grows.
import { hexToHsl } from "./colorUtils";
import { NAMED_COLORS } from "./namedColors";

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace("#", "");
  if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

// Nearest match from the real, published CSS named-color keyword list.
// We deliberately do not claim Pantone matching here — that requires
// Pantone's own licensed color-book data, which we don't have access to,
// and fabricating a Pantone code would misrepresent the pixel value.
export function nearestNamedColor(hex: string): { name: string; hex: string; distance: number } {
  const target = hexToRgb(hex);
  let best = NAMED_COLORS[0];
  let bestDist = Infinity;

  for (const candidate of NAMED_COLORS) {
    const c = hexToRgb(candidate.hex);
    const dist = Math.sqrt((target.r - c.r) ** 2 + (target.g - c.g) ** 2 + (target.b - c.b) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  return { name: best.name, hex: best.hex, distance: Math.round(bestDist) };
}

export interface ColorAnalysis {
  hex: string;
  h: number;
  s: number;
  l: number;
  family: string;
  warmth: "Warm" | "Cool" | "Neutral";
  saturationTier: string;
  lightnessTier: string;
  descriptor: string;
}

export interface PairingAnalysis {
  hueDistance: number;
  relationship: string;
  relationshipNote: string;
  lightnessDelta: number;
  rangeNote: string;
}

function hueFamily(h: number, s: number): { family: string; warmth: "Warm" | "Cool" | "Neutral"; assoc: string } {
  if (s < 8) {
    return { family: "Achromatic", warmth: "Neutral", assoc: "starkness, void, or unfiltered clarity" };
  }
  if (h < 15 || h >= 345) return { family: "Red", warmth: "Warm", assoc: "urgency, passion, or confrontation" };
  if (h < 45) return { family: "Orange", warmth: "Warm", assoc: "warmth, sociability, and driving energy" };
  if (h < 70) return { family: "Yellow", warmth: "Warm", assoc: "optimism and alertness, occasionally tipping into unease at high intensity" };
  if (h < 160) return { family: "Green", warmth: "Cool", assoc: "balance, renewal, and grounded calm" };
  if (h < 200) return { family: "Teal / Cyan", warmth: "Cool", assoc: "clarity and cool composure" };
  if (h < 250) return { family: "Blue", warmth: "Cool", assoc: "introspection, serenity, or melancholy" };
  if (h < 290) return { family: "Violet", warmth: "Cool", assoc: "mystery, tension, or unresolved anxiety" };
  if (h < 330) return { family: "Magenta / Pink", warmth: "Warm", assoc: "playfulness and heightened excitement" };
  return { family: "Crimson", warmth: "Warm", assoc: "passion bordering on aggression" };
}

function saturationTier(s: number): { tier: string; note: string } {
  if (s < 8) return { tier: "Achromatic", note: "no hue signal — pure value contrast" };
  if (s < 40) return { tier: "Muted", note: "subdued and restrained" };
  if (s < 70) return { tier: "Moderate", note: "balanced, natural intensity" };
  return { tier: "Vivid", note: "electric, high emotional arousal" };
}

function lightnessTier(l: number): { tier: string; note: string } {
  if (l < 25) return { tier: "Deep", note: "heavy, weighted, somber" };
  if (l < 45) return { tier: "Dark", note: "grounded, dense" };
  if (l < 65) return { tier: "Mid-tone", note: "natural, settled" };
  if (l < 85) return { tier: "Light", note: "airy, uplifting" };
  return { tier: "Pale", note: "weightless, open" };
}

export function analyzeColor(hex: string): ColorAnalysis {
  const { h, s, l } = hexToHsl(hex);
  const { family, warmth, assoc } = hueFamily(h, s);
  const sat = saturationTier(s);
  const light = lightnessTier(l);

  const descriptor =
    s < 8
      ? `${light.tier}, ${sat.note} — reads as ${assoc}.`
      : `${sat.tier} ${family.toLowerCase()}, ${light.tier.toLowerCase()} in tone — associated with ${assoc}.`;

  return {
    hex: hex.toUpperCase(),
    h: Math.round(h),
    s: Math.round(s),
    l: Math.round(l),
    family,
    warmth,
    saturationTier: sat.tier,
    lightnessTier: light.tier,
    descriptor,
  };
}

export function analyzePairing(hexA: string, hexB: string): PairingAnalysis {
  const a = hexToHsl(hexA);
  const b = hexToHsl(hexB);

  const rawDiff = Math.abs(a.h - b.h);
  const hueDistance = Math.round(Math.min(rawDiff, 360 - rawDiff));

  let relationship: string;
  let relationshipNote: string;
  if (a.s < 8 || b.s < 8) {
    relationship = "Value contrast";
    relationshipNote = "one channel carries no hue — the pairing works on light/dark contrast alone, not color opposition.";
  } else if (hueDistance < 30) {
    relationship = "Analogous";
    relationshipNote = "both colors sit close on the wheel — a single, cohesive emotional register.";
  } else if (hueDistance < 90) {
    relationship = "Adjacent contrast";
    relationshipNote = "a layered pairing — two related but distinct emotional notes in the same scene.";
  } else if (hueDistance < 150) {
    relationship = "Split contrast";
    relationshipNote = "tension between two different emotional poles, neither fully resolved.";
  } else {
    relationship = "Complementary";
    relationshipNote = "near-opposite hues — maximum emotional contrast, the pairing argues with itself.";
  }

  const lightnessDelta = Math.round(Math.abs(a.l - b.l));
  const rangeNote =
    lightnessDelta > 40
      ? "a wide light-to-shadow arc across the two colors."
      : lightnessDelta > 15
      ? "a moderate tonal range between the two colors."
      : "tonally flat — the intensity is sustained rather than arcing.";

  return { hueDistance, relationship, relationshipNote, lightnessDelta, rangeNote };
}
