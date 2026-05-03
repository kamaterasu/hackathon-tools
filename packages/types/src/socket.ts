import type { PlaylistWithItems, CommandAction } from './api.js';
import type { ScreenStatus } from './db.js';

export interface ServerToClientEvents {
  'screen:command': (data: { action: CommandAction; payload?: Record<string, unknown> }) => void;
  'screen:sync': (data: { playlist: PlaylistWithItems | null; current_index: number }) => void;
  'screen:status': (data: { screenId: string; status: ScreenStatus }) => void;
}

export interface ClientToServerEvents {
  'screen:register': (data: { screenId: string; apiKey: string }) => void;
  'screen:heartbeat': () => void;
}
