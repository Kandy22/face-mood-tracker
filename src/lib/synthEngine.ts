// High-Fidelity Procedural Synth Engine using Web Audio API
// Generates infinite ambient music loops matching the active mood, bypassing CORS and load-time latency.

export class MoodSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private activeNodes: AudioNode[] = [];
  private schedulerTimer: number | null = null;
  private currentMood: string = "Neutral";
  private volume: number = 0.5;
  private isPlaying: boolean = false;
  private currentBpm: number = 80;

  constructor() {
    // AudioContext will be initialized on user gesture to comply with browser autoplay policies
  }

  private initContext() {
    if (!this.ctx) {
      // Support standard and prefixed AudioContext
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
    }
  }

  public setTempo(bpm: number) {
    this.currentBpm = Math.max(40, Math.min(200, bpm));
  }

  public play(mood: string, bpm: number = 80) {
    this.initContext();
    if (!this.ctx) return;

    this.stop();
    this.isPlaying = true;
    this.currentMood = mood;
    this.currentBpm = bpm;

    // Run the specific synthesizer profile based on mood
    this.startSynthProfile(mood);
  }

  public stop() {
    this.isPlaying = false;
    
    // Stop and clear all active synthesizers
    if (this.schedulerTimer) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    this.activeNodes.forEach((node) => {
      try {
        (node as any).stop?.();
      } catch (e) {
        // Already stopped or not a source node
      }
      try {
        node.disconnect();
      } catch (e) {
        // Already disconnected
      }
    });
    this.activeNodes = [];
  }

  private startSynthProfile(mood: string) {
    const ctx = this.ctx!;
    const analyser = this.analyser!;

    switch (mood) {
      case "Calm":
        this.playCalmProfile(ctx, analyser);
        break;
      case "Happy":
        this.playHappyProfile(ctx, analyser);
        break;
      case "Sad":
        this.playSadProfile(ctx, analyser);
        break;
      case "Angry":
        this.playAngryProfile(ctx, analyser);
        break;
      case "Excited":
        this.playExcitedProfile(ctx, analyser);
        break;
      case "Anxious":
        this.playAnxiousProfile(ctx, analyser);
        break;
      case "Neutral":
      default:
        this.playNeutralProfile(ctx, analyser);
        break;
    }
  }

  // --- 1. CALM PROFILE ---
  // Soft, warm sweeping low-pass filtered pads and gentle wind-chime chimes
  private playCalmProfile(ctx: AudioContext, destination: AudioNode) {
    // Lush low-pass filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(350, ctx.currentTime);
    filter.Q.setValueAtTime(1.5, ctx.currentTime);
    filter.connect(destination);
    this.activeNodes.push(filter);

    // Filter LFO to make it sweep slowly
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.08, ctx.currentTime); // very slow sweep
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(150, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.activeNodes.push(lfo);
    this.activeNodes.push(lfoGain);

    // Warm chords: E major 9th drone (E, B, F#, G#)
    const baseFreqs = [82.41, 123.47, 185.00, 207.65];
    baseFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.08, ctx.currentTime);

      // Add soft volume breathing (tremolo)
      const tremolo = ctx.createOscillator();
      tremolo.type = "sine";
      tremolo.frequency.setValueAtTime(0.1 + Math.random() * 0.05, ctx.currentTime);
      const tremoloGain = ctx.createGain();
      tremoloGain.gain.setValueAtTime(0.02, ctx.currentTime);
      tremolo.connect(tremoloGain);
      tremoloGain.connect(oscGain.gain);
      tremolo.start();
      this.activeNodes.push(tremolo);
      this.activeNodes.push(tremoloGain);

      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      
      this.activeNodes.push(osc);
      this.activeNodes.push(oscGain);
    });

    // Slow atmospheric chimes schedule
    const scheduleNextChime = () => {
      if (!this.isPlaying || this.currentMood !== "Calm") return;
      
      const frequencies = [329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99]; // Pentatonic scale
      const randomFreq = frequencies[Math.floor(Math.random() * frequencies.length)];

      const chimeOsc = ctx.createOscillator();
      chimeOsc.type = "sine";
      chimeOsc.frequency.setValueAtTime(randomFreq, ctx.currentTime);

      const chimeGain = ctx.createGain();
      chimeGain.gain.setValueAtTime(0.0, ctx.currentTime);
      chimeGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.1);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.5);

      const delay = ctx.createDelay();
      delay.delayTime.setValueAtTime(0.4, ctx.currentTime);
      const delayGain = ctx.createGain();
      delayGain.gain.setValueAtTime(0.4, ctx.currentTime);

      chimeOsc.connect(chimeGain);
      chimeGain.connect(destination);

      // Add feedback delay for spacey chime echoes
      chimeGain.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(delay);
      delayGain.connect(destination);

      chimeOsc.start();
      chimeOsc.stop(ctx.currentTime + 4.0);

      const nextInterval = 2000 + Math.random() * 3000;
      this.schedulerTimer = window.setTimeout(scheduleNextChime, nextInterval);
    };

    scheduleNextChime();
  }

  // --- 2. HAPPY PROFILE ---
  // Cheerful major chord progressions (Cmaj7 - Fmaj7) and bouncy pentatonic melodies
  private playHappyProfile(ctx: AudioContext, destination: AudioNode) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.connect(destination);
    this.activeNodes.push(filter);

    // Soft warm drone (C major)
    const baseFreqs = [130.81, 164.81, 196.00, 246.94]; // C, E, G, B
    baseFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.04, ctx.currentTime);

      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();

      this.activeNodes.push(osc);
      this.activeNodes.push(oscGain);
    });

    // Bouncy rhythm arpeggiator
    const happyMelody = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // Pentatonic C
    let step = 0;

    const intervalMs = (60 / this.currentBpm) * 1000 * 0.5; // Eighth notes
    const triggerStep = () => {
      if (!this.isPlaying || this.currentMood !== "Happy") return;

      const time = ctx.currentTime;
      // Define a simple cheerful chord progression arpeggio
      const noteFreq = happyMelody[(step * 3 + (step % 4)) % happyMelody.length];

      // Play soft pluck note
      const pluck = ctx.createOscillator();
      pluck.type = "triangle";
      pluck.frequency.setValueAtTime(noteFreq, time);

      const pluckGain = ctx.createGain();
      pluckGain.gain.setValueAtTime(0.0, time);
      pluckGain.gain.linearRampToValueAtTime(0.08, time + 0.02);
      pluckGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);

      pluck.connect(pluckGain);
      pluckGain.connect(filter);
      pluck.start(time);
      pluck.stop(time + 0.4);

      // Play occasional high sparkling chime
      if (step % 8 === 0) {
        const chime = ctx.createOscillator();
        chime.type = "sine";
        chime.frequency.setValueAtTime(noteFreq * 2, time);
        const chimeGain = ctx.createGain();
        chimeGain.gain.setValueAtTime(0, time);
        chimeGain.gain.linearRampToValueAtTime(0.03, time + 0.05);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);

        chime.connect(chimeGain);
        chimeGain.connect(destination);
        chime.start(time);
        chime.stop(time + 1.5);
      }

      step++;
      this.schedulerTimer = window.setTimeout(triggerStep, intervalMs);
    };

    triggerStep();
  }

  // --- 3. SAD PROFILE ---
  // Somber, dark drifting minor drone with weeping, sparse piano-like notes
  private playSadProfile(ctx: AudioContext, destination: AudioNode) {
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(280, ctx.currentTime);
    lowpass.connect(destination);
    this.activeNodes.push(lowpass);

    // Deep heavy drone: A minor 7th (A, C, E, G)
    const baseFreqs = [55.00, 110.00, 130.81, 146.83, 196.00];
    baseFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.09, ctx.currentTime);

      // Slow drift
      const modulator = ctx.createOscillator();
      modulator.type = "sine";
      modulator.frequency.setValueAtTime(0.05 + Math.random() * 0.05, ctx.currentTime);
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(0.03, ctx.currentTime);
      
      modulator.connect(modGain);
      modGain.connect(gain.gain);
      modulator.start();

      this.activeNodes.push(modulator);
      this.activeNodes.push(modGain);

      osc.connect(gain);
      gain.connect(lowpass);
      osc.start();

      this.activeNodes.push(osc);
      this.activeNodes.push(gain);
    });

    // Sparse, melancholic crying piano notes
    const sadNotes = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00]; // A Minor Pentatonic
    
    const playSadNote = () => {
      if (!this.isPlaying || this.currentMood !== "Sad") return;

      const note = sadNotes[Math.floor(Math.random() * sadNotes.length)];
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note, now);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.05, now + 0.1); // Slow attack
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0); // Very long decay

      const delay = ctx.createDelay();
      delay.delayTime.setValueAtTime(0.6, now);
      const delayGain = ctx.createGain();
      delayGain.gain.setValueAtTime(0.3, now);

      osc.connect(oscGain);
      oscGain.connect(destination);

      oscGain.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(delay);
      delayGain.connect(destination);

      osc.start(now);
      osc.stop(now + 3.5);

      const nextInterval = 3000 + Math.random() * 4000; // Sparse and unpredictable
      this.schedulerTimer = window.setTimeout(playSadNote, nextInterval);
    };

    playSadNote();
  }

  // --- 4. ANGRY PROFILE ---
  // Aggressive, tense sawtooth basslines, rapid thudding beat, and discordant detuned sirens
  private playAngryProfile(ctx: AudioContext, destination: AudioNode) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, ctx.currentTime);
    filter.connect(destination);
    this.activeNodes.push(filter);

    // Deep detuned aggressive saw bass (D minor/discordant tritones)
    const subOsc = ctx.createOscillator();
    subOsc.type = "sawtooth";
    subOsc.frequency.setValueAtTime(73.42, ctx.currentTime); // D2
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.08, ctx.currentTime);
    subOsc.connect(subGain);
    subGain.connect(filter);
    subOsc.start();
    this.activeNodes.push(subOsc);
    this.activeNodes.push(subGain);

    const subOsc2 = ctx.createOscillator();
    subOsc2.type = "sawtooth";
    subOsc2.frequency.setValueAtTime(73.90, ctx.currentTime); // Slightly detuned (discordant tension)
    const subGain2 = ctx.createGain();
    subGain2.gain.setValueAtTime(0.08, ctx.currentTime);
    subOsc2.connect(subGain2);
    subGain2.connect(filter);
    subOsc2.start();
    this.activeNodes.push(subOsc2);
    this.activeNodes.push(subGain2);

    // Rapid thudding heartbeat drum generator
    const playHeartbeat = () => {
      if (!this.isPlaying || this.currentMood !== "Angry") return;

      const now = ctx.currentTime;

      // Heavy bass kick drum
      const kickOsc = ctx.createOscillator();
      kickOsc.type = "sine";
      kickOsc.frequency.setValueAtTime(150, now);
      kickOsc.frequency.exponentialRampToValueAtTime(0.01, now + 0.15);

      const kickGain = ctx.createGain();
      kickGain.gain.setValueAtTime(0.3, now);
      kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      kickOsc.connect(kickGain);
      kickGain.connect(destination);
      kickOsc.start(now);
      kickOsc.stop(now + 0.2);

      // Discordant metallic ring
      if (Math.random() > 0.6) {
        const metalOsc = ctx.createOscillator();
        metalOsc.type = "sawtooth";
        metalOsc.frequency.setValueAtTime(220 + Math.random() * 400, now);
        const metalGain = ctx.createGain();
        metalGain.gain.setValueAtTime(0.02, now);
        metalGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        metalOsc.connect(metalGain);
        metalGain.connect(destination);
        metalOsc.start(now);
        metalOsc.stop(now + 0.25);
      }

      // Fast tense timing: 130 BPM quarter notes
      const intervalMs = (60 / 130) * 1000 * 0.5;
      this.schedulerTimer = window.setTimeout(playHeartbeat, intervalMs);
    };

    playHeartbeat();
  }

  // --- 5. EXCITED PROFILE ---
  // Energetic 16th-note climbing arpeggios, pulsing beats, and high energetic sweeps
  private playExcitedProfile(ctx: AudioContext, destination: AudioNode) {
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.Q.setValueAtTime(1.0, ctx.currentTime);
    filter.connect(destination);
    this.activeNodes.push(filter);

    // Modulating sweeping filter LFO
    const sweepLfo = ctx.createOscillator();
    sweepLfo.type = "sine";
    sweepLfo.frequency.setValueAtTime(0.4, ctx.currentTime);
    const sweepGain = ctx.createGain();
    sweepGain.gain.setValueAtTime(500, ctx.currentTime);
    sweepLfo.connect(sweepGain);
    sweepGain.connect(filter.frequency);
    sweepLfo.start();
    this.activeNodes.push(sweepLfo);
    this.activeNodes.push(sweepGain);

    const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]; // C Major scale
    let step = 0;

    const triggerArpeggiator = () => {
      if (!this.isPlaying || this.currentMood !== "Excited") return;

      const now = ctx.currentTime;
      // Arpeggiate up and down rapidly
      const noteIndex = step % 8;
      const freq = scale[noteIndex];

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(filter);
      
      // Also send some direct bright signal to bypass bandpass
      const directGain = ctx.createGain();
      directGain.gain.setValueAtTime(0.015, now);
      directGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      osc.connect(directGain);
      directGain.connect(destination);

      osc.start(now);
      osc.stop(now + 0.15);

      // Play pulsing heartbeat kick drum
      if (step % 4 === 0) {
        const kick = ctx.createOscillator();
        kick.type = "sine";
        kick.frequency.setValueAtTime(110, now);
        kick.frequency.exponentialRampToValueAtTime(45, now + 0.1);
        const kickGain = ctx.createGain();
        kickGain.gain.setValueAtTime(0.2, now);
        kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        kick.connect(kickGain);
        kickGain.connect(destination);
        kick.start(now);
        kick.stop(now + 0.15);
      }

      step++;
      const intervalMs = (60 / 128) * 1000 * 0.25; // 16th notes at 128 BPM
      this.schedulerTimer = window.setTimeout(triggerArpeggiator, intervalMs);
    };

    triggerArpeggiator();
  }

  // --- 6. ANXIOUS PROFILE ---
  // High-frequency detuned vibrating oscillators, tense rapid ticks, and unstable FM warbles
  private playAnxiousProfile(ctx: AudioContext, destination: AudioNode) {
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1500, ctx.currentTime);
    filter.Q.setValueAtTime(2.0, ctx.currentTime);
    filter.connect(destination);
    this.activeNodes.push(filter);

    // Unstable vibrating drone (frequency modulation)
    const carrier = ctx.createOscillator();
    carrier.type = "sawtooth";
    carrier.frequency.setValueAtTime(320, ctx.currentTime);

    const modulator = ctx.createOscillator();
    modulator.type = "sine";
    modulator.frequency.setValueAtTime(8.5, ctx.currentTime); // Fast anxious wobble
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(25, ctx.currentTime); // mod depth

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    const carrierGain = ctx.createGain();
    carrierGain.gain.setValueAtTime(0.04, ctx.currentTime);

    carrier.connect(carrierGain);
    carrierGain.connect(destination);

    carrier.start();
    modulator.start();

    this.activeNodes.push(carrier);
    this.activeNodes.push(modulator);
    this.activeNodes.push(modGain);
    this.activeNodes.push(carrierGain);

    // Fast, mechanical, unpredictable ticking sound
    const playTick = () => {
      if (!this.isPlaying || this.currentMood !== "Anxious") return;

      const now = ctx.currentTime;
      const tick = ctx.createOscillator();
      tick.type = "sine";
      tick.frequency.setValueAtTime(2000 + Math.random() * 3000, now); // extreme high tension

      const tickGain = ctx.createGain();
      tickGain.gain.setValueAtTime(0.0, now);
      tickGain.gain.linearRampToValueAtTime(0.03, now + 0.005);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      tick.connect(tickGain);
      tickGain.connect(destination);
      tick.start(now);
      tick.stop(now + 0.06);

      // Unstable random interval to build suspense (100ms - 250ms)
      const nextInterval = 100 + Math.random() * 150;
      this.schedulerTimer = window.setTimeout(playTick, nextInterval);
    };

    playTick();
  }

  // --- 7. NEUTRAL PROFILE ---
  // Warm, steady, resting heartbeat-like pulse and balanced, gentle keyboard notes (fifth intervals)
  private playNeutralProfile(ctx: AudioContext, destination: AudioNode) {
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(300, ctx.currentTime);
    lowpass.connect(destination);
    this.activeNodes.push(lowpass);

    // Balanced hum: C major drone (130.81Hz and 196Hz - perfect fifth)
    const baseFreqs = [130.81, 196.00];
    baseFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.07, ctx.currentTime);

      osc.connect(oscGain);
      oscGain.connect(lowpass);
      osc.start();

      this.activeNodes.push(osc);
      this.activeNodes.push(oscGain);
    });

    // Steady rhythmic breathing notes
    const triggerBreath = () => {
      if (!this.isPlaying || this.currentMood !== "Neutral") return;

      const now = ctx.currentTime;
      // Soft, warm sinus note - F and G alternating (stable, neutral harmony)
      const breathNotes = [349.23, 392.00];
      const freq = breathNotes[Math.floor(now / 3) % breathNotes.length];

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0, now);
      // Slow, relaxing inhale (attack) and exhale (decay)
      oscGain.gain.linearRampToValueAtTime(0.035, now + 1.2);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      osc.connect(oscGain);
      oscGain.connect(destination);
      osc.start(now);
      osc.stop(now + 3.2);

      this.schedulerTimer = window.setTimeout(triggerBreath, 3000); // Steady 3s breath loop
    };

    triggerBreath();
  }
}
