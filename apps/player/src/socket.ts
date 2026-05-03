import { io, Socket } from 'socket.io-client';

export const socket: Socket = io({
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  autoConnect: false,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
});
