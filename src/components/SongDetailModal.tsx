import React, { useState } from "react";
import { X, Play, ExternalLink, Palette } from "lucide-react";
import { analyzeColor, analyzePairing, nearestNamedColor, hexToRgb } from "../lib/colorAttribution";
import { MOOD_THEMES } from "../lib/moodThemes";
import ColorMosaic from "./ColorMosaic";

export interface CalibrationSong {
  track: string;
  artist: string;
  mood: string;
  primaryMood: string;
  colors: string[];
  youtubeUrl: string;
}

interface SongDetailModalProps {
  song: CalibrationSong;
  onClose: () => void;
  onPlay: (song: CalibrationSong) => void;
}

const SongDetailModal: React.FC<SongDetailModalProps> = ({ song, onClose, onPlay }) => {
  const theme = MOOD_THEMES[song.primaryMood] || MOOD_THEMES.Neutral;
  const [colorA, colorB] = song.colors;
  const pairing = analyzePairing(colorA, colorB || colorA);

  // Live-tracked pixel color: null means "not hovering the mosaic", so the
  // flanking bars and readout fall back to the song's two calibrated colors.
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);

  const focusHex = hoveredHex || colorA;
  const focusAnalysis = analyzeColor(focusHex);
  const focusRgb = hexToRgb(focusHex);
  const focusNamed = nearestNamedColor(focusHex);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 max-w-xl w-full rounded-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-4 pb-0 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{song.track}</h2>
            <p className="text-sm text-slate-400">by {song.artist}</p>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span
                className="px-2.5 py-1 text-[10px] font-mono rounded-full border"
                style={{ backgroundColor: `${theme.color}15`, borderColor: `${theme.color}40`, color: theme.color }}
              >
                {song.primaryMood}
              </span>
              <span className="text-xs italic text-slate-400">{song.mood}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-950 text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* MOSAIC + LIVE FLANKING COLOR BARS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-slate-400" />
                <h3 className="text-[11px] font-mono uppercase tracking-widest text-slate-400">Generated Spectrum Mosaic</h3>
              </div>
              <span className="text-[9px] font-mono text-slate-500">Hover / tap a tile</span>
            </div>

            <div className="flex gap-2 h-40">
              {/* LEFT FLANK — live, defaults to Color A */}
              <div
                className="w-8 rounded-xl shrink-0 transition-colors duration-150 border border-white/10"
                style={{ backgroundColor: hoveredHex || colorA, boxShadow: `0 0 16px ${(hoveredHex || colorA)}55` }}
              />

              {/* MOSAIC */}
              <div className="flex-grow">
                <ColorMosaic colorA={colorA} colorB={colorB || colorA} seed={song.track} onHoverColor={setHoveredHex} />
              </div>

              {/* RIGHT FLANK — live, defaults to Color B */}
              <div
                className="w-8 rounded-xl shrink-0 transition-colors duration-150 border border-white/10"
                style={{ backgroundColor: hoveredHex || (colorB || colorA), boxShadow: `0 0 16px ${(hoveredHex || (colorB || colorA))}55` }}
              />
            </div>
          </div>

          {/* LIVE PIXEL READOUT */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg shrink-0 border border-white/10 transition-colors duration-150"
              style={{ backgroundColor: focusHex, boxShadow: `0 0 14px ${focusHex}55` }}
            />
            <div className="min-w-0 flex-grow">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-white">{focusAnalysis.hex}</span>
                <span className="font-mono text-[10px] text-slate-500">
                  rgb({focusRgb.r}, {focusRgb.g}, {focusRgb.b})
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                  Nearest: {focusNamed.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                {focusAnalysis.h}&deg; hue &middot; {focusAnalysis.s}% sat &middot; {focusAnalysis.l}% light &mdash; {focusAnalysis.descriptor}
              </p>
            </div>
          </div>

          {/* PAIRING ANALYSIS */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
            <h3 className="text-[11px] font-mono uppercase tracking-widest text-slate-400 mb-2">Pairing Analysis</h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-slate-900/80 rounded-lg py-1.5 text-center">
                <span className="block text-[9px] font-mono text-slate-500 uppercase">Hue Distance</span>
                <span className="block text-xs font-mono font-bold text-slate-200">{pairing.hueDistance}&deg;</span>
              </div>
              <div className="bg-slate-900/80 rounded-lg py-1.5 text-center">
                <span className="block text-[9px] font-mono text-slate-500 uppercase">Relationship</span>
                <span className="block text-xs font-mono font-bold text-slate-200">{pairing.relationship}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {pairing.relationshipNote} With a {pairing.lightnessDelta}% lightness delta, this spectrum carries {pairing.rangeNote}
            </p>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                onPlay(song);
                onClose();
              }}
              className="flex-grow py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 text-slate-950 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              style={{ backgroundColor: theme.color, boxShadow: `0 4px 15px ${theme.color}40` }}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Calibrate &amp; Play
            </button>
            <a
              href={song.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Open on YouTube"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongDetailModal;
