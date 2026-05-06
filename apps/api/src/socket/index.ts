import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { db } from "../db/client.js";

let io: SocketIOServer;

// Pending timers that will mark a screen offline after a grace period.
// Cancelled if the screen reconnects before the timer fires.
const offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();

// In-memory current-index per screen so reconnecting players and the live
// preview iframe always resume at the same position the admin last set.
const screenIndexes = new Map<string, number>();

export function getScreenIndex(screenId: string): number {
  return screenIndexes.get(screenId) ?? 0;
}

export function setScreenIndex(screenId: string, index: number): void {
  screenIndexes.set(screenId, Math.max(0, index));
}

const OFFLINE_GRACE_MS = 8_000; // time to wait before declaring a screen offline

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
          "SELECT id FROM screens WHERE id=$1 AND api_key=$2",
          [screenId, apiKey],
        );
        if (!rows.length) {
          socket.disconnect();
          return;
        }

        // Cancel any pending offline timer — the screen came back in time.
        const pending = offlineTimers.get(screenId);
        if (pending) {
          clearTimeout(pending);
          offlineTimers.delete(screenId);
        }

        socket.join(`screen:${screenId}`);
        socket.data.screenId = screenId;
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
      // Also restore status in case a previous disconnect briefly set it offline.
      await db.query(
        "UPDATE screens SET status='online', last_seen_at=now() WHERE id=$1",
        [screenId],
      );
    });

    socket.on("disconnect", async () => {
      const { screenId } = socket.data;
      if (!screenId) return;

      // Don't mark offline immediately — Socket.IO reconnects within a few
      // seconds for transient network blips. Only mark offline if the screen
      // hasn't re-registered within the grace period.
      const timer = setTimeout(async () => {
        offlineTimers.delete(screenId);
        await db.query("UPDATE screens SET status='offline' WHERE id=$1", [
          screenId,
        ]);
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
