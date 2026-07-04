# Development Session Log: Atmospheric Music & Biometric Mood Projector
Created: July 4, 2026

This log contains the complete summary of the architectural changes, component migrations, and future integration guidelines implemented during this session so you can review what you missed.

---

## 📅 Session Summary & Milestones

During this session, we successfully took a classic **experimental radial gradient CodePen** and engineered it into a fully-functional, responsive full-stack React + Vite application. It acts as an ambient projection booth for live DJs or interviewers.

### 1. CodePen Component Migration
- **Wheel Math & SVGs (`GradientPicker.tsx`)**: Migrated the Vue-based multi-path SVG gradient rings into a single highly optimized React component.
- **Dynamic CSS Transitions**: Configured CSS variable variables (`--colorInner`, `--colorOuter`) to dynamically set deep background colors with hardware-accelerated smooth transitions.
- **Manual Adjustments**: Preserved the interactive drag mechanics so you can grab the circular tab pointer and slide it to manually blend outer/inner frequencies.

### 2. Immersive DJ Glow Mode
- **Dual Views**: Added a toggle between the core **Console View** (with analytical telemetry tables and control dashboards) and a full-screen **DJ Glow Mode**.
- **Visual Cam Hole**: Embedded the webcam video feed in a perfectly circular masked mask in the exact center of the color wheel.
- **Responsive Sizing**: Styled the immersive mode using deep, light-dispersive backdrops (`backdrop-blur`) and blurred color gradients to project a brilliant, glowing aura on screens or walls.

### 3. Start & Stop Hardware Buttons
- **High Visibility**: Created bold, color-coded buttons (`emerald-500` for START, `red-500` for STOP) to instantly initialize or terminate the video hardware stream.
- **Placement**: Put these buttons clearly in both the default Console View and the immersive DJ Glow Mode so you always have immediate physical command of your inputs.

---

## 🔮 Future Integration Blueprints

### 🎵 Shazam Real-time Audio Identification
To let the environment automatically detect the music being played nearby and sync its pace and hues:
1. **Audio Capture**: Utilizes the browser's `navigator.mediaDevices.getUserMedia({ audio: true })` API to listen to microphone ambient noise or direct loopback audio.
2. **Audio Analyzer Endpoint**: Periodically posts 4-second audio chunk arrays to a server-side route `/api/shazam-lookup`.
3. **Spectrogram Matching**: The server proxies the raw audio bytes to a Shazam identification service (like Apple's **ShazamKit** or third-party RapidAPI services).
4. **Metadata Extraction**: Returns the song title, artist, genres, and BPM. The BPM instantly matches the `Auto-Cycling` speed, while the genre changes the `Glow Density (Ratio)`.

### ⚡ Tribe2 EEG Brainwave Integration
To step up the biometrics by mapping direct neuro-feedback (EEG):
1. **Web Bluetooth Connection**: Uses standard browser Bluetooth (`navigator.bluetooth.requestDevice`) to connect directly to EEG bands (Muse, OpenBCI, etc.).
2. **Frequency Bands Partitioning**:
   - **Alpha Waves (8-12 Hz - High Relaxation)**: Automatically shifts the spectrum to gentle, glowing greens and blues (`Calm`), widening the dispersion.
   - **Beta Waves (12-30 Hz - Active Thinking/Focus)**: Increases rotation speeds, shifting hues to high-voltage magenta and cyan (`Excited`/`Anxious`).
   - **Theta Waves (4-8 Hz - Flow States / Trance)**: Locks the backdrop into dark violet and deep indigos with a static, concentrated center point to eliminate peripheral distraction.

---

## 🛠️ Bug Fixes & Error Resolutions

In our latest cleanup, we resolved critical runtime issues in the application:

### 1. Unified Programmatic Video Control
- **Issue**: `Video play failed` and `Video re-play failed` due to overlapping, competing `.play()` requests and `srcObject` resets.
- **Resolution**:
  - We consolidated all stream binding and playback controls under a single, centralized `useEffect` listener.
  - Added a state-guard `if (videoRef.current.srcObject !== stream)` before re-assigning streams. This prevents interrupting active video playbacks with a redundant reload when toggling between Console View and DJ Glow Mode.
  - Eliminated the browser-level `autoPlay` attribute which competed with programmatic plays.
  - Implemented graceful error catching to ignore harmless `AbortError` triggers that occur naturally during instant UI switching.

### 2. Verified Fetch API Integrity
- **Issue**: Confirmed that `TypeError: Cannot set property fetch` was completely prevented.
- **Resolution**: Conducted a thorough check of the global workspace. Verified that no files overwrite or conflict with `window.fetch`, securing the core communication channel with the server-side facial recognition API.

