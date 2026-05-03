import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db/client.js";
import { getIo, getScreenIndex, setScreenIndex } from "../socket/index.js";
import { publicUrl } from "../services/storage.js";

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
    // Notify all admin clients that a new screen has appeared
    try {
      getIo().emit("screen:new", { screenId: screen.id, name: screen.name });
    } catch (_) {
      /* socket may not be up yet */
    }
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
    const {
      rows: [screen],
    } = await db.query("SELECT * FROM screens WHERE id=$1", [id]);
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
    const {
      rows: [check],
    } = await db.query(
      "SELECT id, current_playlist_id AS old_playlist_id FROM screens WHERE id=$1",
      [id],
    );
    if (!check) return reply.code(404).send({ error: "Not found" });
    const { name, location, current_playlist_id } = req.body as {
      name?: string;
      location?: string;
      current_playlist_id?: string;
    };
    const {
      rows: [updated],
    } = await db.query(
      `UPDATE screens SET name=COALESCE($1,name), location=COALESCE($2,location),
       current_playlist_id=CASE WHEN $3::text IS NOT NULL THEN $3::uuid ELSE current_playlist_id END
       WHERE id=$4 RETURNING *`,
      [name ?? null, location ?? null, current_playlist_id ?? null, id],
    );

    // If playlist changed, emit screen:sync so player immediately loads new content
    if (current_playlist_id && current_playlist_id !== check.old_playlist_id) {
      const {
        rows: [p],
      } = await db.query("SELECT * FROM playlists WHERE id=$1", [
        current_playlist_id,
      ]);
      if (p) {
        const { rows: items } = await db.query(
          "SELECT pi.*, row_to_json(m.*) AS media FROM playlist_items pi JOIN media_items m ON m.id=pi.media_item_id WHERE pi.playlist_id=$1 ORDER BY pi.position",
          [p.id],
        );
        const playlist = {
          ...p,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: (items as any[]).map(
            (i: {
              media: {
                file_path?: string;
                type?: string;
                slide_count?: number;
              };
            }) => ({
              ...i,
              media: {
                ...i.media,
                file_url: i.media.file_path
                  ? publicUrl(i.media.file_path)
                  : null,
                slides:
                  i.media.type === "pptx" && i.media.slide_count
                    ? Array.from(
                        { length: i.media.slide_count },
                        (_: unknown, idx: number) =>
                          publicUrl(
                            `${i.media.file_path}-slide-${idx + 1}.png`,
                          ),
                      )
                    : undefined,
              },
            }),
          ),
        };
        setScreenIndex(id, 0);
        getIo()
          .to(`screen:${id}`)
          .emit("screen:sync", { playlist, current_index: 0 });
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
    const {
      rows: [screen],
    } = await db.query("SELECT id FROM screens WHERE id=$1", [id]);
    if (!screen) return reply.code(404).send({ error: "Screen not found" });
    const { action, payload } = req.body as {
      action: string;
      payload?: Record<string, unknown>;
    };
    // Keep server-side index in sync so reconnecting players resume correctly.
    const current = getScreenIndex(id);
    if (action === "next") setScreenIndex(id, current + 1);
    else if (action === "prev") setScreenIndex(id, Math.max(0, current - 1));
    else if (action === "goto" && payload?.index !== undefined)
      setScreenIndex(id, payload.index as number);

    getIo().to(`screen:${id}`).emit("screen:command", { action, payload });
    await db.query(
      "INSERT INTO screen_events(screen_id,event_type,triggered_by) VALUES($1,$2,'admin')",
      [id, action],
    );
    return reply.send({ ok: true });
  });
}
