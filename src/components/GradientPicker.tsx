import React, { useRef, useEffect, useState } from "react";

interface GradientPickerProps {
  pointerValue: number; // 0 to 1
  shiftValue: number; // -1 to 1
  ratioValue: number; // 0 to 1
  onPointerChange: (val: number) => void;
  onShiftChange?: (val: number) => void;
  onRatioChange?: (val: number) => void;
  colorInner: string;
  colorOuter: string;
  isInteractive?: boolean;
}

export default function GradientPicker({
  pointerValue,
  shiftValue,
  ratioValue,
  onPointerChange,
  onShiftChange,
  onRatioChange,
  colorInner,
  colorOuter,
  isInteractive = true,
}: GradientPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Standard color list from the Codepen
  const colorsOuter = ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff"];

  // Unique ID for gradients to prevent collisions
  const pickerId = "mood-picker-grad";

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const radians = Math.atan2(clientY - centerY, clientX - centerX);
    // Convert to degrees (0 to 360) and align 0 at top (add 90 deg)
    let deg = (radians * (180 / Math.PI) + 90 + 360) % 360;
    
    // Normalize to 0 - 1
    const normalized = deg / 360;
    onPointerChange(normalized);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteractive) return;
    setIsDragging(true);
    handlePointerMove(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isInteractive) return;
    setIsDragging(true);
    if (e.touches[0]) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (isDragging) {
        handlePointerMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleGlobalMove);
      window.addEventListener("touchmove", handleGlobalTouchMove);
      window.addEventListener("mouseup", handleGlobalUp);
      window.addEventListener("touchend", handleGlobalUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
      window.removeEventListener("mouseup", handleGlobalUp);
      window.removeEventListener("touchend", handleGlobalUp);
    };
  }, [isDragging]);

  // Pointer angle (0 to 360)
  const pointerAngle = pointerValue * 360;

  return (
    <div
      ref={containerRef}
      className={`relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center select-none ${
        isInteractive ? "cursor-crosshair" : ""
      }`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* GLOWING ORBIT BACKGROUND */}
      <div
        className="absolute inset-4 rounded-full filter blur-xl opacity-30 transition-all duration-700 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${colorInner}, ${colorOuter})`,
        }}
      />

      {/* OUTER COLOR PICKER SVG */}
      <div className="absolute inset-0 pointer-events-none">
        <svg
          className="w-full h-full transform scale-[0.95] drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          viewBox="-10 -10 220 220"
        >
          <defs>
            <linearGradient id={`redyel-${pickerId}`} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colorsOuter[0]} />
              <stop offset="100%" stopColor={colorsOuter[1]} />
            </linearGradient>
            <linearGradient id={`yelgre-${pickerId}`} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorsOuter[1]} />
              <stop offset="100%" stopColor={colorsOuter[2]} />
            </linearGradient>
            <linearGradient id={`grecya-${pickerId}`} gradientUnits="objectBoundingBox" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorsOuter[2]} />
              <stop offset="100%" stopColor={colorsOuter[3]} />
            </linearGradient>
            <linearGradient id={`cyablu-${pickerId}`} gradientUnits="objectBoundingBox" x1="1" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={colorsOuter[3]} />
              <stop offset="100%" stopColor={colorsOuter[4]} />
            </linearGradient>
            <linearGradient id={`blumag-${pickerId}`} gradientUnits="objectBoundingBox" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={colorsOuter[4]} />
              <stop offset="100%" stopColor={colorsOuter[5]} />
            </linearGradient>
            <linearGradient id={`magred-${pickerId}`} gradientUnits="objectBoundingBox" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={colorsOuter[5]} />
              <stop offset="100%" stopColor={colorsOuter[0]} />
            </linearGradient>
          </defs>
          <ellipse cx="100" cy="100" rx="100.95" ry="100.95" fill="none" stroke="rgba(33,33,33,0.3)" strokeWidth="0.5" />
          <g fill="none" strokeWidth="12" strokeLinecap="round" transform="translate(100,100)">
            <path d="M -1,-100 A 100,100 0 0,1 86.6,-50" stroke={`url(#redyel-${pickerId})`} />
            <path d="M 86,-51 A 100,100 0 0,1 86.6,50" stroke={`url(#yelgre-${pickerId})`} />
            <path d="M 87,49 A 100,100 0 0,1 0,100" stroke={`url(#grecya-${pickerId})`} />
            <path d="M 1,100 A 100,100 0 0,1 -86.6,50" stroke={`url(#cyablu-${pickerId})`} />
            <path d="M -86,51 A 100,100 0 0,1 -86.6,-50" stroke={`url(#blumag-${pickerId})`} />
            <path d="M -87,-49 A 100,100 0 0,1 0,-100" stroke={`url(#magred-${pickerId})`} />
          </g>
        </svg>
      </div>

      {/* INNER COLOR PICKER SVG (Rotated by shiftValue) */}
      <div
        className="absolute inset-0 pointer-events-none transition-transform duration-700"
        style={{ transform: `rotate(${shiftValue * -360}deg)` }}
      >
        <svg
          className="w-full h-full transform scale-[0.83]"
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          viewBox="-10 -10 220 220"
        >
          <g fill="none" strokeWidth="10" strokeLinecap="round" transform="translate(100,100)">
            <path d="M -1,-100 A 100,100 0 0,1 86.6,-50" stroke={`url(#redyel-${pickerId})`} />
            <path d="M 86,-51 A 100,100 0 0,1 86.6,50" stroke={`url(#yelgre-${pickerId})`} />
            <path d="M 87,49 A 100,100 0 0,1 0,100" stroke={`url(#grecya-${pickerId})`} />
            <path d="M 1,100 A 100,100 0 0,1 -86.6,50" stroke={`url(#cyablu-${pickerId})`} />
            <path d="M -86,51 A 100,100 0 0,1 -86.6,-50" stroke={`url(#blumag-${pickerId})`} />
            <path d="M -87,-49 A 100,100 0 0,1 0,-100" stroke={`url(#magred-${pickerId})`} />
          </g>
        </svg>
      </div>

      {/* INTERACTIVE POINTER (The glowing circular tab) */}
      <div
        className="absolute pointer-events-none transition-transform duration-150 ease-out"
        style={{
          width: "100%",
          height: "100%",
          transform: `translate(0, 0) rotate(${pointerAngle}deg)`,
        }}
      >
        <div
          className="absolute left-1/2 rounded-full border-2 border-slate-900 shadow-2xl transition-all"
          style={{
            top: "6px", // Aligns perfectly on the outer SVG wheel track
            width: "22px",
            height: "22px",
            transform: "translate(-50%, -50%)",
            backgroundColor: colorOuter,
            boxShadow: `0 0 15px ${colorOuter}, inset 0 0 4px rgba(255,255,255,0.6)`,
          }}
        />
      </div>

      {/* INNER DOCK FOR WEBCAM / ACTIVE MOOD INDICATOR */}
      <div className="absolute w-[160px] h-[160px] md:w-[175px] md:h-[175px] rounded-full bg-slate-950/90 border border-slate-800/80 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col items-center justify-center p-3 text-center">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Atmosphere</span>
        <span
          className="text-lg md:text-xl font-bold transition-all duration-500 my-1 block"
          style={{ color: colorInner, textShadow: `0 0 8px ${colorInner}40` }}
        >
          {colorInner ? "SYNCED" : "SELECT"}
        </span>
        <div
          className="w-4 h-4 rounded-full animate-pulse transition-all duration-500 shadow-lg"
          style={{
            backgroundColor: colorInner,
            boxShadow: `0 0 15px ${colorInner}`,
          }}
        />
        <span className="text-[9px] font-mono text-slate-500 mt-2 block px-2 leading-tight">
          Drag wheel to blend frequencies manually
        </span>
      </div>
    </div>
  );
}
