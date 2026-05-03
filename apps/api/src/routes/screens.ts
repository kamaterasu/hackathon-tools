import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { db } from '../db/client.js';
import { getIo } from '../socket/index.js';

export async function screenRoutes(app: FastifyInstance) {
  app.get('/api/screens', async (_req, reply) => {
    const { rows } = await db.query(
      'SELECT s.*, p.name AS playlist_name FROM screens s LEFT JOIN playlists p ON p.id = s.current_playlist_id ORDER BY s.created_at'
    );
    return reply.send(rows);
  });

  app.post('/api/screens', async (req, reply) => {
    const { name, location } = req.body as { name: string; location?: string };
    const apiKey = randomUUID();
    const { rows } = await db.query('INSERT INTO screens(name,location,api_key) VALUES($1,$2,$3) RETURNING *', [name, location ?? null, apiKey]);
    return reply.code(201).send(rows[0]);
  });

  app.get('/api/screens/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows: [screen] } = await db.query('SELECT * FROM screens WHERE id=$1', [id]);
    if (!screen) return reply.code(404).send({ error: 'Not found' });
    const { rows: schedules } = await db.query('SELECT * FROM schedules WHERE screen_id=$1 ORDER BY start_at', [id]);
    const { rows: events } = await db.query('SELECT * FROM screen_events WHERE screen_id=$1 ORDER BY occurred_at DESC LIMIT 50', [id]);
    return reply.send({ ...screen, schedules, events });
  });

  app.put('/api/screens/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows: [check] } = await db.query('SELECT id FROM screens WHERE id=$1', [id]);
    if (!check) return reply.code(404).send({ error: 'Not found' });
    const { name, location, current_playlist_id } = req.body as { name?: string; location?: string; current_playlist_id?: string };
    const { rows: [updated] } = await db.query(
      `UPDATE screens SET name=COALESCE($1,name), location=COALESCE($2,location),
       current_playlist_id=CASE WHEN $3::text IS NOT NULL THEN $3::uuid ELSE current_playlist_id END
       WHERE id=$4 RETURNING *`,
      [name ?? null, location ?? null, current_playlist_id ?? null, id]
    );
    return reply.send(updated);
  });

  app.delete('/api/screens/:id', async (req, reply) => {
    await db.query('DELETE FROM screens WHERE id=$1', [(req.params as { id: string }).id]);
    return reply.code(204).send();
  });

  app.post('/api/screens/:id/command', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows: [screen] } = await db.query('SELECT id FROM screens WHERE id=$1', [id]);
    if (!screen) return reply.code(404).send({ error: 'Screen not found' });
    const { action, payload } = req.body as { action: string; payload?: Record<string, unknown> };
    getIo().to(`screen:${id}`).emit('screen:command', { action, payload });
    await db.query("INSERT INTO screen_events(screen_id,event_type,triggered_by) VALUES($1,$2,'admin')", [id, action]);
    return reply.send({ ok: true });
  });
}
