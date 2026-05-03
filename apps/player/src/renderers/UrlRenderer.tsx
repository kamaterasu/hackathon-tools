export function UrlRenderer({ url }: { url: string }) {
  return (
    <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }}
      sandbox="allow-scripts allow-same-origin allow-popups" />
  );
}
