import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Load the 50 calibrated songs at startup
let calibrationSongs: any[] = [];
try {
  const songsPath = path.join(process.cwd(), "src/data/songs.json");
  if (fs.existsSync(songsPath)) {
    calibrationSongs = JSON.parse(fs.readFileSync(songsPath, "utf8"));
    console.log(`Successfully loaded ${calibrationSongs.length} calibration songs into backend.`);
  }
} catch (e) {
  console.error("Failed to load calibration songs:", e);
}

// Lazy initialization of GoogleGenAI to prevent startup crash if API key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const app = express();
const PORT = 3000;

// Set up JSON body parser with increased limit to handle base64 image data
app.use(express.json({ limit: "15mb" }));

// Load the user baseline corrections for bias adjustment
let userBaseline: any[] = [];
const baselinePath = path.join(process.cwd(), "user_baseline.json");
try {
  if (fs.existsSync(baselinePath)) {
    userBaseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    console.log(`Successfully loaded ${userBaseline.length} manual corrections from user_baseline.json.`);
  }
} catch (e) {
  console.warn("No user_baseline.json found yet or failed to parse. Starting clean.", e);
}

// API Endpoint to save user corrections/overrides to user_baseline.json
app.post("/api/save-correction", (req, res) => {
  try {
    const correctionData = req.body;
    if (!correctionData || !correctionData.actualMood) {
      return res.status(400).json({ error: "Invalid correction data. actualMood is required." });
    }
    
    // Add timestamp if not present
    if (!correctionData.timestamp) {
      correctionData.timestamp = new Date().toISOString();
    }

    userBaseline.push(correctionData);
    
    // Persist to user_baseline.json
    fs.writeFileSync(baselinePath, JSON.stringify(userBaseline, null, 2), "utf8");
    console.log(`Saved new baseline calibration entry. Total entries: ${userBaseline.length}`);
    
    res.json({ success: true, count: userBaseline.length });
  } catch (error: any) {
    console.error("Failed to save correction to baseline file:", error);
    res.status(500).json({ error: "Failed to save correction to baseline file", details: error.message });
  }
});

// API Endpoint to analyze vibe (webcam snaps in vision mode or spectral audio attributes in sonic mode)
app.post("/api/analyze-vibe", async (req, res) => {
  try {
    const { image, mode, energy, spectralCentroid } = req.body;
    const ai = getGeminiClient();

    // Dynamically prepare the bias layer instructions using the saved corrections
    let baselineContext = "";
    if (userBaseline && userBaseline.length > 0) {
      // Provide the last 15 corrections to avoid bloating token count but capturing recent trend
      baselineContext = `
USER CALIBRATION BASELINE BIAS OVERRIDES:
The user has previously corrected and overridden raw system predictions in their session.
You MUST analyze these corrections and look for matches/patterns. If current visual configuration (eyes, eyebrows, mouth, tension) or acoustic characteristics (energy, spectralCentroid) align with these overrides, prioritize correcting your prediction to output the user's specified 'actualMood' instead of the raw guess!
Here are the recent user baseline overrides:
${JSON.stringify(userBaseline.slice(-15), null, 2)}
`;
    }

    // VISION MODE (Webcam Base64 snap provided)
    if (image || mode === "Vision") {
      if (!image) {
        return res.status(400).json({ error: "No webcam image data provided for Vision mode" });
      }

      // Strip out the data URL prefix if present (e.g. "data:image/jpeg;base64,")
      const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");

      const systemInstruction = `You are a state-of-the-art biological and facial expression scanning AI.
Your task is to analyze the user's face in the webcam capture and track specific physiological and emotional features:
- Eyebrow state (raised, furrowed, relaxed, tilted, tense)
- Eye openness and state (wide, squinting, heavy-lidded, focused, drooping)
- Mouth shape and state (smiling, frowning, neutral, pressed, relaxed, smirking, slightly parted)
- Overall muscle tension and facial posture.

Based on these tracked features, determine the user's primary emotional mood:
Choose exactly one of: "Happy", "Sad", "Angry", "Calm", "Excited", "Anxious", "Neutral".
Provide a high-fidelity confidence score (0 to 100), select a stunning corresponding hexadecimal light color that represents this emotional state, and recommend a song matching this vibe from the calibrated 50-song dataset if possible.
${baselineContext}`;

      const promptText = `Scan this facial image. Identify the exact configuration of eyes, eyebrows, mouth, and tension. 
Output a JSON response detailing:
1. The detected mood (one of: Happy, Sad, Angry, Calm, Excited, Anxious, Neutral).
2. A confidence score.
3. A gorgeous hexadecimal ambient glow light color (e.g., Happy: warm glowing yellow/gold like #FBBF24, Sad: deep oceanic blue like #3B82F6, Calm: rich emerald/mint like #10B981, Angry: fierce fiery crimson like #EF4444, Excited: energetic neon pink/magenta like #EC4899, Anxious: mysterious deep purple/violet like #8B5CF6, Neutral: balanced soft silver/slate like #64748B).
4. The exact state of the tracked facial expression features.
5. A matching song recommendation. You MUST recommend a song FROM THIS CALIBRATED LIST that matches the detected mood/emotion:
${JSON.stringify(calibrationSongs, null, 2)}

Match the song by mapping the detected mood to the 'primaryMood' or 'mood' of the song. Choose the song's exact 'track' as 'title' and 'artist' as 'artist' in your response.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Data,
            },
          },
          promptText,
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mood: {
                type: Type.STRING,
                description: "The primary detected mood. Must be one of: Happy, Sad, Angry, Calm, Excited, Anxious, Neutral",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Confidence percentage of the mood classification, from 0 to 100",
              },
              lightColor: {
                type: Type.STRING,
                description: "Hexadecimal color representing the constant mood light glow (e.g. #FBBF24, #3B82F6, #10B981, #EF4444, #EC4899, #8B5CF6, #64748B)",
              },
              facialFeatures: {
                type: Type.OBJECT,
                properties: {
                  eyes: { type: Type.STRING, description: "Observed state of the eyes (e.g., squinting, wide, relaxed, drooping, focused)" },
                  mouth: { type: Type.STRING, description: "Observed state of the mouth (e.g., smiling, neutral, tight, frowning, smirking)" },
                  eyebrows: { type: Type.STRING, description: "Observed state of the eyebrows (e.g., raised, relaxed, furrowed, knit)" },
                  tension: { type: Type.STRING, description: "Estimated facial muscle tension (e.g., relaxed, medium, high tension)" },
                  expressionDetails: { type: Type.STRING, description: "A detailed 1-sentence analysis summarizing the facial configuration" },
                },
                required: ["eyes", "mouth", "eyebrows", "tension", "expressionDetails"],
              },
              songRecommendation: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Song title appropriate for this mood" },
                  artist: { type: Type.STRING, description: "Artist name" },
                  genre: { type: Type.STRING, description: "Genre of the track" },
                  tempo: { type: Type.NUMBER, description: "Beats per minute (BPM) matching the vibe" },
                  description: { type: Type.STRING, description: "Description of why this track perfectly maps to their facial expressions" },
                },
                required: ["title", "artist", "genre", "tempo", "description"],
              },
            },
            required: ["mood", "confidence", "lightColor", "facialFeatures", "songRecommendation"],
          },
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("Empty response received from Gemini model in Vision mode");
      }

      const data = JSON.parse(resultText);
      return res.json(data);

    } else {
      // SONIC MODE (Acoustic spectral features provided)
      const currentEnergy = energy !== undefined ? Number(energy) : 0;
      const currentCentroid = spectralCentroid !== undefined ? Number(spectralCentroid) : 0;

      const systemInstruction = `You are a state-of-the-art neuro-acoustic signal processing and soundscape classification AI.
Your task is to analyze real-time spectral features extracted from an active synthesizer and classify the emotional vibe:
- Energy (amplitude, volume, power of sound)
- Spectral Centroid (frequency brightness, center of gravity)

Based on these audio features, classify the emotional vibe into exactly one of: "Happy", "Sad", "Angry", "Calm", "Excited", "Anxious", "Neutral".
Rules of Thumb:
- High energy (>100) and high spectral centroid (>15): Excited or Angry.
- High energy (>100) and low spectral centroid (<15): Anxious.
- Moderate energy (40 to 100) and high spectral centroid: Happy.
- Low energy (<40) and low/moderate spectral centroid: Calm or Sad.
- Balanced moderate values: Neutral.

Provide a high-fidelity confidence score (0 to 100), select a stunning corresponding hexadecimal light color representing this acoustic vibe, and recommend a song matching this vibe from the calibrated 50-song dataset.
${baselineContext}`;

      const promptText = `Classify this acoustic soundscape with energy amplitude = ${currentEnergy} and spectral centroid brightness = ${currentCentroid}.
Output a JSON response detailing:
1. The detected mood (one of: Happy, Sad, Angry, Calm, Excited, Anxious, Neutral).
2. A confidence score.
3. A gorgeous hexadecimal ambient glow light color.
4. Synthetically generated/metaphorical facialFeatures that represent this acoustic atmosphere (e.g. eyes/mouth/eyebrows states that describe a listener experiencing this sound).
5. A matching song recommendation. You MUST recommend a song FROM THIS CALIBRATED LIST that matches the detected mood/emotion:
${JSON.stringify(calibrationSongs, null, 2)}

Match the song by mapping the detected mood to the 'primaryMood' or 'mood' of the song. Choose the song's exact 'track' as 'title' and 'artist' as 'artist' in your response.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mood: {
                type: Type.STRING,
                description: "The primary detected mood. Must be one of: Happy, Sad, Angry, Calm, Excited, Anxious, Neutral",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Confidence percentage of the mood classification, from 0 to 100",
              },
              lightColor: {
                type: Type.STRING,
                description: "Hexadecimal color representing the constant mood light glow (e.g. #FBBF24, #3B82F6, #10B981, #EF4444, #EC4899, #8B5CF6, #64748B)",
              },
              facialFeatures: {
                type: Type.OBJECT,
                properties: {
                  eyes: { type: Type.STRING, description: "Observed state of the eyes (e.g., closed in immersion, squinting, wide, relaxed)" },
                  mouth: { type: Type.STRING, description: "Observed state of the mouth (e.g., smiling, neutral, tight, frowning)" },
                  eyebrows: { type: Type.STRING, description: "Observed state of the eyebrows (e.g., relaxed, raised, furrowed)" },
                  tension: { type: Type.STRING, description: "Estimated musical muscle/vibe tension (e.g., relaxed, highly tense)" },
                  expressionDetails: { type: Type.STRING, description: "A detailed 1-sentence analysis explaining how the acoustic energy maps to emotional tension" },
                },
                required: ["eyes", "mouth", "eyebrows", "tension", "expressionDetails"],
              },
              songRecommendation: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Song title appropriate for this mood" },
                  artist: { type: Type.STRING, description: "Artist name" },
                  genre: { type: Type.STRING, description: "Genre of the track" },
                  tempo: { type: Type.NUMBER, description: "Beats per minute (BPM) matching the vibe" },
                  description: { type: Type.STRING, description: "Description of why this track perfectly maps to these sonic features" },
                },
                required: ["title", "artist", "genre", "tempo", "description"],
              },
            },
            required: ["mood", "confidence", "lightColor", "facialFeatures", "songRecommendation"],
          },
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("Empty response received from Gemini model in Sonic mode");
      }

      const data = JSON.parse(resultText);
      return res.json(data);
    }

  } catch (error: any) {
    console.error("Vibe Analysis Error:", error);
    res.status(500).json({
      error: "Failed to analyze vibe and determine mood",
      details: error.message || String(error),
    });
  }
});

// Backwards-compatibility alias for /api/analyze-face
app.post("/api/analyze-face", async (req, res) => {
  console.log("Redirecting legacy /api/analyze-face request to /api/analyze-vibe");
  // @ts-ignore
  req.url = "/api/analyze-vibe";
  // @ts-ignore
  app.handle(req, res);
});

// Configure Vite integration based on environment
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from dist/.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Failed to start Vite middleware server:", err);
});
