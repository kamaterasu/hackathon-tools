import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { db } from "../db/client.js";

let io: SocketIOServer;

const offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();
const screenIndexes = new Map<string, number>();

// ─── Playlist clock ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResolvedPlaylist = { id: string; loop: boolean; items: any[] };

type PlaylistClock = {
  resolvedPlaylist: ResolvedPlaylist;
  currentIndex: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
};

const playlistClocks = new Map<string, PlaylistClock>();

function scheduleNextTick(playlistId: string, clock: PlaylistClock) {
  const item = clock.resolvedPlaylist.items[clock.currentIndex];
  if (item?.media?.type === "timer") { clock.timer = null; return; }
  const duration = ((item?.duration_seconds ?? 10) as number) * 1000;
  clock.timer = setTimeout(() => {
    const c = playlistClocks.get(playlistId);
    if (!c) return;
    const next = c.currentIndex + 1;
    if (next >= c.resolvedPlaylist.items.length && !c.resolvedPlaylist.loop) {
      c.timer = null;
      return;
    }
    c.currentIndex = next >= c.resolvedPlaylist.items.length ? 0 : next;
    c.startedAt = Date.now();
    getIo()
      .to(`playlist:${playlistId}`)
      .emit("screen:sync", {
        playlist: c.resolvedPlaylist,
        current_index: c.currentIndex,
        started_at: c.startedAt,
      });
    scheduleNextTick(playlistId, c);
  }, duration);
}

export function startPlaylistClock(
  playlistId: string,
  resolvedPlaylist: ResolvedPlaylist,
  startIndex = 0,
) {
  const existing = playlistClocks.get(playlistId);
  if (existing?.timer) clearTimeout(existing.timer);

  const clock: PlaylistClock = {
    resolvedPlaylist,
    currentIndex: startIndex,
    startedAt: Date.now(),
    timer: null,
  };
  playlistClocks.set(playlistId, clock);

  if (resolvedPlaylist.items.length) {
    scheduleNextTick(playlistId, clock);
  }
}

export function stopPlaylistClock(playlistId: string) {
  const existing = playlistClocks.get(playlistId);
  if (existing?.timer) clearTimeout(existing.timer);
  playlistClocks.delete(playlistId);
}

export function adjustTimerClock(playlistId: string, seconds: number) {
  const c = playlistClocks.get(playlistId);
  if (!c) return;
  const item = c.resolvedPlaylist.items[c.currentIndex];
  if (item?.media?.type !== 'timer') return;
  c.startedAt += seconds * 1000;
}

export function getPlaylistClockState(
  playlistId: string,
): { currentIndex: number; startedAt: number; resolvedPlaylist: ResolvedPlaylist } | null {
  const c = playlistClocks.get(playlistId);
  if (!c) return null;
  return { currentIndex: c.currentIndex, startedAt: c.startedAt, resolvedPlaylist: c.resolvedPlaylist };
}

export function advancePlaylistClock(
  playlistId: string,
  delta: number | { absolute: number },
) {
  const c = playlistClocks.get(playlistId);
  if (!c) return;
  const len = c.resolvedPlaylist.items.length;
  if (!len) return;

  if (c.timer) clearTimeout(c.timer);

  if (typeof delta === "number") {
    c.currentIndex = Math.max(0, Math.min(c.currentIndex + delta, len - 1));
  } else {
    c.currentIndex = Math.max(0, Math.min(delta.absolute, len - 1));
  }
  c.startedAt = Date.now();

  getIo()
    .to(`playlist:${playlistId}`)
    .emit("screen:sync", {
      playlist: c.resolvedPlaylist,
      current_index: c.currentIndex,
      started_at: c.startedAt,
    });

  scheduleNextTick(playlistId, c);
}

// ─── Legacy per-screen index (kept for HTTP state endpoint fallback) ──────────
export function getScreenIndex(screenId: string): number {
  return screenIndexes.get(screenId) ?? 0;
}
export function setScreenIndex(screenId: string, index: number): void {
  screenIndexes.set(screenId, Math.max(0, index));
}

// ─── Socket setup ─────────────────────────────────────────────────────────────
const OFFLINE_GRACE_MS = 8_000;

export function setupSocket(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    socket.on(
      "screen:register",
      async ({ screenId, apiKey }: { screenId: string; apiKey: string }) => {
        const { rows } = await db.query(
          "SELECT id, current_playlist_id FROM screens WHERE id=$1 AND api_key=$2",
          [screenId, apiKey],
        );
        if (!rows.length) {
          socket.disconnect();
          return;
        }

        const pending = offlineTimers.get(screenId);
        if (pending) {
          clearTimeout(pending);
          offlineTimers.delete(screenId);
        }

        socket.join(`screen:${screenId}`);
        socket.data.screenId = screenId;

        // Join the playlist room and send current clock state
        const playlistId = rows[0].current_playlist_id as string | null;
        if (playlistId) {
          socket.join(`playlist:${playlistId}`);
          socket.data.playlistId = playlistId;
          const state = getPlaylistClockState(playlistId);
          if (state) {
            socket.emit("screen:sync", {
              playlist: state.resolvedPlaylist,
              current_index: state.currentIndex,
              started_at: state.startedAt,
            });
          }
        }

        await db.query(
          "UPDATE screens SET status='online', last_seen_at=now() WHERE id=$1",
          [screenId],
        );
        console.log(`[socket] screen registered: ${screenId}`);
        io.emit("screen:status", { screenId, status: "online" });
      },
    );

    socket.on("screen:heartbeat", async () => {
      const { screenId } = socket.data;
      if (!screenId) return;
      await db.query(
        "UPDATE screens SET status='online', last_seen_at=now() WHERE id=$1",
        [screenId],
      );
    });

    socket.on("disconnect", async () => {
      const { screenId } = socket.data;
      if (!screenId) return;
      const timer = setTimeout(async () => {
        offlineTimers.delete(screenId);
        await db.query("UPDATE screens SET status='offline' WHERE id=$1", [screenId]);
        io.emit("screen:status", { screenId, status: "offline" });
      }, OFFLINE_GRACE_MS);
      offlineTimers.set(screenId, timer);
    });
  });

  return io;
}

export function getIo() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}
