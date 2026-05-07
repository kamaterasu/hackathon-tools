import { useEffect, useState } from 'react';

interface Props { slides: string[]; duration: number; initialElapsed?: number }

export function SlideRenderer({ slides, duration, initialElapsed = 0 }: Props) {
  const perSlide = duration / slides.length;
  // Start on whichever slide we're currently in based on elapsed time
  const startSlide = Math.min(
    Math.floor((initialElapsed / 1000) / perSlide),
    slides.length - 1,
  );

  const [idx, setIdx] = useState(startSlide);
  const [broken, setBroken] = useState(false);

  useEffect(() => { setIdx(startSlide); setBroken(false); }, [slides, startSlide]);

  useEffect(() => {
    // For the current slide, only wait the remaining portion of its slot
    const elapsedIntoSlide = (initialElapsed / 1000) % perSlide;
    const delay = idx === startSlide
      ? Math.max(0, (perSlide - elapsedIntoSlide) * 1000)
      : perSlide * 1000;

    const t = setTimeout(() => {
      if (idx < slides.length - 1) { setIdx(i => i + 1); setBroken(false); }
      // Last slide: hold until server advances to next playlist item
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, perSlide, slides.length]);

  if (broken) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#444', fontSize: 14 }}>
        Slide unavailable
      </div>
    );
  }

  return (
    <img src={slides[idx]} alt={`Slide ${idx + 1}`}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      onError={() => setBroken(true)} />
  );
}
