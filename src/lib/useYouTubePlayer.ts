import { useEffect, useRef, useState, useCallback } from "react";

// Thin wrapper around the real YouTube IFrame Player API.
//
// Why not a raw <iframe src="...">: it has no programmatic stop/volume
// control and, critically, no error signal. Videos with embedding disabled
// by the content owner (very common on official label/VEVO uploads) either
// show a dead black box or — on some browser/YouTube combinations — open a
// new tab to keep playing, completely outside the app's control. That is
// "some songs won't turn off." The real Player API fires onError (100/101/
// 150 = not embeddable / not found) so we can catch it and skip instead of
// leaving an unkillable orphaned video.

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiLoadPromise;
}

// YT error codes: 2 invalid param, 5 HTML5 error, 100 not found/removed,
// 101 & 150 embedding disallowed by the owner.
const UNPLAYABLE_ERRORS = new Set([100, 101, 150]);

export function useYouTubePlayer(opts: {
  containerId: string;
  volume: number; // 0..1
  muted: boolean;
  onUnplayable: (videoId: string) => void; // called so caller can auto-skip
}) {
  const { containerId, onUnplayable } = opts;
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const volumeRef = useRef(opts.volume);
  const mutedRef = useRef(opts.muted);
  volumeRef.current = opts.volume;
  mutedRef.current = opts.muted;

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled) return;
      playerRef.current = new window.YT.Player(containerId, {
        height: "100%",
        width: "100%",
        playerVars: { autoplay: 0, rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current?.setVolume(Math.round(volumeRef.current * 100));
            if (mutedRef.current) playerRef.current?.mute();
            setReady(true);
          },
          onError: (e: { data: number }) => {
            const vid = playerRef.current?.getVideoData?.()?.video_id;
            if (UNPLAYABLE_ERRORS.has(e.data) && vid) onUnplayable(vid);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* already gone */
      }
      playerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  const play = useCallback((videoId: string) => {
    if (!playerRef.current?.loadVideoById) return;
    playerRef.current.loadVideoById(videoId);
  }, []);

  // Hard stop: stopVideo() (not just pause) fully halts buffering/playback.
  // Combined with destroy() on unmount, this is the actual kill switch —
  // removing the surrounding DOM node alone is not always sufficient.
  const stop = useCallback(() => {
    try {
      playerRef.current?.stopVideo?.();
    } catch {
      /* player not ready yet */
    }
  }, []);

  useEffect(() => {
    if (!ready || !playerRef.current) return;
    playerRef.current.setVolume(Math.round(opts.volume * 100));
    if (opts.muted) playerRef.current.mute();
    else playerRef.current.unMute();
  }, [ready, opts.volume, opts.muted]);

  return { play, stop, ready };
}
