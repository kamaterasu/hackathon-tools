import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { publicUrl } from "../services/storage.js";
import { requireApiKey } from "../middleware/apiKey.js";
import { getScreenIndex, getPlaylistClockState } from "../socket/index.js";

export async function playerRoutes(app: FastifyInstance) {
  app.get(
    "/api/player/:screenId/state",
    { preHandler: requireApiKey },
    async (req, reply) => {
      const { screenId } = req.params as { screenId: string };
      const { rows: [screen] } = await db.query("SELECT * FROM screens WHERE id=$1", [screenId]);
      if (!screen) return reply.code(404).send({ error: "Screen not found" });

      let playlist = null;
      let currentIndex = getScreenIndex(screenId);
      let startedAt = Date.now();

      if (screen.current_playlist_id) {
        const { rows: [p] } = await db.query("SELECT * FROM playlists WHERE id=$1", [screen.current_playlist_id]);
        if (p) {
          const { rows: items } = await db.query(
            "SELECT pi.*, row_to_json(m.*) AS media FROM playlist_items pi JOIN media_items m ON m.id=pi.media_item_id WHERE pi.playlist_id=$1 ORDER BY pi.position",
            [p.id],
          );
          playlist = {
            ...p,
            items: items.map((i) => ({
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

          // Prefer the live playlist clock state (accurate position + offset)
          const clockState = getPlaylistClockState(screen.current_playlist_id);
          if (clockState) {
            currentIndex = clockState.currentIndex;
            startedAt = clockState.startedAt;
          }
        }
      }

      return reply.send({ screen, playlist, current_index: currentIndex, started_at: startedAt });
    },
  );
}
