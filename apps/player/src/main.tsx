import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from './Player.js';

const params = new URLSearchParams(window.location.search);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Player
      screenId={params.get('screenId') ?? ''}
      apiKey={params.get('apiKey') ?? ''}
    />
  </StrictMode>
);
