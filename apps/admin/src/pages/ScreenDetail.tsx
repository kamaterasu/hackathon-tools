import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, SkipForward, SkipBack, Trash2, Copy, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../api/index.js";
import { socket } from "../socket.js";

type ScreenData = {
  id: string;
  name: string;
  location?: string;
  status: string;
  api_key: string;
  current_playlist_id?: string;
  events?: {
    id: string;
    event_type: string;
    triggered_by?: string;
    occurred_at: string;
  }[];
};
type Playlist = { id: string; name: string };

export function ScreenDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const { data: screen, isLoading } = useQuery({
    queryKey: ["screens", id],
    queryFn: () => api.screens.get(id!),
  });
  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: api.playlists.list,
  });
  const s = screen as ScreenData | undefined;

  // Keep the detail (and the live-preview iframe) in sync with real-time
  // status changes emitted by the server.
  useEffect(() => {
    const refresh = ({ screenId }: { screenId: string }) => {
      if (screenId === id) qc.invalidateQueries({ queryKey: ["screens", id] });
    };
    socket.on("screen:status", refresh);
    socket.on("screen:sync", refresh);
    return () => {
      socket.off("screen:status", refresh);
      socket.off("screen:sync", refresh);
    };
  }, [id, qc]);

  const [timerPaused, setTimerPaused] = useState(false);

  const command = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload?: unknown }) =>
      api.screens.command(id!, action, payload),
  });
  const assign = useMutation({
    mutationFn: (playlist_id: string) =>
      api.screens.update(id!, { current_playlist_id: playlist_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screens", id] });
      api.screens.command(id!, "assign");
    },
  });
  const del = useMutation({
    mutationFn: () => api.screens.delete(id!),
    onSuccess: () => navigate("/screens"),
    onError: (e: Error) => alert(`Delete failed: ${e.message}`),
  });

  const copyKey = () => {
    if (s?.api_key) {
      navigator.clipboard.writeText(s.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!s) return <div className="p-8 text-red-400">Screen not found</div>;

  const playerUrl = `${import.meta.env.VITE_PLAYER_URL ?? ""}/?screenId=${s.id}&apiKey=${encodeURIComponent(s.api_key)}`;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <button
        onClick={() => navigate("/screens")}
        className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-6"
      >
        <ChevronLeft size={16} /> Screens
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{s.name}</h1>
          {s.location && <p className="text-gray-400 text-sm">{s.location}</p>}
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-600 font-mono">
              API Key: {showKey ? s.api_key : "••••••••••••••••"}
            </p>
            <button
              onClick={() => setShowKey((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              {showKey ? "hide" : "show"}
            </button>
            <button
              onClick={copyKey}
              className="text-gray-500 hover:text-gray-300"
            >
              <Copy size={12} />
            </button>
            {copied && <span className="text-xs text-green-400">Copied!</span>}
          </div>
          <a
            href={playerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-400 hover:underline mt-1 block"
          >
            Open Player →
          </a>
        </div>
        <button
          onClick={() => { if (window.confirm(`Delete screen "${s.name}"?`)) del.mutate(); }}
          disabled={del.isPending}
          className="text-red-400 hover:text-red-300 p-2 disabled:opacity-40"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">Live Controls</h2>
        <div className="flex gap-2">
          <button
            onClick={() => command.mutate({ action: "prev" })}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm"
          >
            <SkipBack size={14} /> Prev
          </button>
          <button
            onClick={() => command.mutate({ action: "next" })}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm"
          >
            <SkipForward size={14} /> Next
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Timer size={14} /> Timer Controls</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { command.mutate({ action: timerPaused ? "timer:resume" : "timer:pause" }); setTimerPaused(p => !p); }}
            className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-lg text-sm"
          >
            {timerPaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
          </button>
          <button
            onClick={() => { command.mutate({ action: "timer:restart" }); setTimerPaused(false); }}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm"
          >
            <RotateCcw size={14} /> Restart
          </button>
          {[{ label: "−1 min", s: -60 }, { label: "−10s", s: -10 }, { label: "+10s", s: 10 }, { label: "+1 min", s: 60 }].map(({ label, s }) => (
            <button
              key={label}
              onClick={() => command.mutate({ action: "timer:adjust", payload: { seconds: s } })}
              className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm font-mono"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">Assign Playlist</h2>
        <select
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          value={s.current_playlist_id ?? ""}
          onChange={(e) => e.target.value && assign.mutate(e.target.value)}
        >
          <option value="">— Select playlist —</option>
          {(playlists as Playlist[]).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {s.events && s.events.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Recent Events</h2>
          <div className="space-y-1 max-h-48 overflow-auto">
            {s.events.slice(0, 20).map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between text-xs text-gray-400"
              >
                <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded">
                  {ev.event_type}
                </span>
                <span>{ev.triggered_by ?? "system"}</span>
                <span>{new Date(ev.occurred_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
