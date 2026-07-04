import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  lightColor: string;
  mood: string;
}

export default function AudioVisualizer({
  analyser,
  isPlaying,
  lightColor,
  mood,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle resizing fluidly
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(canvas);

    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Request next frame immediately to maintain smooth 60fps
      animationRef.current = requestAnimationFrame(draw);

      // Get audio data
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Synthesize fake idle breathing waves when not playing
        const now = Date.now() / 1000;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = (Math.sin(i * 0.15 + now * 2.5) + 1) * 15 * (1 - Math.abs(i - bufferLength / 2) / (bufferLength / 2));
        }
      }

      // Clear with dark fading background for a gorgeous neon trail effect
      ctx.fillStyle = "rgba(10, 10, 12, 0.18)";
      ctx.fillRect(0, 0, width, height);

      // Set up mood-based parameters
      const pulseColor = lightColor || "#10B981";
      ctx.lineWidth = 2.5;

      // Draw different visualization patterns depending on the mood
      if (mood === "Angry") {
        // Gritty, sharp jagged vertical frequency bars
        ctx.strokeStyle = pulseColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = pulseColor;

        const barWidth = width / bufferLength;
        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const barHeight = percent * height * 0.8;

          const x = i * barWidth;
          const y = height / 2;

          ctx.moveTo(x, y - barHeight / 2);
          ctx.lineTo(x, y + barHeight / 2);
        }
        ctx.stroke();
      } else if (mood === "Calm" || mood === "Neutral") {
        // Smooth, elegant flowing sine waves with multiple layers
        ctx.shadowBlur = 12;
        ctx.shadowColor = pulseColor;

        for (let wave = 0; wave < 3; wave++) {
          ctx.strokeStyle = wave === 0 ? pulseColor : `${pulseColor}66`;
          ctx.lineWidth = wave === 0 ? 3 : 1.5;
          ctx.beginPath();

          const offset = wave * Math.PI * 0.35;
          const speedMultiplier = 1 - wave * 0.2;

          for (let i = 0; i < width; i++) {
            const index = Math.floor((i / width) * bufferLength);
            const value = dataArray[index] || 0;
            const amp = (value / 255) * (height * 0.45) + (wave === 0 ? 4 : 2);
            
            const cycle = (i / width) * Math.PI * 4 + (Date.now() / 400) * speedMultiplier + offset;
            const y = height / 2 + Math.sin(cycle) * amp;

            if (i === 0) {
              ctx.moveTo(i, y);
            } else {
              ctx.lineTo(i, y);
            }
          }
          ctx.stroke();
        }
      } else if (mood === "Excited" || mood === "Happy") {
        // High energetic circular audio ripples
        ctx.shadowBlur = 15;
        ctx.shadowColor = pulseColor;
        ctx.strokeStyle = pulseColor;

        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.25;

        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const offsetRadius = percent * 40;

          const angle = (i / bufferLength) * Math.PI * 2 + (Date.now() / 800);
          const r = baseRadius + offsetRadius;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();

        // Small inner pulsing core
        const corePercent = (dataArray[2] || 10) / 255;
        ctx.fillStyle = `${pulseColor}33`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.8 + corePercent * 15, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Anxious or Sad: Spatially vibrating grid/waveform lines
        ctx.strokeStyle = pulseColor;
        ctx.shadowBlur = 6;
        ctx.shadowColor = pulseColor;

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const displacement = percent * height * 0.4 * (i % 2 === 0 ? 1 : -1);
          const y = height / 2 + displacement;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      // Reset shadow blur
      ctx.shadowBlur = 0;
    };

    draw();

    return () => {
      resizeObserver.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying, lightColor, mood]);

  return (
    <div id="visualizer_wrapper" className="relative w-full h-32 md:h-40 rounded-xl overflow-hidden bg-slate-950/80 border border-slate-800/50 backdrop-blur-md">
      <canvas
        id="visualizer_canvas"
        ref={canvasRef}
        className="w-full h-full block"
      />
      <div className="absolute bottom-2 left-3 flex items-center gap-1.5 pointer-events-none">
        <span className="flex h-1.5 w-1.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
          {isPlaying ? `${mood} Audio Stream active` : "Idle Ambient Signal"}
        </span>
      </div>
    </div>
  );
}
