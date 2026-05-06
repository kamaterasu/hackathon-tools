import { io, type Socket } from 'socket.io-client';
export const socket: Socket = io(import.meta.env.VITE_API_URL ?? '', { path: '/socket.io', transports: ['websocket', 'polling'] });
