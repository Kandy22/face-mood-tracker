import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Music,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  Clock,
  Info,
  ChevronRight,
  Smile,
  Shield,
  Trash2,
  Sliders,
  Play,
  Square,
  Flame,
  Frown,
  Eye,
  Activity,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Video,
  VideoOff,
  Search,
  ExternalLink,
  ListMusic,
  Check,
  Pencil,
} from "lucide-react";
import { MoodResult, MoodHistoryItem } from "./types";
import { MoodSynthEngine } from "./lib/synthEngine";
import { useYouTubePlayer } from "./lib/useYouTubePlayer";
import { MOOD_THEMES } from "./lib/moodThemes";
import AudioVisualizer from "./components/AudioVisualizer";
import GradientPicker from "./components/GradientPicker";
import SongDetailModal, { CalibrationSong } from "./components/SongDetailModal";
import { hslToHex, brightenHex } from "./lib/colorUtils";
import songsData from "./data/songs.json";
import tracksData from "./data/tracks.json";

// A real, playable track from the 144-track YouTube playlist catalog
// (built from youtube-mim-217-tracks.csv by scripts/build_tracks.py).
interface RealTrack {
  videoId: string;
  title: string;
  artist: string;
  mood: string;
  type: string; // "music" | "clip" — clips (trailers etc.) stay out of mood queues
  duration: string;
  views: string;
  thumbnail: string;
  youtubeUrl: string;
}
const REAL_TRACKS = tracksData as RealTrack[];

// Pick a random real music track matching the mood (avoiding an immediate
// repeat). Falls back to the whole music catalog if a mood bucket is empty.
function pickRealTrack(mood: string, avoidId?: string): RealTrack | null {
  const music = REAL_TRACKS.filter((t) => t.type === "music");
  let pool = music.filter(
    (t) => t.mood.toLowerCase() === mood.toLowerCase() && t.videoId !== avoidId,
  );
  if (pool.length === 0) pool = music.filter((t) => t.videoId !== avoidId);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Spectral analysis hook mapping energy & brightness features
function useSpectralAnalyzer(analyserNode: AnalyserNode | null, active: boolean) {
  const [features, setFeatures] = useState({ energy: 0, spectralCentroid: 0 });

  useEffect(() => {
    if (!analyserNode || !active) {
      setFeatures({ energy: 0, spectralCentroid: 0 });
      return;
    }

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationFrameId: number;

    const update = () => {
      analyserNode.getByteFrequencyData(dataArray);
      const total = dataArray.reduce((a, b) => a + b, 0);
      const energy = total / bufferLength;
      let weightedSum = 0;
      dataArray.forEach((val, i) => {
        weightedSum += val * i;
      });
      const centroid = weightedSum / (total || 1);
      
      setFeatures({ energy, spectralCentroid: centroid });
      animationFrameId = requestAnimationFrame(update);
    };
    
    update();
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyserNode, active]);

  return features;
}

interface MoodSourceToggleProps {
  currentMode: 'Vision' | 'Sonic';
  onToggle: (mode: 'Vision' | 'Sonic') => void;
}

const MoodSourceToggle: React.FC<MoodSourceToggleProps> = ({ currentMode, onToggle }) => (
  <div className="flex bg-slate-950/80 border border-slate-800/80 rounded-lg p-0.5">
    <button 
      onClick={() => onToggle('Vision')}
      className={`px-3 py-1 rounded-md text-[10px] font-mono tracking-wider transition-all cursor-pointer ${currentMode === 'Vision' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
    >
      VISION
    </button>
    <button 
      onClick={() => onToggle('Sonic')}
      className={`px-3 py-1 rounded-md text-[10px] font-mono tracking-wider transition-all cursor-pointer ${currentMode === 'Sonic' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
    >
      SONIC
    </button>
  </div>
);

// Initialize the persistent procedural synthesizer engine
const synthEngine = new MoodSynthEngine();

export default function App() {
  // Webcam & Capture States
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestTokenRef = useRef<number>(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // App & Mood States
  const [currentMode, setCurrentMode] = useState<'Vision' | 'Sonic'>('Vision');
  const [activeMood, setActiveMood] = useState<MoodResult | null>(null);
  const [manualMood, setManualMood] = useState<string>("Neutral");
  const [volume, setVolume] = useState<number>(0.5);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPlayingSynth, setIsPlayingSynth] = useState<boolean>(false);
  const [history, setHistory] = useState<MoodHistoryItem[]>([]);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioPlaybackType, setAudioPlaybackType] = useState<'synth' | 'youtube'>('youtube');
  const [activeYoutubeUrl, setActiveYoutubeUrl] = useState<string | null>(null);
  const [activeYoutubeSearch, setActiveYoutubeSearch] = useState<string | null>(null);
  // The real playlist track currently loaded in the YouTube player
  const [activeTrack, setActiveTrack] = useState<RealTrack | null>(null);

  // Audio-only YouTube playback — no visible video by design (that surfaces
  // later for the Tribe EEG-scan feature). One persistent, hidden Player
  // instance gives us real stopVideo()/volume control and an onError signal
  // for videos with embedding disabled, instead of appearing/disappearing
  // iframes that could be left un-stoppable.
  const handleUnplayableTrack = useCallback((videoId: string) => {
    const mood = activeMood ? activeMood.mood : manualMood;
    const next = pickRealTrack(mood, videoId);
    if (next) {
      setActiveTrack(next);
      setActiveYoutubeUrl(next.youtubeUrl);
      setActiveYoutubeSearch(`${next.artist} - ${next.title}`);
    }
  }, [activeMood, manualMood]);

  const { play: ytPlay, stop: ytStop } = useYouTubePlayer({
    containerId: "yt-audio-player",
    volume,
    muted: isMuted,
    onUnplayable: handleUnplayableTrack,
  });

  useEffect(() => {
    if (audioPlaybackType === "youtube" && activeTrack && isPlayingSynth) {
      ytPlay(activeTrack.videoId);
    } else {
      ytStop();
    }
  }, [audioPlaybackType, activeTrack, isPlayingSynth, ytPlay, ytStop]);

  // Correction feedback loop states
  const [correctionLog, setCorrectionLog] = useState<any[]>([]);
  const [isEditingMood, setIsEditingMood] = useState<boolean>(false);

  // Calibration Track Library States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>("All");
  const [detailSong, setDetailSong] = useState<CalibrationSong | null>(null);

  // Gradient Picker & Reactive Glow States
  const [pointer, setPointer] = useState<number>(0.5); // 0 to 1
  const [shift, setShift] = useState<number>(0.05); // -1 to 1
  const [ratio, setRatio] = useState<number>(0.5); // 0 to 1
  const [isImmersiveMode, setIsImmersiveMode] = useState<boolean>(false);
  const [isAutoCycling, setIsAutoCycling] = useState<boolean>(false);

  // Bind the spectral analysis hook to get active sound energy and centroid
  const features = useSpectralAnalyzer(synthEngine.getAnalyser(), isPlayingSynth);

  // Real-time audio reactive pulsing of Glow Density (ratio) and Light Dispersion (shift)
  useEffect(() => {
    if (isPlayingSynth && features.energy > 0) {
      // Map energy (0 to ~128+) to a ratio offset
      const energyFactor = Math.min(1.0, features.energy / 100);
      
      // Let it pulse above a comfortable baseline
      const reactiveRatio = Math.min(1.0, Math.max(0.1, 0.45 + energyFactor * 0.45));
      
      // Let spectral centroid map to the shifting color dispersion
      const centroidFactor = Math.min(1.0, features.spectralCentroid / 60);
      const reactiveShift = Math.min(0.8, Math.max(-0.8, -0.4 + centroidFactor * 0.9));

      setRatio(reactiveRatio);
      setShift(reactiveShift);
    }
  }, [features, isPlayingSynth]);

  // Calculate dynamic colors based on picker state
  const colorOuter = hslToHex(pointer * 360, 100, 50);
  const colorInner = hslToHex(((pointer + shift) * 360) % 360, 100, 30 + (1 - ratio) * 55);

  // Helper to map 0-1 pointer hue back to the closest mood name
  const getMoodFromHue = (hue: number): string => {
    let closestMood = "Neutral";
    let minDiff = 999;
    
    Object.keys(MOOD_THEMES).forEach((moodName) => {
      const theme = MOOD_THEMES[moodName];
      let diff = Math.abs(theme.hue - hue);
      if (diff > 0.5) diff = 1.0 - diff;
      if (diff < minDiff) {
        minDiff = diff;
        closestMood = moodName;
      }
    });
    
    return closestMood;
  };

  // Initial setup: Load history safely
  useEffect(() => {
    // Load local storage history safely
    try {
      const stored = localStorage.getItem("face_mood_history_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed);
        if (parsed.length > 0) {
          const lastResult = parsed[0].result;
          // Set the last tracked mood as active
          setActiveMood(lastResult);
          setManualMood(lastResult.mood);

          // Queue a real playlist track for the restored mood
          const restoredTrack = pickRealTrack(lastResult.mood);
          if (restoredTrack) {
            setActiveTrack(restoredTrack);
            setActiveYoutubeUrl(restoredTrack.youtubeUrl);
            setActiveYoutubeSearch(`${restoredTrack.artist} - ${restoredTrack.title}`);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }

    return () => {
      stopWebcam();
      synthEngine.stop();
    };
  }, []);

  // Update synth volume when state changes
  useEffect(() => {
    synthEngine.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  // Handle playing music when activeMood changes
  useEffect(() => {
    if (activeMood) {
      const currentBpm = activeMood.songRecommendation.tempo || 80;
      if (isPlayingSynth) {
        if (audioPlaybackType === 'synth') {
          synthEngine.play(activeMood.mood, currentBpm);
        } else {
          synthEngine.stop();
        }
      }
    }
  }, [activeMood, isPlayingSynth, audioPlaybackType]);

  // Synchronize pointer to active mood theme's hue
  useEffect(() => {
    if (activeMood && !isAutoCycling) {
      const theme = MOOD_THEMES[activeMood.mood];
      if (theme) {
        setPointer(theme.hue);
      }
    }
  }, [activeMood, isAutoCycling]);

  // Auto-cycling color effect (from codepen play animation)
  useEffect(() => {
    let intervalId: any = null;
    if (isAutoCycling) {
      intervalId = setInterval(() => {
        setPointer((prev) => (prev + 0.0004) % 1.0);
        setShift((prev) => {
          let next = prev + 0.002;
          if (next > 1.0) next -= 2.0; // keep within boundaries smoothly
          return next;
        });
      }, 16);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoCycling]);

  // Handle manual pointer adjustments to update simulated state in real time
  const handlePointerChange = (newPointer: number) => {
    setPointer(newPointer);
    if (isAutoCycling) setIsAutoCycling(false); // Disable auto-play on manual drag
    
    // Determine the closest mood corresponding to this pointer position
    const closestMoodName = getMoodFromHue(newPointer);
    if (closestMoodName !== (activeMood?.mood || manualMood)) {
      setPresetMood(closestMoodName);
    }
  };

  // Callback Ref to bind and play webcam stream securely across views and unmounts
  const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && stream) {
      if (node.srcObject !== stream) {
        node.srcObject = stream;
      }
      node.play().catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Video playback failed:", err);
        }
      });
    }
  }, [stream]);

  // Setup/Start webcam stream
  const startWebcam = async () => {
    setCameraError(null);
    setIsCameraLoading(true);

    const currentToken = ++cameraRequestTokenRef.current;
    
    // Imperatively shut down any existing stream in the ref first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      // If a newer request was initiated, or stopWebcam was called, abort this stream immediately
      if (currentToken !== cameraRequestTokenRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch (err: any) {
      if (currentToken !== cameraRequestTokenRef.current) return;
      console.error("Camera access failed:", err);
      let errMsg = "Could not access webcam. Please make sure camera permissions are granted.";
      if (err.name === "NotAllowedError") {
        errMsg = "Camera access denied. Please allow camera permissions in your browser URL bar.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errMsg = "No camera hardware detected on this device.";
      }
      setCameraError(errMsg);
    } finally {
      if (currentToken === cameraRequestTokenRef.current) {
        setIsCameraLoading(false);
      }
    }
  };

  // Stop current stream immediately and stop all hardware camera sensors
  const stopWebcam = () => {
    // Invalidate any active or pending stream request cycles
    cameraRequestTokenRef.current++;

    // 1. Stop streams tracked in the stream Ref
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    // 2. Stop streams tracked in the local state
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    // 3. Clear source elements
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Capture webcam frame or sonic spectral features and send to Express backend API
  const captureAndAnalyze = async () => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const reqBody: any = { mode: currentMode };

      if (currentMode === "Vision") {
        if (!videoRef.current || !stream) {
          throw new Error("Webcam is not active. Please start the camera first.");
        }
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not construct 2D canvas context");

        // Flip image horizontally so it acts like a natural mirror scan
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Extract Base64 JPEG representation
        reqBody.image = canvas.toDataURL("image/jpeg", 0.85);
      } else {
        // Sonic mode: extract current spectral features
        reqBody.energy = features.energy;
        reqBody.spectralCentroid = features.spectralCentroid;
      }

      // Post to Node server API
      const response = await fetch("/api/analyze-vibe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || "Failed to analyze vibe features. Verify your API Key configuration.");
      }

      const result: MoodResult = await response.json();

      // Update states
      setActiveMood(result);
      setManualMood(result.mood);

      // Add to local history list
      const newItem: MoodHistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        result,
      };

      const updatedHistory = [newItem, ...history].slice(0, 30); // Keep last 30 scans
      setHistory(updatedHistory);
      localStorage.setItem("face_mood_history_v1", JSON.stringify(updatedHistory));

      // Pick a REAL track from the playlist catalog for the detected mood
      const realTrack = pickRealTrack(result.mood, activeTrack?.videoId);
      if (realTrack) {
        setActiveTrack(realTrack);
        setActiveYoutubeUrl(realTrack.youtubeUrl);
        setActiveYoutubeSearch(`${realTrack.artist} - ${realTrack.title}`);
      } else {
        setActiveTrack(null);
        setActiveYoutubeUrl(null);
        setActiveYoutubeSearch(null);
      }

      // Trigger automatic music play
      const targetBpm = result.songRecommendation.tempo || 80;
      if (audioPlaybackType === 'synth') {
        synthEngine.play(result.mood, targetBpm);
      } else {
        synthEngine.stop();
      }
      setIsPlayingSynth(true);

    } catch (err: any) {
      console.error("Analysis sequence error:", err);
      setErrorMessage(err.message || "An unexpected error occurred during biometric scan.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggles the synth audio playback
  const toggleSynthPlayback = () => {
    if (isPlayingSynth) {
      synthEngine.stop();
      setIsPlayingSynth(false);
    } else {
      const mood = activeMood ? activeMood.mood : manualMood;
      const currentTheme = MOOD_THEMES[mood];
      if (!currentTheme) return;

      const bpm = activeMood?.songRecommendation.tempo || 80;

      // Pick a REAL track from the playlist catalog for this mood
      const randomTrack = pickRealTrack(mood, activeTrack?.videoId);
      if (randomTrack) {
        setActiveTrack(randomTrack);
        setActiveYoutubeUrl(randomTrack.youtubeUrl);
        setActiveYoutubeSearch(`${randomTrack.artist} - ${randomTrack.title}`);
      }

      if (audioPlaybackType === 'synth') {
        synthEngine.play(mood, bpm);
      } else {
        synthEngine.stop();
      }
      setIsPlayingSynth(true);

      // Set default visualizer parameters if no active mood scan exists
      if (!activeMood) {
        setActiveMood({
          mood: mood as any,
          confidence: 100,
          lightColor: currentTheme.color,
          facialFeatures: {
            eyes: "Interactive simulation focus",
            mouth: "Manual preset state active",
            eyebrows: "Neutral balanced baseline",
            tension: "Relaxed",
            expressionDetails: "Listening to manual interactive mood soundscapes.",
          },
          songRecommendation: {
            title: randomTrack ? randomTrack.title : `Procedural ${mood} Symphony`,
            artist: randomTrack ? randomTrack.artist : "Neural Synth Engine",
            genre: randomTrack ? randomTrack.mood : "Ambient Soundscape",
            tempo: bpm,
            description: randomTrack ? `Now queued from your playlist: "${randomTrack.title}" by ${randomTrack.artist}.` : `A custom-engineered ambient loop procedurally modulated to reinforce a ${mood} state.`,
          },
        });
      }
    }
  };

  // Manually trigger a mock/calculated mood state (for testing / fun without webcam)
  const setPresetMood = (moodName: string) => {
    const theme = MOOD_THEMES[moodName];
    if (!theme) return;

    // Find matching songs from the 50-song calibration bank
    const matchingSongs = songsData.filter(
      (s) => s.primaryMood.toLowerCase() === moodName.toLowerCase()
    );
    const randomSong =
      matchingSongs.length > 0
        ? matchingSongs[Math.floor(Math.random() * matchingSongs.length)]
        : {
            track: `Ethereal ${moodName} Flight`,
            artist: "Aura Synth Orchestrations",
            mood: moodName,
            colors: [theme.color, "#000000"],
          };

    const simulatedResult: MoodResult = {
      mood: moodName as any,
      confidence: 100,
      lightColor: randomSong.colors[0] || theme.color,
      facialFeatures: {
        eyes:
          moodName === "Sad" || moodName === "Calm"
            ? "Heavy-lidded, peaceful downward focus"
            : moodName === "Excited" || moodName === "Happy"
            ? "Wide, sparkling upward focus"
            : "Balanced, responsive tracking alignment",
        mouth:
          moodName === "Happy" || moodName === "Excited"
            ? "Curved upward, slightly parted lips"
            : moodName === "Sad" || moodName === "Angry"
            ? "Slightly compressed downward structure"
            : "Neutral horizontal alignment",
        eyebrows:
          moodName === "Angry" || moodName === "Anxious"
            ? "Furrowed, high tension forehead curvature"
            : "Relaxed, natural eyebrow lines",
        tension:
          moodName === "Angry" || moodName === "Anxious"
            ? "Elevated facial muscle tension"
            : "Smooth, balanced composure",
        expressionDetails: `Manually locked into the ${moodName} atmospheric theme and calibrated with "${randomSong.track}".`,
      },
      songRecommendation: {
        title: randomSong.track,
        artist: randomSong.artist,
        genre: randomSong.mood,
        tempo:
          moodName === "Excited"
            ? 128
            : moodName === "Angry"
            ? 130
            : moodName === "Happy"
            ? 100
            : 72,
        description: `This procedural soundscape is calibrated to map to "${randomSong.track}" by ${randomSong.artist} (${randomSong.mood}). Colors: ${randomSong.colors.join(
          ", "
        )}.`,
      },
    };

    setActiveMood(simulatedResult);
    setManualMood(moodName);

    if (isPlayingSynth) {
      if (audioPlaybackType === 'synth') {
        synthEngine.play(moodName, simulatedResult.songRecommendation.tempo);
      } else {
        synthEngine.stop();
      }
    }
  };

  const playSongFromLibrary = (song: any) => {
    const moodName = song.primaryMood;
    const theme = MOOD_THEMES[moodName] || MOOD_THEMES.Neutral;

    const customResult: MoodResult = {
      mood: moodName,
      confidence: 100,
      lightColor: song.colors[0],
      facialFeatures: {
        eyes: "Target lock on calibrated reference audio",
        mouth: `Calibrating against: ${song.track}`,
        eyebrows: `Vocal reference matching: ${song.artist}`,
        tension: "Procedural phase synchronization active",
        expressionDetails: `Playing "${song.track}" by ${song.artist}. Mood class: ${song.mood}.`,
      },
      songRecommendation: {
        title: song.track,
        artist: song.artist,
        genre: song.mood,
        tempo: moodName === "Excited" ? 128 : moodName === "Angry" ? 130 : moodName === "Happy" ? 100 : 72,
        description: `This procedural soundscape is calibrated to map to "${song.track}" by ${song.artist} (${song.mood}). Custom dual-color spectrum: ${song.colors.join(', ')}.`,
      },
    };

    setActiveMood(customResult);
    setManualMood(moodName);

    // Sync wheel pointer hue if we can estimate it, or just match mood's hue
    if (theme) {
      setPointer(theme.hue);
    }

    // Prefer the EXACT song if it exists in the real playlist catalog
    // (clicking "Landslide" should play Landslide); otherwise pick any
    // real track matching the forced mood.
    const clickedTitle = song.track.toLowerCase();
    const exactTrack = REAL_TRACKS.find(
      (t) =>
        t.type === "music" &&
        (t.title.toLowerCase().includes(clickedTitle) ||
          clickedTitle.includes(t.title.toLowerCase())),
    );
    const forcedTrack = exactTrack ?? pickRealTrack(moodName, activeTrack?.videoId);
    if (forcedTrack) {
      setActiveTrack(forcedTrack);
      setActiveYoutubeUrl(forcedTrack.youtubeUrl);
      setActiveYoutubeSearch(`${forcedTrack.artist} - ${forcedTrack.title}`);
    } else {
      setActiveYoutubeUrl(song.youtubeUrl);
      setActiveYoutubeSearch(`${song.artist} - ${song.track}`);
    }

    if (audioPlaybackType === 'synth') {
      synthEngine.play(moodName, customResult.songRecommendation.tempo);
    } else {
      synthEngine.stop();
    }
    setIsPlayingSynth(true);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("face_mood_history_v1");
  };

  const executeHardKill = () => {
    // 1. Terminate Audio Stream
    synthEngine.stop();
    setIsPlayingSynth(false);
    
    // 2. Terminate Vision Feed / Stop Hardware Camera
    stopWebcam();

    // 3. Clear State / Purge active track
    setIsAnalyzing(false);
    setActiveMood(null);
    setErrorMessage(null);
    setCameraError(null);
    setActiveYoutubeUrl(null);
    setActiveYoutubeSearch(null);
    
    console.log("SYSTEM_PURGE_COMPLETE");
  };

  const handleCorrection = async (correctedMood: string) => {
    if (!activeMood) return;

    const correction = {
      predictedMood: activeMood.mood,
      actualMood: correctedMood,
      facialFeatures: activeMood.facialFeatures,
      timestamp: new Date().toISOString()
    };
    
    // Optimistically update active mood state & log
    setActiveMood(prev => {
      if (!prev) return null;
      return {
        ...prev,
        mood: correctedMood as any,
        lightColor: MOOD_THEMES[correctedMood]?.color || prev.lightColor
      };
    });
    setManualMood(correctedMood);
    setCorrectionLog(prev => [...prev, correction]);

    try {
      // Persist to user_baseline.json via custom backend route
      await fetch('/api/save-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(correction)
      });
    } catch (e) {
      console.error("Failed to save correction to baseline:", e);
    }
  };

  // Gather theme information for the active mood or fall back to Neutral
  const currentTheme = MOOD_THEMES[activeMood?.mood || manualMood] || MOOD_THEMES.Neutral;
  const glowHex = currentTheme.color;

  if (isImmersiveMode) {
    return (
      <div
        id="app_root_container"
        className="min-h-screen relative flex flex-col justify-between font-sans transition-all duration-1000 ease-in-out text-slate-100 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${colorOuter}dd, ${colorInner}dd)`,
        }}
      >
        {/* BACKGROUND BLUR LAYER */}
        <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px] pointer-events-none" />

        {/* FLOATING HEADER FOR DJ MODE */}
        <header className="relative z-10 px-6 py-4 flex items-center justify-between bg-slate-950/60 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-3">
            <Smile className="w-5 h-5 animate-bounce" style={{ color: colorOuter }} />
            <div>
              <h1 className="text-sm font-bold tracking-wider uppercase text-white flex items-center gap-2">
                DJ Glow Mode
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
                  {activeMood?.mood || manualMood} Scale
                </span>
              </h1>
              <p className="text-[10px] text-slate-300 font-mono">Continuous Vibe Projection Booth</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAutoCycling(!isAutoCycling)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                isAutoCycling
                  ? "bg-white text-slate-950 font-bold border-white"
                  : "bg-black/40 border-white/10 text-slate-300 hover:bg-black/60"
              }`}
            >
              {isAutoCycling ? "● AUTO CYCLING ON" : "MANUAL INTERACTION"}
            </button>
            
            <button
              onClick={() => setIsImmersiveMode(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 border border-white/10 text-white hover:bg-white/25 transition-all"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Console View</span>
            </button>
          </div>
        </header>

        {/* CENTER GLOW CONTAINER */}
        <div className="flex-grow flex flex-col lg:flex-row items-center justify-center p-6 gap-8 max-w-7xl mx-auto w-full z-10">
          {/* LEFT: THE GIANT RADIAL PICKER WITH WEBCAM FEED PREVIEW EMBEDDED INSIDE THE CENTER */}
          <div className="flex flex-col items-center">
            <div className="relative p-4 bg-black/30 rounded-full border border-white/10 backdrop-blur-md shadow-2xl">
              <GradientPicker
                pointerValue={pointer}
                shiftValue={shift}
                ratioValue={ratio}
                onPointerChange={handlePointerChange}
                onShiftChange={setShift}
                onRatioChange={setRatio}
                colorInner={colorInner}
                colorOuter={colorOuter}
                isInteractive={true}
              />

              {/* CUSTOM VIDEO OVERLAY INSIDE THE CIRCULAR CORE */}
              <div className="absolute inset-[82px] rounded-full overflow-hidden border border-white/10 pointer-events-none bg-slate-950">
                {stream ? (
                  <video
                    ref={videoRefCallback}
                    className="w-full h-full object-cover scale-x-[-1] brightness-110 contrast-115"
                    playsInline
                    muted
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 bg-slate-950">
                    <Camera className="w-6 h-6 text-slate-600 animate-pulse" />
                    <span className="text-[8px] text-slate-500 mt-1 uppercase font-mono tracking-widest">No Cam</span>
                  </div>
                )}
                {/* Dynamic Overlay hue wash */}
                <div
                  className="absolute inset-0 mix-blend-color opacity-30 transition-all duration-700"
                  style={{ backgroundColor: colorInner }}
                />
              </div>
            </div>

            <div className="mt-5 w-full max-w-sm flex flex-col gap-2.5">
              {/* PRIMARY SCAN TRIGGER */}
              <button
                onClick={captureAndAnalyze}
                disabled={isAnalyzing || !stream}
                className="w-full py-3.5 px-6 bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-sm rounded-xl shadow-[0_4px_30px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4 text-slate-900 animate-pulse" />
                <span>{isAnalyzing ? "SCANNING TARGET PROFILE..." : "SCAN FACIAL EXPRESSION"}</span>
              </button>

              {/* HARDWARE OVERLAY TOGGLES (STOP / START BUTTONS) */}
              {stream ? (
                <button
                  onClick={stopWebcam}
                  className="w-full py-3 px-6 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs rounded-xl shadow-[0_4px_20px_rgba(239,68,68,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-red-500/30 flex items-center justify-center gap-2 tracking-wider uppercase"
                >
                  <VideoOff className="w-3.5 h-3.5" />
                  <span>Stop Hardware Camera Stream</span>
                </button>
              ) : (
                <button
                  onClick={startWebcam}
                  disabled={isCameraLoading}
                  className="w-full py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-emerald-500/30 flex items-center justify-center gap-2 tracking-wider uppercase disabled:opacity-50"
                >
                  <Video className="w-3.5 h-3.5 animate-bounce" />
                  <span>{isCameraLoading ? "Booting Stream Hardware..." : "Start Hardware Camera Stream"}</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: LIVE TELEMETRY, SOUNDWAVE, & PRESETS OVERLAYS */}
          <div className="flex flex-col gap-4 max-w-md w-full">
            {/* ATMOSPHERE STATISTICS */}
            <div className="bg-black/40 border border-white/10 backdrop-blur-md p-5 rounded-2xl">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300 block mb-1">Atmosphere Matrix</span>
              <h2 className="text-3xl font-extrabold text-white flex items-center gap-2">
                {activeMood?.mood || manualMood}
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded border border-white/10 font-normal">
                  {activeMood ? `${activeMood.confidence}% confident` : "Preset Lock"}
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {activeMood?.songRecommendation.description || "Synthesized scale projection activated."}
              </p>

              <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300">Tempo Preset</span>
                  <span className="font-mono font-bold text-white">{activeMood?.songRecommendation.tempo || 80} BPM</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300">Key Balance (Shift)</span>
                  <span className="font-mono font-bold text-white" style={{ color: colorOuter }}>{shift.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300">Synth Light Dispersion (Ratio)</span>
                  <span className="font-mono font-bold text-white" style={{ color: colorInner }}>{ratio.toFixed(3)}</span>
                </div>
              </div>
            </div>

            {/* AUDIO CONTROLLER IN IMMERSIVE MODE */}
            <div className="bg-black/40 border border-white/10 backdrop-blur-md p-5 rounded-2xl flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-300 block mb-0.5">Synth Output</span>
                  <span className="text-sm font-bold text-white">Procedural Soundscape</span>
                </div>
                
                <button
                  onClick={toggleSynthPlayback}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-slate-950 hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
                >
                  {isPlayingSynth ? <Square className="w-4 h-4 fill-slate-950 text-slate-950" /> : <Play className="w-4 h-4 fill-slate-950 text-slate-950 ml-0.5" />}
                </button>
              </div>

              <div className="w-full">
                <AudioVisualizer
                  analyser={synthEngine.getAnalyser()}
                  isPlaying={isPlayingSynth}
                  lightColor={colorOuter}
                  mood={activeMood?.mood || manualMood}
                />
              </div>

              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all shrink-0 border border-white/5"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-300" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="flex-grow accent-white bg-black/40 border border-white/10 rounded-lg h-1.5 cursor-pointer"
                />
              </div>
            </div>

            {/* QUICK CHROME WHEEL PRESETS */}
            <div className="bg-black/40 border border-white/10 backdrop-blur-md p-4 rounded-2xl">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300 block mb-2.5">Mood Theme Jumps</span>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.keys(MOOD_THEMES).map((moodName) => {
                  const theme = MOOD_THEMES[moodName];
                  const isActive = (activeMood?.mood || manualMood) === moodName;
                  return (
                    <button
                      key={moodName}
                      onClick={() => setPresetMood(moodName)}
                      className={`p-1.5 rounded-lg border text-[10px] font-mono text-center font-bold tracking-wider transition-all cursor-pointer ${
                        isActive
                          ? "bg-white text-slate-950 border-white shadow-lg scale-105"
                          : "bg-black/20 border-white/5 text-slate-300 hover:bg-black/40"
                      }`}
                    >
                      {moodName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER FOR DJ MODE */}
        <footer className="relative z-10 py-3 text-center bg-slate-950/40 backdrop-blur-md border-t border-white/5 w-full mt-auto">
          <p className="text-[9px] font-mono text-slate-400">
            Projections active: {colorOuter} → {colorInner} • Interlock enabled
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div
      id="app_root_container"
      className="min-h-screen relative flex flex-col justify-between font-sans transition-all duration-1000 ease-in-out bg-slate-950 text-slate-100 overflow-hidden"
    >
      {/* Hidden, persistent audio-only YouTube player. Mounted once (not
          conditionally) so there is exactly one Player instance we fully
          control via stopVideo()/destroy() — no appearing/disappearing
          iframes that can be left un-stoppable. 1x1px, not display:none
          (YT requires real layout to initialize reliably). */}
      <div style={{ position: "fixed", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
        <div id="yt-audio-player" />
      </div>

      {/* CONSTANT MOOD LIGHT WALL GLOW */}
      <div
        id="ambient_mood_glow"
        className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-in-out"
        style={{
          background: `radial-gradient(circle 50vw at 50% 30%, ${currentTheme.glowColor}, rgba(3, 7, 18, 0) 80%), 
                      radial-gradient(circle 35vw at 10% 80%, ${currentTheme.glowColor}1a, rgba(3, 7, 18, 0) 70%)`,
        }}
      />

      {/* HEADER SECTION */}
      <header id="app_header" className="relative z-10 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-md px-4 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl border transition-all duration-500"
              style={{
                borderColor: `${glowHex}40`,
                backgroundColor: `${glowHex}10`,
                boxShadow: `0 0 15px ${glowHex}20`,
              }}
            >
              <Smile className="w-6 h-6" style={{ color: glowHex }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                Face Mood Tracker
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border uppercase"
                  style={{
                    backgroundColor: `${glowHex}15`,
                    borderColor: `${glowHex}30`,
                    color: glowHex,
                  }}
                >
                  {currentTheme.mood} Light
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">Webcam Bio-Emotional Scanning Station</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsImmersiveMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Activate DJ Glow Mode"
            >
              <Maximize2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>DJ Glow Mode</span>
            </button>

            <button
              id="info_modal_button"
              onClick={() => setShowInfoModal(true)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
              title="System Documentation"
            >
              <Info className="w-5 h-5" />
            </button>
            <a
              href="https://ai.studio/build"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1 text-[11px] font-mono font-semibold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              AI Studio Build
            </a>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main id="app_main_content" className="relative z-10 flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANEL: CAMERA & TRACKER FEED (cols: 7) */}
        <div id="camera_feeder_panel" className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 backdrop-blur-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
              <div className="flex items-center gap-2">
                {currentMode === "Vision" ? <Camera className="w-4 h-4 text-slate-400" /> : <Activity className="w-4 h-4 text-slate-400" />}
                <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">
                  {currentMode === "Vision" ? "Biometric Live Feed" : "Sonic Spectral Feed"}
                </h2>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <MoodSourceToggle
                  currentMode={currentMode}
                  onToggle={(mode) => {
                    setCurrentMode(mode);
                    if (mode === "Sonic") {
                      stopWebcam();
                    } else {
                      startWebcam();
                    }
                  }}
                />
                <div className="flex items-center gap-1.5">
                  <span className="flex h-2 w-2 relative">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stream ? "bg-emerald-400" : "bg-red-400"}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${stream ? "bg-emerald-500" : "bg-red-500"}`}></span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {stream ? "Sensor Connected" : "Sensor Offline"}
                  </span>
                </div>
              </div>
            </div>

            {/* CAMERA OR SPECTRAL STAGE FRAME */}
            <div className="aspect-video w-full bg-slate-950 rounded-xl relative border border-slate-800 overflow-hidden flex items-center justify-center">
              {currentMode === "Sonic" ? (
                <div className="absolute inset-0 p-4 flex flex-col justify-between bg-slate-950/95">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-mono text-indigo-400 block tracking-widest uppercase">Sonic Diagnostics Matrix</span>
                      <span className="text-sm font-bold text-white font-sans">Active Audio Signal Flow</span>
                    </div>
                    <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-lg px-2 py-0.5 text-right">
                      <span className="text-[8px] font-mono text-indigo-400 block">SAMPLING FREQ</span>
                      <span className="text-[9px] font-mono font-bold text-white">256 Bins • Realtime</span>
                    </div>
                  </div>

                  {/* Visualizer embedded inside the frame */}
                  <div className="flex-grow flex items-center justify-center py-2 h-20">
                    <AudioVisualizer
                      analyser={synthEngine.getAnalyser()}
                      isPlaying={isPlayingSynth}
                      lightColor={glowHex}
                      mood={activeMood?.mood || manualMood}
                    />
                  </div>

                  {/* Realtime features display */}
                  <div className="grid grid-cols-2 gap-2 text-left">
                    <div className="bg-slate-900/60 border border-slate-800/80 p-2 rounded-lg flex justify-between items-center">
                      <span className="text-[9px] font-mono text-slate-400 uppercase">Acoustic Energy</span>
                      <span className="text-xs font-mono font-bold text-indigo-400">{features.energy.toFixed(1)} dB</span>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800/80 p-2 rounded-lg flex justify-between items-center">
                      <span className="text-[9px] font-mono text-slate-400 uppercase">Spectral Centroid</span>
                      <span className="text-xs font-mono font-bold text-indigo-400">{features.spectralCentroid.toFixed(1)} Hz</span>
                    </div>
                  </div>
                </div>
              ) : stream ? (
                <video
                  ref={videoRefCallback}
                  className="w-full h-full object-cover scale-x-[-1]"
                  playsInline
                  muted
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90">
                  <Camera className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
                  <p className="text-sm font-medium text-slate-300 mb-1">Webcam stream is inactive</p>
                  <p className="text-xs text-slate-500 max-w-xs mb-4">Permit camera permissions to trace real-time muscle configurations & eyelids.</p>
                  <button
                    id="trigger_camera_start"
                    onClick={startWebcam}
                    disabled={isCameraLoading}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg transition-all border border-slate-700 hover:border-slate-600 flex items-center gap-2"
                  >
                    {isCameraLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    Initialize Webcam
                  </button>
                </div>
              )}

              {/* CAMERA INTERACTIVE GLOW LIGHT ACCENT */}
              {currentMode === "Vision" && stream && (
                <div
                  className="absolute inset-0 border-2 pointer-events-none rounded-xl transition-all duration-1000"
                  style={{ borderColor: `${glowHex}35` }}
                />
              )}

              {/* FLOATING SCANNER LINE */}
              {isAnalyzing && currentMode === "Vision" && (
                <div className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399] animate-scan" />
              )}

              {/* BIO SCANNING RETICLES OVERLAY */}
              {currentMode === "Vision" && stream && !isAnalyzing && (
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-t-2 border-l-2 border-slate-500/50" />
                    <div className="w-4 h-4 border-t-2 border-r-2 border-slate-500/50" />
                  </div>
                  <div className="self-center flex flex-col items-center text-center opacity-40 bg-slate-950/80 px-4 py-1.5 rounded-full border border-slate-800/40 backdrop-blur-sm">
                    <p className="text-[10px] font-mono tracking-widest uppercase">Target Alignment Matrix</p>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-b-2 border-l-2 border-slate-500/50" />
                    <div className="w-4 h-4 border-b-2 border-r-2 border-slate-500/50" />
                  </div>
                </div>
              )}

              {/* SCANNING PROGRESS OVERLAY */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-4 backdrop-blur-sm text-center">
                  <div className="relative mb-3">
                    <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                    <Smile className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <p className="text-xs font-mono text-emerald-400 tracking-wider uppercase mb-1">
                    {currentMode === "Vision" ? "Scanning Neural Topology..." : "Extracting Spectral Envelope..."}
                  </p>
                  <p className="text-[10px] text-slate-500 max-w-xs font-mono">
                    {currentMode === "Vision" 
                      ? "Tracing eyebrow tilt, cheek altitude, and oral curvature vectors."
                      : "Calculating energy standard deviation, spectral flux, and centroid brightness."}
                  </p>
                </div>
              )}
            </div>

            {/* ACTION TRIGGERS & CAMERA OPTIONS */}
            <div className="mt-4 space-y-3">
              {/* ALWAYS-VISIBLE STOP MUSIC — shows in any mode while sound is playing */}
              {isPlayingSynth && (
                <button
                  onClick={() => { synthEngine.stop(); setIsPlayingSynth(false); }}
                  aria-label="Stop music"
                  className="w-full py-4 px-5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-xl text-base font-bold flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(220,38,38,0.35)] transition-all cursor-pointer border border-red-500/40"
                >
                  <Square className="w-5 h-5 fill-white" />
                  <span>STOP MUSIC</span>
                </button>
              )}
              {/* PRIMARY ACTION ROWS */}
              <div className="grid grid-cols-2 gap-3">
                {currentMode === "Sonic" ? (
                  <button
                    onClick={toggleSynthPlayback}
                    className={`py-4 px-5 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border ${
                      isPlayingSynth
                        ? "bg-gradient-to-r from-red-600 to-rose-700 border-red-500/30 text-white shadow-[0_4px_20px_rgba(220,38,38,0.25)]"
                        : "bg-gradient-to-r from-indigo-600 to-violet-700 border-indigo-500/30 text-white shadow-[0_4px_20px_rgba(79,70,229,0.25)]"
                    }`}
                  >
                    {isPlayingSynth ? (
                      <>
                        <Square className="w-4 h-4" />
                        <span>STOP SYNTH</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>PLAY SYNTH LOOP</span>
                      </>
                    )}
                  </button>
                ) : stream ? (
                  <button
                    id="stop_webcam_btn"
                    onClick={stopWebcam}
                    className="py-4 px-5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(220,38,38,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-red-500/30"
                  >
                    <VideoOff className="w-4 h-4 animate-pulse" />
                    <span>STOP CAMERA</span>
                  </button>
                ) : (
                  <button
                    id="start_webcam_btn"
                    onClick={startWebcam}
                    disabled={isCameraLoading}
                    className="py-4 px-5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-emerald-500/30 disabled:opacity-50"
                  >
                    <Video className="w-4 h-4 animate-bounce" />
                    <span>{isCameraLoading ? "STARTING..." : "START CAMERA"}</span>
                  </button>
                )}

                <button
                  id="capture_analyze_btn"
                  onClick={captureAndAnalyze}
                  disabled={isAnalyzing || (currentMode === "Vision" && !stream)}
                  className="py-4 px-5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    backgroundColor: (currentMode === "Sonic" || stream) ? glowHex : "#475569",
                    boxShadow: (currentMode === "Sonic" || stream) ? `0 4px 25px ${glowHex}45` : "none",
                  }}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {currentMode === "Vision" ? "Tracing Face..." : "Analyzing Sound..."}
                    </>
                  ) : (
                    <>
                      {currentMode === "Vision" ? <Camera className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                      <span>{currentMode === "Vision" ? "Scan Face & Set Vibe" : "Analyze Audio Vibe"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* AUXILIARY CONTROLS */}
              {currentMode === "Vision" && stream && (
                <div className="flex justify-end">
                  <button
                    id="reconnect_webcam_btn"
                    onClick={startWebcam}
                    disabled={isCameraLoading}
                    className="px-3 py-1.5 border border-slate-800 hover:border-slate-750 bg-slate-900/60 text-slate-400 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Reset Camera Feed"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCameraLoading ? "animate-spin" : ""}`} />
                    <span>Reset Feed</span>
                  </button>
                </div>
              )}
            </div>

            {cameraError && currentMode === "Vision" && (
              <div className="mt-3.5 p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-red-400 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {errorMessage && (
              <div className="mt-3.5 p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-300 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-mono">{errorMessage}</span>
              </div>
            )}
          </div>

          {/* DYNAMIC AMBIENT LIGHT & TRACKED BIOMETRICS CARD */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full filter blur-[40px] pointer-events-none opacity-40 transition-all duration-1000" style={{ backgroundColor: glowHex }} />
            
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Target Feature Diagnostics</h2>
            </div>

            {activeMood ? (
              <div className="space-y-4">
                {/* Mood Meter Headers */}
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-xs font-mono text-slate-400 block uppercase tracking-wider">Estimated Vibe State</span>
                    <div className="flex items-center gap-2 mt-1">
                      {isEditingMood ? (
                        <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                          <select
                            value={activeMood.mood}
                            onChange={(e) => {
                              handleCorrection(e.target.value);
                              setIsEditingMood(false);
                            }}
                            className="bg-transparent text-sm font-semibold text-indigo-300 border-none focus:outline-none focus:ring-0 cursor-pointer"
                          >
                            {Object.keys(MOOD_THEMES).map((m) => (
                              <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setIsEditingMood(false)}
                            className="text-[10px] font-mono font-bold text-slate-400 hover:text-white uppercase px-1 transition-colors cursor-pointer"
                          >
                            Close
                          </button>
                        </div>
                      ) : (
                        <span className="text-2xl font-bold text-white flex items-center gap-1.5">
                          <span>{activeMood.mood}</span>
                          <button
                            onClick={() => setIsEditingMood(true)}
                            className="p-1 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
                            title="Override detected mood"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                      {!isEditingMood && (
                        <span className="text-xs font-normal text-slate-400">
                          ({activeMood.confidence}% confidence)
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Glowing physical Constant Light orb indicator */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Mood Light</span>
                    <div
                      className="w-7 h-7 rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(255,255,255,0.2)] animate-pulse"
                      style={{
                        backgroundColor: activeMood.lightColor,
                        boxShadow: `0 0 25px ${activeMood.lightColor}`,
                      }}
                    />
                  </div>
                </div>

                {/* Grid of tracked physiological features */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <Eye className="w-3.5 h-3.5" style={{ color: glowHex }} />
                      <span className="text-[10px] font-mono uppercase tracking-wider">Eyes & Eyelids</span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium">{activeMood.facialFeatures.eyes}</p>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <Smile className="w-3.5 h-3.5" style={{ color: glowHex }} />
                      <span className="text-[10px] font-mono uppercase tracking-wider">Mouth & Cheeks</span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium">{activeMood.facialFeatures.mouth}</p>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <Frown className="w-3.5 h-3.5" style={{ color: glowHex }} />
                      <span className="text-[10px] font-mono uppercase tracking-wider">Eyebrow Position</span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium">{activeMood.facialFeatures.eyebrows}</p>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <Flame className="w-3.5 h-3.5" style={{ color: glowHex }} />
                      <span className="text-[10px] font-mono uppercase tracking-wider">Muscle Tension</span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium">{activeMood.facialFeatures.tension}</p>
                  </div>
                </div>

                {/* Expression Summary statement */}
                <div
                  className="p-3 rounded-xl border text-xs leading-relaxed"
                  style={{
                    backgroundColor: `${glowHex}08`,
                    borderColor: `${glowHex}20`,
                  }}
                >
                  <span className="font-mono font-semibold uppercase block text-[10px] tracking-wider mb-0.5" style={{ color: glowHex }}>
                    Structural Expression Analysis
                  </span>
                  <span className="text-slate-300">{activeMood.facialFeatures.expressionDetails}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 flex flex-col items-center">
                <Smile className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-xs">No active scan registered. Use the scanner above or select a preset below to cast an ambient vibe.</p>
              </div>
            )}
          </div>

          {/* CALIBRATION TRACK EXPLORER */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 backdrop-blur-xl relative overflow-hidden flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">MIM- 50 Track Calibration Bank</h2>
              </div>
              <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 text-slate-400">
                {songsData.length} Calibrated Tracks
              </span>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Browse, filter, and preview the primary neuro-acoustic song dataset. Click any track to calibrate the interface using its specific bi-color gradient spectrum and emotional key frequency loops.
            </p>

            {/* SEARCH & FILTER BAR */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search tracks or artists..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 font-sans transition-all"
                />
              </div>

              {/* MOOD FILTER SELECTOR */}
              <select
                value={selectedMoodFilter}
                onChange={(e) => setSelectedMoodFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-300 px-3 py-1.5 focus:outline-none focus:border-slate-700 transition-all font-mono"
              >
                <option value="All">All Moods</option>
                <option value="Happy">Happy</option>
                <option value="Sad">Sad</option>
                <option value="Calm">Calm</option>
                <option value="Excited">Excited</option>
                <option value="Angry">Angry</option>
                <option value="Anxious">Anxious</option>
                <option value="Neutral">Neutral</option>
              </select>
            </div>

            {/* FILTER CHIPS (COMPACT OVERVIEW) */}
            <div className="flex flex-wrap gap-1">
              {["All", "Happy", "Sad", "Calm", "Excited", "Angry", "Anxious", "Neutral"].map((m) => {
                const theme = MOOD_THEMES[m];
                const isSelected = selectedMoodFilter === m;
                return (
                  <button
                    key={m}
                    onClick={() => setSelectedMoodFilter(m)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? "bg-white text-slate-950 border-white font-bold"
                        : "bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-300 hover:border-slate-800"
                    }`}
                  >
                    {theme && (
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: theme.color }}
                      />
                    )}
                    {m}
                  </button>
                );
              })}
            </div>

            {/* SONGS LIST */}
            <div className="max-h-[380px] overflow-y-auto pr-1 space-y-2 mt-1">
              {(() => {
                const filtered = songsData.filter((song) => {
                  const matchSearch =
                    song.track.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    song.artist.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchMood =
                    selectedMoodFilter === "All" ||
                    song.primaryMood.toLowerCase() === selectedMoodFilter.toLowerCase();
                  return matchSearch && matchMood;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-8 text-center text-slate-600 text-xs font-mono">
                      No matching calibrated tracks found.
                    </div>
                  );
                }

                return filtered.map((song) => {
                  const isActive = activeMood?.songRecommendation.title === song.track;
                  const theme = MOOD_THEMES[song.primaryMood] || MOOD_THEMES.Neutral;
                  return (
                    <div
                      key={song.track}
                      onClick={() => setDetailSong(song as CalibrationSong)}
                      className={`p-2.5 bg-slate-950/60 border rounded-xl flex items-center justify-between text-xs transition-all hover:bg-slate-950 group cursor-pointer ${
                        isActive
                          ? "border-emerald-500 bg-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                          : "border-slate-900 hover:border-slate-800"
                      }`}
                      title={`View calibration details for ${song.track}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-grow">
                        {/* Interactive trigger / play indicator */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playSongFromLibrary(song);
                          }}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                            isActive
                              ? "bg-emerald-500 text-slate-950 border-emerald-400"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                          }`}
                          title={`Calibrate & Play ${song.track}`}
                        >
                          {isActive && isPlayingSynth ? (
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
                            </span>
                          ) : (
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                          )}
                        </button>

                        <div className="min-w-0 flex-grow">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-200 truncate block">
                              {song.track}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-mono rounded">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 truncate block">
                            by {song.artist}
                          </span>

                          {/* Dual-color indicator row */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                              Spectrum:
                            </span>
                            <div className="flex items-center gap-1">
                              {song.colors.map((c, i) => (
                                <div key={i} className="flex items-center gap-1 bg-slate-900 border border-slate-800/80 px-1 py-0.5 rounded text-[8px] font-mono text-slate-300">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full inline-block"
                                    style={{ backgroundColor: c }}
                                  />
                                  {c}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right actions: Mood indicator and external YouTube link */}
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span
                          className="px-2 py-0.5 text-[9px] font-mono rounded-full border hidden sm:inline"
                          style={{
                            backgroundColor: `${theme.color}15`,
                            borderColor: `${theme.color}30`,
                            color: theme.color,
                          }}
                        >
                          {song.primaryMood}
                        </span>

                        <a
                          href={song.youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800/85 hover:border-slate-700 hover:bg-slate-850 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                          title="Open on YouTube"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: AUDIOWAVE SYNTH & MUSIC CONTROLLER (cols: 5) */}
        <div id="synth_player_panel" className="lg:col-span-5 flex flex-col gap-4">
          
          {/* MUSIC PLAYER STATION */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 backdrop-blur-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Neuro-Acoustic Synthesizer</h2>
              </div>
              <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[9px] font-mono text-slate-400">Web Audio API</span>
              </div>
            </div>

            {/* AUDIO WAVE VISUALIZER */}
            <div className="mb-4">
              <AudioVisualizer
                analyser={synthEngine.getAnalyser()}
                isPlaying={isPlayingSynth}
                lightColor={glowHex}
                mood={activeMood?.mood || manualMood}
              />
            </div>

            {/* ACTIVE SONG TRACK INFO */}
            <div className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl mb-4 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-grow pr-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-0.5">
                    {audioPlaybackType === 'youtube' && activeTrack ? "Now Queued · Real Track" : "Matching Song Vibe"}
                  </span>
                  <h3 className="text-base font-bold text-white truncate">
                    {audioPlaybackType === 'youtube' && activeTrack
                      ? activeTrack.title
                      : activeMood ? activeMood.songRecommendation.title : `Procedural ${manualMood} Symphony`}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium truncate mb-2">
                    by {audioPlaybackType === 'youtube' && activeTrack
                      ? activeTrack.artist
                      : activeMood ? activeMood.songRecommendation.artist : "AI Synth Engine"}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {audioPlaybackType === 'youtube' && activeTrack ? (
                      <>
                        <span className="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono rounded">
                          {activeTrack.mood}
                        </span>
                        {activeTrack.duration && (
                          <span className="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono rounded">
                            {activeTrack.duration}
                          </span>
                        )}
                        {activeTrack.views && (
                          <span className="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono rounded">
                            {activeTrack.views}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono rounded">
                          {activeMood ? activeMood.songRecommendation.genre : "Ambient Soundscape"}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono rounded">
                          {activeMood ? `${activeMood.songRecommendation.tempo} BPM` : "80 BPM"}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 shrink-0">
                  {/* Big play button */}
                  <button
                    id="synth_audio_toggle"
                    onClick={toggleSynthPlayback}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-950 hover:scale-[1.05] active:scale-[0.95] transition-all cursor-pointer shadow-lg"
                    style={{
                      backgroundColor: glowHex,
                      boxShadow: `0 4px 15px ${glowHex}40`,
                    }}
                    title={isPlayingSynth ? "Stop" : "Play"}
                  >
                    {isPlayingSynth ? (
                      <Square className="w-5 h-5 text-slate-950 fill-slate-950" />
                    ) : (
                      <Play className="w-5 h-5 text-slate-950 fill-slate-950 ml-0.5" />
                    )}
                  </button>

                  {/* Next real track in this mood */}
                  {audioPlaybackType === 'youtube' && activeTrack && (
                    <button
                      onClick={() => {
                        const mood = activeMood ? activeMood.mood : manualMood;
                        const next = pickRealTrack(mood, activeTrack.videoId);
                        if (next) {
                          setActiveTrack(next);
                          setActiveYoutubeUrl(next.youtubeUrl);
                          setActiveYoutubeSearch(`${next.artist} - ${next.title}`);
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-[9px] font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
                      title="Skip to another track in this mood"
                    >
                      NEXT ▸
                    </button>
                  )}
                </div>
              </div>

              {/* Audio plays via the hidden persistent YT player mounted once
                  near the root (search for id="yt-audio-player"). No visible
                  video by design — that's reserved for the future Tribe
                  EEG-scan feature. */}

              {audioPlaybackType === 'synth' && activeMood && (
                <p className="text-[11px] text-slate-400 leading-relaxed mt-3 pt-3 border-t border-slate-800/60">
                  {activeMood.songRecommendation.description}
                </p>
              )}
            </div>

            {/* SYNTH CONTROLS: VOLUME & MANUAL PARAMETERS */}
            <div className="space-y-3.5 border-t border-slate-800/60 pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Output Volume
                </span>
                <span className="font-mono text-slate-300">{isMuted ? "MUTED" : `${Math.round(volume * 100)}%`}</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  id="mute_toggle_btn"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 border border-slate-800 hover:border-slate-700 bg-slate-900/60 rounded-xl text-slate-300 hover:text-white transition-all shrink-0"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-slate-300" />}
                </button>
                <input
                  id="volume_slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="flex-grow accent-emerald-500 bg-slate-950 border border-slate-800 rounded-lg h-2 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* DYNAMIC ATMOSPHERE TUNER & GRADIENT WHEEL */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 backdrop-blur-xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Acoustic Color Wheel</h3>
              </div>
              <button
                onClick={() => setIsAutoCycling(!isAutoCycling)}
                className={`px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                  isAutoCycling
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                }`}
              >
                {isAutoCycling ? "● AUTO CYCLING" : "MANUAL WHEEL"}
              </button>
            </div>

            <div className="my-3 flex justify-center">
              <GradientPicker
                pointerValue={pointer}
                shiftValue={shift}
                ratioValue={ratio}
                onPointerChange={handlePointerChange}
                onShiftChange={setShift}
                onRatioChange={setRatio}
                colorInner={colorInner}
                colorOuter={colorOuter}
                isInteractive={true}
              />
            </div>

            {/* Wheel Sliders (Shift and Ratio, from Codepen) */}
            <div className="w-full space-y-3.5 mt-2 pt-3 border-t border-slate-800/60">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Inner Ring Shift (Wheel Rotation)</span>
                  <span style={{ color: colorOuter }}>{shift.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min="-0.5"
                  max="0.5"
                  step="0.005"
                  value={shift}
                  onChange={(e) => setShift(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 bg-slate-950 border border-slate-800 rounded-lg h-1.5 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Glow Density (Light Dispersion)</span>
                  <span style={{ color: colorInner }}>{ratio.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.005"
                  value={ratio}
                  onChange={(e) => setRatio(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 bg-slate-950 border border-slate-800 rounded-lg h-1.5 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* INTERACTIVE PRESETS: FORCE AMBIENT MOOD LIGHT & SONG */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 backdrop-blur-xl">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Force Mood Light & Synth presets</h3>
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
              {Object.keys(MOOD_THEMES).map((moodName) => {
                const theme = MOOD_THEMES[moodName];
                const isActive = (activeMood?.mood || manualMood) === moodName;
                return (
                  <button
                    key={moodName}
                    id={`preset_mood_btn_${moodName}`}
                    onClick={() => setPresetMood(moodName)}
                    className="flex flex-col items-center p-2 rounded-xl border transition-all text-center relative hover:bg-slate-900/80 cursor-pointer"
                    style={{
                      borderColor: isActive ? theme.color : "rgba(30, 41, 59, 0.4)",
                      backgroundColor: isActive ? `${theme.color}15` : "rgba(15, 23, 42, 0.3)",
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full mb-1.5 shadow"
                      style={{ backgroundColor: theme.color }}
                    />
                    <span className="text-[10px] font-mono font-medium block truncate w-full text-slate-200">
                      {moodName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MOOD HISTORY PANEL */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 backdrop-blur-xl flex-grow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Biometric Scan History</h3>
              </div>
              {history.length > 0 && (
                <button
                  id="clear_history_btn"
                  onClick={clearHistory}
                  className="text-[10px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:underline transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Logs
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {history.length > 0 ? (
                history.map((item) => {
                  const theme = MOOD_THEMES[item.result.mood] || MOOD_THEMES.Neutral;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveMood(item.result);
                        setManualMood(item.result.mood);
                      }}
                      className="p-2.5 bg-slate-950/60 border border-slate-800/60 rounded-xl flex items-center justify-between text-xs hover:border-slate-700 hover:bg-slate-950 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Compact Mood Light Indicator */}
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{
                            backgroundColor: item.result.lightColor,
                            boxShadow: `0 0 8px ${item.result.lightColor}`,
                          }}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-200 truncate flex items-center gap-1.5">
                            {item.result.mood}
                            <span className="text-[10px] font-normal text-slate-500">({item.result.confidence}% config)</span>
                          </p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                            {item.result.songRecommendation.title}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-slate-500">{item.timestamp}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-slate-600 text-xs">
                  No previous scans recorded. Capture your first mood to initialize telemetry.
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* SONG CALIBRATION DETAIL POPOUT */}
      {detailSong && (
        <SongDetailModal
          song={detailSong}
          onClose={() => setDetailSong(null)}
          onPlay={(song) => playSongFromLibrary(song)}
        />
      )}

      {/* DETAILED INFO / DOCUMENTATION MODAL */}
      {showInfoModal && (
        <div id="info_modal_overlay" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-xl w-full rounded-2xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Smile className="text-emerald-400" />
              Biometric Mood Engine
            </h2>
            <p className="text-xs text-slate-400 mb-4 font-mono leading-relaxed">
              Technical Documentation & Facial Tracking Framework
            </p>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <h3 className="font-semibold text-white mb-1.5 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  Privacy & Data Handling
                </h3>
                <p>
                  No image metadata or streams are stored or uploaded permanently. When you initiate a scan, a snapshot is captured strictly and analyzed server-side via the secure Gemini API integration. The image data is handled ephemerally and is never shared or stored.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-2 uppercase tracking-wide text-[10px] font-mono">
                  Biometric Face Mapping Rules
                </h3>
                <ul className="space-y-2.5">
                  <li className="flex gap-2">
                    <span className="text-emerald-400 shrink-0 font-mono">■</span>
                    <div>
                      <strong className="text-slate-100">Eyes & Eyelid Tension:</strong> Squinting and heavy lids generally represent anxiety, fatigue, sadness or intense anger. Wide eyes map to surprise, excitement, or pure joy.
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-400 shrink-0 font-mono">■</span>
                    <div>
                      <strong className="text-slate-100">Eyebrow & Forehead Contours:</strong> Tilted upward brows imply sadness. Furrowed or knit eyebrows signal irritation, extreme focus, or anger. Smooth lines correlate with calm or neutral states.
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-400 shrink-0 font-mono">■</span>
                    <div>
                      <strong className="text-slate-100">Mouth Curvature & Jaw Tension:</strong> Raised corners signify happiness. Compressed horizontal lips suggest focus or neutrality. Drooping outer lips identify grief or heavy sadness.
                    </div>
                  </li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <h3 className="font-semibold text-white mb-1.5 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-emerald-400" />
                  Procedural Music Synthesis
                </h3>
                <p>
                  Our built-in sound engine runs directly on your browser's Web Audio API context. Instead of streaming audio files, it builds customizable waves, filters, LFO frequency modulators, and gain nodes to model active acoustic streams corresponding to your mood parameters.
                </p>
              </div>
            </div>

            <button
              id="close_info_modal"
              onClick={() => setShowInfoModal(false)}
              className="mt-6 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close Documentation
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer id="app_footer" className="relative z-10 py-4 px-4 border-t border-slate-800/40 text-center bg-slate-950/60 backdrop-blur-sm">
        <p className="text-[10px] font-mono text-slate-500">
          Powered by Gemini 3.5 Flash & Procedural Web Audio Synths • Secure & Encrypted Client-to-Server Streams
        </p>
      </footer>
    </div>
  );
}
