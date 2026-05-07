import { useEffect, useState } from "react";
import { socket } from "./socket.js";
import { TimerBar } from "./TimerBar.js";
import { ImageRenderer } from "./renderers/ImageRenderer.js";
import { VideoRenderer } from "./renderers/VideoRenderer.js";
import { SlideRenderer } from "./renderers/SlideRenderer.js";
import { UrlRenderer } from "./renderers/UrlRenderer.js";
import { PdfRenderer } from "./renderers/PdfRenderer.js";
import { TimerRenderer } from "./renderers/TimerRenderer.js";

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
  const [startedAt, setStartedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!screenId || !apiKey) return;

    const fetchState = () => {
      fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/player/${screenId}/state`, {
        headers: { "x-api-key": apiKey },
      })
        .then((r) => r.json())
        .then((s) => {
          if (s.playlist) setPlaylist(s.playlist);
          setIndex(s.current_index ?? 0);
          setStartedAt(s.started_at ?? Date.now());
          setTimerKey((k) => k + 1);
        })
        .catch((err) => console.error("Failed to resync state:", err));
    };

    const handleConnect = () => {
      socket.emit("screen:register", { screenId, apiKey });
      fetchState();
    };
    socket.on("connect", handleConnect);
    socket.connect();

    const hb = setInterval(() => socket.emit("screen:heartbeat"), 10000);

    // Navigation commands are now delivered as screen:sync (server-driven clock).
    // Non-navigation commands (timer:pause, etc.) still come via screen:command
    // and are handled directly by TimerRenderer.
    socket.on(
      "screen:sync",
      ({
        playlist: p,
        current_index: ci,
        started_at: sa,
      }: {
        playlist: Playlist | null;
        current_index: number;
        started_at: number;
      }) => {
        setPlaylist(p);
        setIndex(ci ?? 0);
        setStartedAt(sa ?? Date.now());
        setTimerKey((k) => k + 1);
      },
    );

    return () => {
      clearInterval(hb);
      socket.off("connect", handleConnect);
      socket.off("screen:sync");
      socket.disconnect();
    };
  }, [screenId, apiKey]);

  // Retry fetching state every 5s if we have no playlist yet (handles cold-start races).
  useEffect(() => {
    if (playlist || !screenId || !apiKey) return;
    const retryId = setInterval(() => {
      fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/player/${screenId}/state`, {
        headers: { "x-api-key": apiKey },
      })
        .then((r) => r.json())
        .then((s) => {
          if (s.playlist) {
            setPlaylist(s.playlist);
            setIndex(s.current_index ?? 0);
            setStartedAt(s.started_at ?? Date.now());
            setTimerKey((k) => k + 1);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(retryId);
  }, [playlist, screenId, apiKey]);

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
  const initialElapsed = Math.max(0, Date.now() - startedAt);

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
        // Video plays to end then holds last frame; server clock will advance
        <VideoRenderer key={item.id} url={media.file_url} onEnded={() => {}} />
      )}
      {media.type === "pptx" && media.slides && (
        <SlideRenderer
          key={`${item.id}-${timerKey}`}
          slides={media.slides}
          duration={duration}
          initialElapsed={initialElapsed}
        />
      )}
      {media.type === "url" && media.url && (
        <UrlRenderer key={item.id} url={media.url} />
      )}
      {media.type === "pdf" && media.file_url && (
        <PdfRenderer
          key={`${item.id}-${timerKey}`}
          url={media.file_url}
          duration={duration}
          initialElapsed={initialElapsed}
        />
      )}
      {media.type === "timer" && (
        <TimerRenderer
          key={`${item.id}-${timerKey}`}
          duration={duration}
          initialElapsed={initialElapsed}
        />
      )}
      {media.type !== "video" && media.type !== "pptx" && media.type !== "pdf" && media.type !== "timer" && (
        <TimerBar
          key={`${timerKey}-${safeIndex}`}
          duration={duration}
          initialElapsed={initialElapsed}
        />
      )}
    </div>
  );
}
