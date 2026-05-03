import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { publicUrl } from '../services/storage.js';

async function getPlaylistWithItems(playlistId: string) {
  const { rows: [playlist] } = await db.query('SELECT * FROM playlists WHERE id = $1', [playlistId]);
  if (!playlist) return null;
  const { rows: items } = await db.query(
    `SELECT pi.*, row_to_json(m.*) AS media
     FROM playlist_items pi JOIN media_items m ON m.id = pi.media_item_id
     WHERE pi.playlist_id = $1 ORDER BY pi.position`,
    [playlistId]
  );
  return {
    ...playlist,
    items: items.map(i => ({
      ...i,
      media: {
        ...i.media,
        file_url: i.media.file_path ? publicUrl(i.media.file_path) : null,
        thumbnail_url: i.media.thumbnail_path ? publicUrl(i.media.thumbnail_path) : null,
        slides: i.media.type === 'pptx' && i.media.slide_count
          ? Array.from({ length: i.media.slide_count }, (_: unknown, idx: number) => publicUrl(`${i.media.file_path}-slide-${idx + 1}.png`))
          : undefined,
      }
    }))
  };
}

export async function playlistRoutes(app: FastifyInstance) {
  app.get('/api/playlists', async (_req, reply) => {
    const { rows } = await db.query('SELECT * FROM playlists ORDER BY created_at DESC');
    return reply.send(rows);
  });

  app.post('/api/playlists', async (req, reply) => {
    const { name, loop = true } = req.body as { name: string; loop?: boolean };
    const { rows } = await db.query('INSERT INTO playlists(name, loop) VALUES($1,$2) RETURNING *', [name, loop]);
    return reply.code(201).send(rows[0]);
  });

  app.get('/api/playlists/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const playlist = await getPlaylistWithItems(id);
    if (!playlist) return reply.code(404).send({ error: 'Not found' });
    return reply.send(playlist);
  });

  app.put('/api/playlists/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await getPlaylistWithItems(id);
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    const body = req.body as { name?: string; loop?: boolean; items?: Array<{ id: string; position: number; duration_seconds?: number }> };
    if (body.name !== undefined || body.loop !== undefined) {
      await db.query('UPDATE playlists SET name=COALESCE($1,name), loop=COALESCE($2,loop) WHERE id=$3', [body.name ?? null, body.loop ?? null, id]);
    }
    if (body.items) {
      for (const item of body.items) {
        await db.query('UPDATE playlist_items SET position=$1, duration_seconds=COALESCE($2,duration_seconds) WHERE id=$3', [item.position, item.duration_seconds ?? null, item.id]);
      }
    }
    return reply.send(await getPlaylistWithItems(id));
  });

  app.delete('/api/playlists/:id', async (req, reply) => {
    await db.query('DELETE FROM playlists WHERE id=$1', [(req.params as { id: string }).id]);
    return reply.code(204).send();
  });

  app.post('/api/playlists/:id/items', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { media_item_id, position, duration_seconds, transition = 'fade' } = req.body as { media_item_id: string; position?: number; duration_seconds?: number; transition?: string };
    const { rows: [{ max_pos }] } = await db.query('SELECT COALESCE(MAX(position), -1) AS max_pos FROM playlist_items WHERE playlist_id=$1', [id]);
    const pos = position ?? (max_pos + 1);
    const { rows } = await db.query(
      'INSERT INTO playlist_items(playlist_id,media_item_id,position,duration_seconds,transition) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [id, media_item_id, pos, duration_seconds ?? null, transition]
    );
    return reply.code(201).send(rows[0]);
  });

  app.delete('/api/playlists/:id/items/:itemId', async (req, reply) => {
    await db.query('DELETE FROM playlist_items WHERE id=$1', [(req.params as { id: string; itemId: string }).itemId]);
    return reply.code(204).send();
  });
}
