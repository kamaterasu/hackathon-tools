import { useEffect } from 'react';

interface Props { url: string; duration: number; onComplete: () => void }

export function PdfRenderer({ url, duration, onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(onComplete, duration * 1000);
    return () => clearTimeout(t);
  }, [duration, onComplete]);

  return (
    <embed
      src={url}
      type="application/pdf"
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
    />
  );
}
