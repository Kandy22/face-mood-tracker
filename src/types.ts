export interface FacialFeatures {
  eyes: string;
  mouth: string;
  eyebrows: string;
  tension: string;
  expressionDetails: string;
}

export interface SongRecommendation {
  title: string;
  artist: string;
  genre: string;
  tempo: number;
  description: string;
}

export interface MoodResult {
  mood: "Happy" | "Sad" | "Angry" | "Calm" | "Excited" | "Anxious" | "Neutral";
  confidence: number;
  lightColor: string; // Hex code
  facialFeatures: FacialFeatures;
  songRecommendation: SongRecommendation;
}

export interface MoodHistoryItem {
  id: string;
  timestamp: string;
  result: MoodResult;
}

export interface MoodTheme {
  mood: string;
  color: string;
  glowColor: string;
  textColor: string;
  description: string;
  keywords: string[];
  hue: number; // Position on the picker from 0.0 to 1.0
}
