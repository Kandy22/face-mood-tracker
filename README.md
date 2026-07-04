# Atmospheric Music & Biometric Mood Projector

Welcome to the **Atmospheric Music & Biometric Mood Projector**! This web application combines real-time computer vision (facial emotion detection via Gemini Vision) with a custom dual-ring procedural gradient generator (inspired by the classic Codepen Color Wheel) to create a reactive, glowing light canvas that shifts with your vibes as you DJ or run interviews.

---

## 🎨 Key Features

1. **Dual-Ring Chromatic Wheel (`GradientPicker`)**
   - Implements the exact chromatic rotation mechanics from the CodePen project.
   - Rotates an inner and outer SVG gradient ring using a circular tracking controller.
   - Computes complementary and contrasting values in real time to color the environment's glowing background.

2. **Facial Emotion Telemetry (Biometrics)**
   - Activates your device's webcam to scan and track micro-expressions.
   - Sends facial snapshots to a secure, server-side Gemini 2.5 Flash model.
   - Computes confidence scores for seven human emotions: **Happy, Sad, Angry, Calm, Excited, Anxious, and Neutral**.

3. **Procedural Mood Synth Engine (`MoodSynthEngine`)**
   - Synthesizes dynamic, multi-layered audio landscapes matching the detected atmosphere.
   - Employs Web Audio API oscillators, filters, and Gain nodes to craft custom chords, dynamic LFO speeds, and custom procedural waveforms without needing external audio files.

4. **Dedicated DJ Glow Mode**
   - A distraction-free, immersive full-screen display designed for live projection.
   - Houses a circular camera monitoring feed directly inside the core of the radial picker wheel, turning the console into a true artistic hologram.
   - Integrates rapid-select mood theme buttons to instantly bypass the camera and force specific gradients.

---

## 🎛️ How to Control the Atmosphere

- **Start / Stop Camera Buttons**: Highly visible, color-coded buttons located both in the main Console View and the DJ Glow Mode to boot or shut down hardware video feeds instantly.
- **Trigger Facial Mood Scan**: Takes a frame of your face to instantly calculate the biometric state and shift the entire room's glow.
- **Manual Wheel Drag**: Click and drag the glowing circular cursor around the radial gradient wheel to manually alter the color frequencies.
- **Inner Ring Shift Slider**: Dynamically adjusts the offset (`shift`) between the inner and outer spectrum.
- **Glow Density Slider**: Adjusts the dispersion (`ratio`) and brightness of the central radial glow.
- **Auto-Cycling Toggle**: Turn on `Play` (Auto Cycling) to let the color rings continuously slide, creating a rotating kaleidoscope pattern.

---

## 🧠 Future Integrations (Tribe2 Brain Waves & Shazam)

As requested, here is how the architecture is designed to expand into advanced audio analysis and biometric brainwave telemetry in subsequent development cycles:

### 1. 🎵 Shazam Audio Identification (Real-time DJ Track Monitoring)
To identify the music you are currently spinning and use its tempo (BPM) or acoustic fingerprint to synchronize the glow:
- **Audio Loopback API / Web Audio Stream**: Capture the device's system output (or microphone audio) and pipe it through a server-side proxy route.
- **Acoustic Fingerprinting**: Integrate a cloud lookup service (such as the official **Shazam API** via RapidAPI or Apple's **ShaudioKit**) to analyze spectrogram chunks.
- **Acoustic Syncing**: Retrieve song attributes (genre, energy, BPM) and automatically map them to the inner ring shift value, matching the music's cadence in real-time.

### 2. ⚡ Tribe2 EEG Brain Wave Telemetry (Neuro-Reactive Lights)
To move from facial expressions to direct neuro-feedback:
- **Web Bluetooth API**: Standard modern web browsers can connect directly to Bluetooth EEG Headsets (such as Muse, Emotiv, or openBCI) using browser-based serial interfaces.
- **Alpha, Beta, Theta Signal Mapping**:
  - **Alpha Waves (8-12 Hz - Relaxation)**: Higher Alpha values will automatically increase the `Glow Density (Ratio)` and steer colors towards soft, cool blues and emeralds (`Calm`).
  - **Beta Waves (12-30 Hz - Active Focus/Thinking)**: Higher Beta values speed up the `Auto-Cycling` speed and shift the spectrum towards high-frequency purples and magentas (`Anxious` or `Excited`).
  - **Theta Waves (4-8 Hz - Flow State/Deep Focus)**: Higher Theta values lock the spectrum into deep indigo tones with low dispersion for minimal distractions during deep mixing.
