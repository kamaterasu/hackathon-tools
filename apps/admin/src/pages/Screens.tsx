import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Monitor, Plus, SkipForward, Wifi, WifiOff } from "lucide-react";
import { api } from "../api/index.js";
import { socket } from "../socket.js";

type Screen = {
  id: string;
  name: string;
  location?: string;
  status: string;
  playlist_name?: string;
};

type Playlist = { id: string; name: string };

export function Screens() {
  const qc = useQueryClient();
  const { data: screens = [], isLoading } = useQuery({
    queryKey: ["screens"],
    queryFn: api.screens.list,
  });
  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: api.playlists.list,
  });
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignPlaylistId, setAssignPlaylistId] = useState("");

  const batchAssign = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        [...selectedIds].map(async (screenId) => {
          await api.screens.update(screenId, { current_playlist_id: assignPlaylistId });
          await api.screens.command(screenId, "assign");
        })
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) alert(`${failed} assignment(s) failed`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screens"] });
      setSelectedIds(new Set());
      setAssignPlaylistId("");
    },
  });

  const toggleSelect = (screenId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(screenId) ? next.delete(screenId) : next.add(screenId);
      return next;
    });
  };

  const create = useMutation({
    mutationFn: () =>
      api.screens.create({ name, location: location || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screens"] });
      setShowCreate(false);
      setName("");
      setLocation("");
    },
    onError: (e: Error) => alert(`Create failed: ${e.message}`),
  });

  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ["screens"] });
    socket.on("screen:status", handler);
    socket.on("screen:new", handler);
    return () => {
      socket.off("screen:status", handler);
      socket.off("screen:new", handler);
    };
  }, [qc]);

  const sendNext = (screenId: string, e: React.MouseEvent) => {
    e.preventDefault();
    api.screens.command(screenId, "next");
  };

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Screens</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> Add Screen
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-gray-900 border border-gray-700 rounded-xl p-4 max-w-md">
          <h2 className="text-sm font-semibold mb-3">New Screen</h2>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-3"
            placeholder="Location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => create.mutate()}
              disabled={!name || create.isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-1.5 rounded-lg text-sm"
            >
              {create.isPending ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-gray-400 hover:text-white text-sm px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(screens as Screen[]).map((s) => (
          <div key={s.id} className="relative">
            <input
              type="checkbox"
              checked={selectedIds.has(s.id)}
              onClick={(e) => toggleSelect(s.id, e)}
              onChange={() => {}}
              className="absolute top-3 left-3 z-10 w-4 h-4 cursor-pointer accent-blue-500"
            />
            <Link
              to={`/screens/${s.id}`}
              className="block bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-colors pl-9"
            >
              <div className="flex items-start justify-between mb-3">
                <Monitor size={20} className="text-gray-500" />
                {s.status === "online" ? (
                  <span className="flex items-center gap-1.5 text-xs text-green-400">
                    <Wifi size={12} /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <WifiOff size={12} /> Offline
                  </span>
                )}
              </div>
              <p className="font-semibold">{s.name}</p>
              {s.location && (
                <p className="text-xs text-gray-500 mt-0.5">{s.location}</p>
              )}
              {s.playlist_name && (
                <p className="text-xs text-blue-400 mt-2">▶ {s.playlist_name}</p>
              )}
              <div className="flex justify-end mt-3 pt-2 border-t border-gray-800">
                <button
                  onClick={(e) => sendNext(s.id, e)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded"
                >
                  <SkipForward size={12} /> Next
                </button>
              </div>
            </Link>
          </div>
        ))}
        {screens.length === 0 && (
          <p className="text-gray-500 text-sm col-span-full">
            No screens registered yet.
          </p>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-6 py-3 flex items-center gap-4 z-20">
          <span className="text-sm text-gray-300">
            {selectedIds.size} screen{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={() =>
              setSelectedIds(
                selectedIds.size === screens.length
                  ? new Set()
                  : new Set((screens as Screen[]).map((s) => s.id))
              )
            }
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {selectedIds.size === screens.length ? "Clear all" : "Select all"}
          </button>
          <select
            className="ml-auto bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            value={assignPlaylistId}
            onChange={(e) => setAssignPlaylistId(e.target.value)}
          >
            <option value="">— Choose playlist —</option>
            {(playlists as Playlist[]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => batchAssign.mutate()}
            disabled={!assignPlaylistId || batchAssign.isPending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            {batchAssign.isPending ? "Assigning..." : "Assign"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-gray-400 hover:text-white text-sm"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
