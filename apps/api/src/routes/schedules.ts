import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';

export async function scheduleRoutes(app: FastifyInstance) {
  app.get('/api/schedules', async (_req, reply) => {
    const { rows } = await db.query(
      `SELECT s.*, sc.name AS screen_name, p.name AS playlist_name
       FROM schedules s JOIN screens sc ON sc.id=s.screen_id JOIN playlists p ON p.id=s.playlist_id
       ORDER BY s.start_at`
    );
    return reply.send(rows);
  });

  app.post('/api/schedules', async (req, reply) => {
    const { screen_id, playlist_id, start_at, end_at, recurrence } = req.body as { screen_id: string; playlist_id: string; start_at: string; end_at?: string; recurrence?: string };
    const { rows } = await db.query(
      'INSERT INTO schedules(screen_id,playlist_id,start_at,end_at,recurrence) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [screen_id, playlist_id, start_at, end_at ?? null, recurrence ?? null]
    );
    return reply.code(201).send(rows[0]);
  });

  app.delete('/api/schedules/:id', async (req, reply) => {
    await db.query('DELETE FROM schedules WHERE id=$1', [(req.params as { id: string }).id]);
    return reply.code(204).send();
  });
}
