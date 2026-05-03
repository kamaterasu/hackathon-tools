import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';

export async function requireApiKey(req: FastifyRequest, reply: FastifyReply) {
  const key = req.headers['x-api-key'] as string;
  if (!key) { reply.code(401).send({ error: 'Missing API key' }); return; }
  const { rows } = await db.query('SELECT id FROM screens WHERE api_key = $1', [key]);
  if (!rows.length) { reply.code(401).send({ error: 'Invalid API key' }); return; }
}
