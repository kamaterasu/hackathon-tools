export function VideoRenderer({ url, onEnded }: { url: string; onEnded: () => void }) {
  return (
    <video key={url} src={url} autoPlay muted playsInline
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      onEnded={onEnded}
    />
  );
}
