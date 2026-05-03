import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { db } from '../db/client.js';

let io: SocketIOServer;

export function setupSocket(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    socket.on('screen:register', async ({ screenId, apiKey }: { screenId: string; apiKey: string }) => {
      const { rows } = await db.query('SELECT id FROM screens WHERE id=$1 AND api_key=$2', [screenId, apiKey]);
      if (!rows.length) { socket.disconnect(); return; }
      socket.join(`screen:${screenId}`);
      socket.data.screenId = screenId;
      await db.query("UPDATE screens SET status='online', last_seen_at=now() WHERE id=$1", [screenId]);
      io.emit('screen:status', { screenId, status: 'online' });
    });

    socket.on('screen:heartbeat', async () => {
      const { screenId } = socket.data;
      if (!screenId) return;
      await db.query('UPDATE screens SET last_seen_at=now() WHERE id=$1', [screenId]);
    });

    socket.on('disconnect', async () => {
      const { screenId } = socket.data;
      if (!screenId) return;
      await db.query("UPDATE screens SET status='offline' WHERE id=$1", [screenId]);
      io.emit('screen:status', { screenId, status: 'offline' });
    });
  });

  return io;
}

export function getIo() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
