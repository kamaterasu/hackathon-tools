import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db/client.js";
import {
  getIo,
  getScreenIndex,
  startPlaylistClock,
  getPlaylistClockState,
  advancePlaylistClock,
  adjustTimerClock,
} from "../socket/index.js";
import { publicUrl } from "../services/storage.js";

// Shared helper to build a resolved playlist object (with public URLs)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchResolvedPlaylist(playlistId: string): Promise<any | null> {
  const { rows: [p] } = await db.query("SELECT * FROM playlists WHERE id=$1", [playlistId]);
  if (!p) return null;
  const { rows: items } = await db.query(
    "SELECT pi.*, row_to_json(m.*) AS media FROM playlist_items pi JOIN media_items m ON m.id=pi.media_item_id WHERE pi.playlist_id=$1 ORDER BY pi.position",
    [p.id],
  );
  return {
    ...p,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (items as any[]).map((i) => ({
      ...i,
      media: {
        ...i.media,
        file_url: i.media.file_path ? publicUrl(i.media.file_path) : null,
        slides:
          i.media.type === "pptx" && i.media.slide_count
            ? Array.from(
                { length: i.media.slide_count },
                (_: unknown, idx: number) =>
                  publicUrl(`${i.media.file_path}-slide-${idx + 1}.png`),
              )
            : undefined,
      },
    })),
  };
}

export async function screenRoutes(app: FastifyInstance) {
  app.get("/api/screens", async (_req, reply) => {
    const { rows } = await db.query(
      "SELECT s.*, p.name AS playlist_name FROM screens s LEFT JOIN playlists p ON p.id = s.current_playlist_id ORDER BY s.created_at",
    );
    return reply.send(rows);
  });

  app.post("/api/screens/auto-register", async (req, reply) => {
    const { name } = (req.body ?? {}) as { name?: string };
    const apiKey = randomUUID();
    const screenName = name?.trim() || `Screen-${apiKey.slice(0, 8)}`;
    const { rows } = await db.query(
      "INSERT INTO screens(name, api_key) VALUES($1, $2) RETURNING *",
      [screenName, apiKey],
    );
    const screen = rows[0];
    try {
      getIo().emit("screen:new", { screenId: screen.id, name: screen.name });
    } catch (_) { /* socket may not be up yet */ }
    return reply.code(201).send(screen);
  });

  app.post("/api/screens", async (req, reply) => {
    const { name, location } = req.body as { name: string; location?: string };
    const apiKey = randomUUID();
    const { rows } = await db.query(
      "INSERT INTO screens(name,location,api_key) VALUES($1,$2,$3) RETURNING *",
      [name, location ?? null, apiKey],
    );
    return reply.code(201).send(rows[0]);
  });

  app.get("/api/screens/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows: [screen] } = await db.query("SELECT * FROM screens WHERE id=$1", [id]);
    if (!screen) return reply.code(404).send({ error: "Not found" });
    const { rows: schedules } = await db.query(
      "SELECT * FROM schedules WHERE screen_id=$1 ORDER BY start_at",
      [id],
    );
    const { rows: events } = await db.query(
      "SELECT * FROM screen_events WHERE screen_id=$1 ORDER BY occurred_at DESC LIMIT 50",
      [id],
    );
    return reply.send({ ...screen, schedules, events });
  });

  app.put("/api/screens/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows: [check] } = await db.query(
      "SELECT id, current_playlist_id AS old_playlist_id FROM screens WHERE id=$1",
      [id],
    );
    if (!check) return reply.code(404).send({ error: "Not found" });

    const { name, location, current_playlist_id } = req.body as {
      name?: string;
      location?: string;
      current_playlist_id?: string;
    };
    const { rows: [updated] } = await db.query(
      `UPDATE screens SET name=COALESCE($1,name), location=COALESCE($2,location),
       current_playlist_id=CASE WHEN $3::text IS NOT NULL THEN $3::uuid ELSE current_playlist_id END
       WHERE id=$4 RETURNING *`,
      [name ?? null, location ?? null, current_playlist_id ?? null, id],
    );

    if (current_playlist_id && current_playlist_id !== check.old_playlist_id) {
      // Leave old playlist room
      if (check.old_playlist_id) {
        getIo().in(`screen:${id}`).socketsLeave(`playlist:${check.old_playlist_id}`);
      }
      // Join new playlist room
      getIo().in(`screen:${id}`).socketsJoin(`playlist:${current_playlist_id}`);

      const playlist = await fetchResolvedPlaylist(current_playlist_id);
      if (playlist) {
        const existing = getPlaylistClockState(current_playlist_id);
        if (!existing) {
          // Start a new shared clock — emits to playlist room immediately
          startPlaylistClock(current_playlist_id, playlist, 0);
          const state = getPlaylistClockState(current_playlist_id)!;
          getIo().to(`screen:${id}`).emit("screen:sync", {
            playlist,
            current_index: state.currentIndex,
            started_at: state.startedAt,
          });
        } else {
          // Clock already running — catch this screen up to current position
          getIo().to(`screen:${id}`).emit("screen:sync", {
            playlist: existing.resolvedPlaylist,
            current_index: existing.currentIndex,
            started_at: existing.startedAt,
          });
        }
      }
    }

    return reply.send(updated);
  });

  app.delete("/api/screens/:id", async (req, reply) => {
    await db.query("DELETE FROM screens WHERE id=$1", [
      (req.params as { id: string }).id,
    ]);
    return reply.code(204).send();
  });

  app.post("/api/screens/:id/command", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows: [screen] } = await db.query(
      "SELECT id, current_playlist_id FROM screens WHERE id=$1",
      [id],
    );
    if (!screen) return reply.code(404).send({ error: "Screen not found" });

    const { action, payload } = req.body as {
      action: string;
      payload?: Record<string, unknown>;
    };

    const playlistId = screen.current_playlist_id as string | null;

    if (playlistId && (action === "next" || action === "prev" || action === "goto")) {
      // Navigation advances the shared playlist clock → all screens sync together
      if (action === "next") advancePlaylistClock(playlistId, 1);
      else if (action === "prev") advancePlaylistClock(playlistId, -1);
      else if (action === "goto" && payload?.index !== undefined)
        advancePlaylistClock(playlistId, { absolute: payload.index as number });
    } else {
      // Non-navigation commands (timer:pause etc.) go to the playlist room so all
      // screens on the same playlist respond together, falling back to single screen.
      if (playlistId && action === 'timer:adjust') {
        const seconds = (payload as { seconds?: number })?.seconds ?? 0;
        adjustTimerClock(playlistId, seconds);
      }
      const target = playlistId
        ? `playlist:${playlistId}`
        : `screen:${id}`;
      getIo().to(target).emit("screen:command", { action, payload });
    }

    // Keep legacy per-screen index in sync as fallback
    const current = getScreenIndex(id);
    if (action === "next") {
      // index will be updated by clock broadcast received by all
    } else if (action === "prev") {
      // same
    }

    await db.query(
      "INSERT INTO screen_events(screen_id,event_type,triggered_by) VALUES($1,$2,'admin')",
      [id, action],
    );
    return reply.send({ ok: true });
  });
}
