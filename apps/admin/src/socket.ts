import { io, type Socket } from 'socket.io-client';
export const socket: Socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
