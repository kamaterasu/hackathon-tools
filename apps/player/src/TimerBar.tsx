import { useEffect, useState } from 'react';

interface Props { duration: number; onComplete: () => void }

export function TimerBar({ duration, onComplete }: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    const interval = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / (duration * 1000)) * 100, 100);
      setProgress(pct);
      if (pct >= 100) { clearInterval(interval); onComplete(); }
    }, 100);
    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.1)', zIndex: 100 }}>
      <div style={{ height: '100%', background: '#3b82f6', width: `${progress}%`, transition: 'width 0.1s linear' }} />
    </div>
  );
}
