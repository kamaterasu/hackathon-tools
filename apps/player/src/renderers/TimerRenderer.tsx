import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';

interface Props { duration: number; onComplete: () => void }

export function TimerRenderer({ duration, onComplete }: Props) {
  const [remaining, setRemaining] = useState(duration);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // tick
  useEffect(() => {
    setRemaining(duration);
    setPaused(false);
  }, [duration]);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(interval); onCompleteRef.current(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paused]);

  // socket commands from admin
  useEffect(() => {
    const handle = ({ action, payload }: { action: string; payload?: { seconds?: number } }) => {
      if (action === 'timer:pause') setPaused(true);
      else if (action === 'timer:resume') setPaused(false);
      else if (action === 'timer:toggle') setPaused(p => !p);
      else if (action === 'timer:restart') { setRemaining(duration); setPaused(false); }
      else if (action === 'timer:adjust') {
        const s = payload?.seconds ?? 0;
        setRemaining(r => Math.max(0, r + s));
      }
    };
    socket.on('screen:command', handle);
    return () => { socket.off('screen:command', handle); };
  }, [duration]);

  const adjust = (s: number) => setRemaining(r => Math.max(0, r + s));
  const restart = () => { setRemaining(duration); setPaused(false); };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : String(secs);

  return (
    <div
      style={{ width: '100%', height: '100%', background: '#000', position: 'relative', cursor: 'pointer' }}
      onClick={() => setShowControls(v => !v)}
    >
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          fontSize: '15vw', fontWeight: 700, color: paused ? '#888' : '#fff',
          fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace',
          transition: 'color 0.2s',
        }}>
          {display}
        </span>
        {paused && (
          <span style={{ position: 'absolute', top: '1rem', right: '1.5rem', color: '#666', fontSize: '1.1rem', fontFamily: 'sans-serif' }}>
            ⏸ PAUSED
          </span>
        )}
      </div>

      {showControls && (
        <div
          style={{
            position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: '0.75rem', alignItems: 'center',
            background: 'rgba(0,0,0,0.85)', borderRadius: '1rem', padding: '0.75rem 1.25rem',
            border: '1px solid #333',
          }}
          onClick={e => e.stopPropagation()}
        >
          {[
            { label: '−1m', fn: () => adjust(-60) },
            { label: '−10s', fn: () => adjust(-10) },
            { label: paused ? '▶' : '⏸', fn: () => setPaused(p => !p), highlight: true },
            { label: '↺', fn: restart },
            { label: '+10s', fn: () => adjust(10) },
            { label: '+1m', fn: () => adjust(60) },
          ].map(({ label, fn, highlight }) => (
            <button
              key={label}
              onClick={fn}
              style={{
                background: highlight ? '#2563eb' : '#222',
                color: '#fff', border: '1px solid #444',
                borderRadius: '0.5rem', padding: '0.4rem 0.8rem',
                fontSize: '1rem', cursor: 'pointer', fontFamily: 'monospace',
                minWidth: '2.5rem',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
