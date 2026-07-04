import { MoodTheme } from "../types";

export const MOOD_THEMES: Record<string, MoodTheme> = {
  Happy: {
    mood: "Happy",
    color: "#FBBF24", // Warm Yellow
    glowColor: "rgba(251, 191, 36, 0.45)",
    textColor: "text-amber-400",
    description: "Radiant, bright, and cheerful energy that uplifts the atmosphere.",
    keywords: ["Smiling mouth curvature", "Raised cheek structures", "Relaxed eye contours"],
    hue: 0.16,
  },
  Sad: {
    mood: "Sad",
    color: "#3B82F6", // Oceanic Blue
    glowColor: "rgba(59, 130, 246, 0.45)",
    textColor: "text-blue-400",
    description: "Soothing, reflective, and deep acoustic soundscapes that hold space.",
    keywords: ["Slightly drooping corners", "Heavier eyelids", "Relaxed lower muscles"],
    hue: 0.66,
  },
  Angry: {
    mood: "Angry",
    color: "#EF4444", // Crimson Red
    glowColor: "rgba(239, 68, 68, 0.45)",
    textColor: "text-red-500",
    description: "High-intensity, fierce, and driving textures that channel tension.",
    keywords: ["Furrowed eyebrows", "Pressed lips", "Tightened facial muscle posture"],
    hue: 0.0,
  },
  Calm: {
    mood: "Calm",
    color: "#10B981", // Sage Green
    glowColor: "rgba(16, 185, 129, 0.45)",
    textColor: "text-emerald-400",
    description: "Quiet, peaceful, and grounding frequencies that slow down the mind.",
    keywords: ["Smooth unbrowed forehead", "Softly closed lips", "Gentle eye focus"],
    hue: 0.33,
  },
  Excited: {
    mood: "Excited",
    color: "#EC4899", // Energetic Pink
    glowColor: "rgba(236, 72, 153, 0.45)",
    textColor: "text-pink-400",
    description: "Vibrant, electric, and fast-paced beats that prompt movement.",
    keywords: ["Widely opened eyes", "Open-mouthed smile", "High muscular elevation"],
    hue: 0.83,
  },
  Anxious: {
    mood: "Anxious",
    color: "#8B5CF6", // Mystic Purple
    glowColor: "rgba(139, 92, 246, 0.45)",
    textColor: "text-purple-400",
    description: "Suspenseful, intricate, and layered pulses that mirror a busy mind.",
    keywords: ["Slightly knit brows", "Drawn mouth posture", "Tense micro-expressions"],
    hue: 0.75,
  },
  Neutral: {
    mood: "Neutral",
    color: "#64748B", // Slate Gray
    glowColor: "rgba(100, 116, 139, 0.45)",
    textColor: "text-slate-400",
    description: "Balanced, steady, and restful static drones for calm contemplation.",
    keywords: ["Horizontal symmetrical lips", "Balanced brow-line", "Open unconstrained focus"],
    hue: 0.50,
  },
};
