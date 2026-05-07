import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';

interface Props { duration: number; initialElapsed?: number }

export function TimerRenderer({ duration, initialElapsed = 0 }: Props) {
  // Wall-clock anchor: startTimeRef mirrors the server's started_at so all screens
  // compute identical remaining values instead of drifting with independent setInterval ticks.
  const startTimeRef = useRef(Date.now() - (initialElapsed ?? 0));
  const pausedAtRef = useRef(0);
  const [remaining, setRemaining] = useState(
    Math.max(0, duration - Math.floor((initialElapsed ?? 0) / 1000))
  );
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Re-anchor when a new screen:sync arrives (new duration or initialElapsed).
  useEffect(() => {
    startTimeRef.current = Date.now() - (initialElapsed ?? 0);
    setRemaining(Math.max(0, duration - Math.floor((initialElapsed ?? 0) / 1000)));
    setPaused(false);
  }, [duration, initialElapsed]);

  // Tick: derive remaining from wall clock instead of counting blindly.
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setRemaining(Math.max(0, duration - Math.floor(elapsed / 1000)));
    }, 200);
    return () => clearInterval(interval);
  }, [paused, duration]);

  useEffect(() => {
    const handle = ({ action, payload }: { action: string; payload?: { seconds?: number } }) => {
      if (action === 'timer:pause') {
        pausedAtRef.current = Date.now();
        setPaused(true);
      } else if (action === 'timer:resume') {
        // Shift anchor forward by pause duration so elapsed is unaffected.
        startTimeRef.current += Date.now() - pausedAtRef.current;
        setPaused(false);
      } else if (action === 'timer:toggle') {
        setPaused(p => {
          if (p) {
            startTimeRef.current += Date.now() - pausedAtRef.current;
          } else {
            pausedAtRef.current = Date.now();
          }
          return !p;
        });
      } else if (action === 'timer:restart') {
        startTimeRef.current = Date.now();
        setRemaining(duration);
        setPaused(false);
      } else if (action === 'timer:adjust') {
        // Mirror server's adjustTimerClock: startedAt += seconds * 1000.
        const s = payload?.seconds ?? 0;
        startTimeRef.current += s * 1000;
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
