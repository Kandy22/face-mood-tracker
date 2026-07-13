import React, { useMemo, useState } from "react";
import { generateMosaic, MosaicTile } from "../lib/mosaicGenerator";

interface ColorMosaicProps {
  colorA: string;
  colorB: string;
  seed: string;
  onHoverColor: (hex: string | null) => void;
}

const ColorMosaic: React.FC<ColorMosaicProps> = ({ colorA, colorB, seed, onHoverColor }) => {
  const tiles = useMemo(() => generateMosaic(colorA, colorB, seed), [colorA, colorB, seed]);
  const [activeTile, setActiveTile] = useState<MosaicTile | null>(null);

  const cols = Math.max(...tiles.map((t) => t.col)) + 1;
  const rows = Math.max(...tiles.map((t) => t.row)) + 1;

  return (
    <div
      className="grid gap-[2px] rounded-xl overflow-hidden border border-slate-800 w-full h-full"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      onMouseLeave={() => {
        setActiveTile(null);
        onHoverColor(null);
      }}
    >
      {tiles.map((tile) => (
        <button
          key={`${tile.row}-${tile.col}`}
          onMouseEnter={() => {
            setActiveTile(tile);
            onHoverColor(tile.hex);
          }}
          onClick={() => {
            setActiveTile(tile);
            onHoverColor(tile.hex);
          }}
          className="w-full h-full min-w-0 min-h-0 transition-transform hover:scale-125 hover:z-10 relative cursor-crosshair"
          style={{
            backgroundColor: tile.hex,
            outline: activeTile === tile ? "2px solid white" : "none",
          }}
          title={tile.hex}
        />
      ))}
    </div>
  );
};

export default ColorMosaic;
