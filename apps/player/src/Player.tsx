import { useCallback, useEffect, useState } from "react";
import { socket } from "./socket.js";
import { TimerBar } from "./TimerBar.js";
import { ImageRenderer } from "./renderers/ImageRenderer.js";
import { VideoRenderer } from "./renderers/VideoRenderer.js";
import { SlideRenderer } from "./renderers/SlideRenderer.js";
import { UrlRenderer } from "./renderers/UrlRenderer.js";

interface Media {
  type: string;
  file_url?: string;
  url?: string;
  slides?: string[];
  duration_seconds: number;
}
interface Item {
  id: string;
  duration_seconds: number | null;
  media: Media;
}
interface Playlist {
  id: string;
  loop: boolean;
  items: Item[];
}

export function Player({
  screenId,
  apiKey,
}: {
  screenId: string;
  apiKey: string;
}) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [index, setIndex] = useState(0);
  const [timerKey, setTimerKey] = useState(0);

  const advance = useCallback(() => {
    setPlaylist((current) => {
      if (!current) return current;
      setIndex((i) => {
        const next = i + 1;
        return next >= current.items.length ? (current.loop ? 0 : i) : next;
      });
      setTimerKey((k) => k + 1);
      return current;
    });
  }, []);

  useEffect(() => {
    if (!screenId || !apiKey) return;

    // Re-register AND re-fetch state on every (re)connect.
    // This fixes two bugs:
    //   1. Room membership is restored after any network blip.
    //   2. The player resyncs to the server-tracked current_index so the
    //      live-preview iframe and the physical screen never diverge.
    const handleConnect = () => {
      socket.emit("screen:register", { screenId, apiKey });
      fetch(`/api/player/${screenId}/state`, {
        headers: { "x-api-key": apiKey },
      })
        .then((r) => r.json())
        .then((s) => {
          if (s.playlist) setPlaylist(s.playlist);
          setIndex(s.current_index ?? 0);
          setTimerKey((k) => k + 1);
        })
        .catch((err) => console.error("Failed to resync state:", err));
    };
    socket.on("connect", handleConnect);
    socket.connect();

    const hb = setInterval(() => socket.emit("screen:heartbeat"), 10000);

    socket.on(
      "screen:command",
      ({
        action,
        payload,
      }: {
        action: string;
        payload?: { index?: number };
      }) => {
        if (action === "next") {
          // Don't capture `playlist` here — it's stale due to the closed-over
          // value at effect-registration time. `safeIndex` at render time
          // already clamps the index to a valid range.
          setIndex((i) => i + 1);
          setTimerKey((k) => k + 1);
        }
        if (action === "prev") {
          setIndex((i) => Math.max(0, i - 1));
          setTimerKey((k) => k + 1);
        }
        if (action === "goto" && payload?.index !== undefined) {
          setIndex(payload.index);
          setTimerKey((k) => k + 1);
        }
      },
    );

    socket.on(
      "screen:sync",
      ({
        playlist: p,
        current_index: ci,
      }: {
        playlist: Playlist;
        current_index: number;
      }) => {
        setPlaylist(p);
        setIndex(ci ?? 0);
        setTimerKey((k) => k + 1);
      },
    );

    return () => {
      clearInterval(hb);
      socket.off("connect", handleConnect);
      socket.off("screen:command");
      socket.off("screen:sync");
      socket.disconnect();
    };
  }, [screenId, apiKey]);

  if (!playlist?.items.length) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#555",
          fontSize: 18,
          fontFamily: "sans-serif",
        }}
      >
        No content assigned
      </div>
    );
  }

  const safeIndex = Math.min(index, playlist.items.length - 1);
  const item = playlist.items[safeIndex];
  const { media } = item;
  const duration = item.duration_seconds ?? media.duration_seconds ?? 10;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {media.type === "image" && media.file_url && (
        <ImageRenderer key={item.id} url={media.file_url} />
      )}
      {media.type === "video" && media.file_url && (
        <VideoRenderer key={item.id} url={media.file_url} onEnded={advance} />
      )}
      {media.type === "pptx" && media.slides && (
        <SlideRenderer
          key={item.id}
          slides={media.slides}
          duration={duration}
          onComplete={advance}
        />
      )}
      {media.type === "url" && media.url && (
        <UrlRenderer key={item.id} url={media.url} />
      )}
      {media.type !== "video" && media.type !== "pptx" && (
        <TimerBar
          key={`${timerKey}-${safeIndex}`}
          duration={duration}
          onComplete={advance}
        />
      )}
    </div>
  );
}
