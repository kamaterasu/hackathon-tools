import { useEffect, useState } from 'react';

interface Props { slides: string[]; duration: number; onComplete: () => void }

export function SlideRenderer({ slides, duration, onComplete }: Props) {
  const [idx, setIdx] = useState(0);
  const perSlide = duration / slides.length;

  useEffect(() => { setIdx(0); }, [slides]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (idx < slides.length - 1) setIdx(i => i + 1);
      else onComplete();
    }, perSlide * 1000);
    return () => clearTimeout(t);
  }, [idx, perSlide, slides.length, onComplete]);

  return (
    <img src={slides[idx]} alt={`Slide ${idx + 1}`}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
  );
}
