import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac } from 'crypto';

const SECRET = process.env.ADMIN_JWT_SECRET ?? 'dev-secret-change-me';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin';

// Stateless token: HMAC(secret, password) — changes if either env var changes.
export function makeToken(): string {
  return createHmac('sha256', SECRET).update(PASSWORD).digest('hex');
}

export function verifyToken(token: string): boolean {
  return token === makeToken();
}

// Routes that skip auth entirely (player-facing or public)
const PUBLIC_ROUTES: Array<{ method: string; path: RegExp }> = [
  { method: 'POST', path: /^\/api\/auth\/login$/ },
  { method: 'POST', path: /^\/api\/screens\/auto-register$/ },
  { method: 'GET',  path: /^\/api\/player\// },
  { method: 'GET',  path: /^\/api\/media\/proxy\// },
];

export function isPublicRoute(method: string, url: string): boolean {
  return PUBLIC_ROUTES.some(r => r.method === method && r.path.test(url));
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const { password } = (req.body ?? {}) as { password?: string };
    if (password !== PASSWORD) {
      return reply.code(401).send({ error: 'Invalid password' });
    }
    return reply.send({ token: makeToken() });
  });
}
