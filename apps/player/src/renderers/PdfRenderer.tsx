import { useEffect } from 'react';

interface Props { url: string; duration: number; initialElapsed?: number }

export function PdfRenderer({ url, duration, initialElapsed = 0 }: Props) {
  useEffect(() => {
    const remaining = Math.max(0, duration * 1000 - (initialElapsed ?? 0));
    // Just hold the PDF — server clock will advance to next item
    const t = setTimeout(() => {}, remaining);
    return () => clearTimeout(t);
  }, [duration, initialElapsed]);

  return (
    <embed
      src={url}
      type="application/pdf"
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
    />
  );
}
