import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Trash2, Upload, Film, Image as ImgIcon, Presentation, Globe, Timer } from 'lucide-react';
import { api } from '../api/index.js';

type MediaItem = { id: string; name: string; type: string; thumbnail_url?: string; slide_count?: number; duration_seconds?: number };
const icons = { image: ImgIcon, video: Film, pptx: Presentation, url: Globe, timer: Timer } as const;

export function Media() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ['media'], queryFn: api.media.list });
  const [urlForm, setUrlForm] = useState({ name: '', url: '', duration: '30' });
  const [showUrl, setShowUrl] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [timerForm, setTimerForm] = useState({ name: '', duration: '10' });
  const [uploading, setUploading] = useState(false);

  const del = useMutation({
    mutationFn: api.media.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });

  const addUrl = useMutation({
    mutationFn: () => api.media.addUrl({ name: urlForm.name, url: urlForm.url, duration_seconds: Number(urlForm.duration) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['media'] }); setShowUrl(false); setUrlForm({ name: '', url: '', duration: '30' }); },
  });

  const addTimer = useMutation({
    mutationFn: () => api.media.addTimer({ name: timerForm.name, duration_seconds: Number(timerForm.duration) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['media'] }); setShowTimer(false); setTimerForm({ name: '', duration: '10' }); },
  });

  const [uploadError, setUploadError] = useState<string | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    setUploading(true);
    setUploadError(null);
    try {
      for (const f of files) await api.media.upload(f);
      qc.invalidateQueries({ queryKey: ['media'] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [qc]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Media Library</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowTimer(v => !v); setShowUrl(false); }}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm">
            <Timer size={14} /> Add Timer
          </button>
          <button onClick={() => { setShowUrl(v => !v); setShowTimer(false); }}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm">
            <Globe size={14} /> Add URL
          </button>
        </div>
      </div>

      <div {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500'
        }`}>
        <input {...getInputProps()} />
        <Upload size={24} className="mx-auto mb-2 text-gray-500" />
        <p className="text-sm text-gray-400">
          {uploading ? 'Uploading...' : isDragActive ? 'Drop here...' : 'Drag & drop or click to upload (images, videos, PPTX)'}
        </p>
      </div>

      {uploadError && (
        <p className="text-sm text-red-400 mb-4">{uploadError}</p>
      )}

      {showTimer && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6 max-w-md">
          <h2 className="text-sm font-semibold mb-3">Add Timer</h2>
          <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-2"
            placeholder="Name (e.g. Break)" value={timerForm.name} onChange={e => setTimerForm(v => ({ ...v, name: e.target.value }))} />
          <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-3"
            type="number" min="1" placeholder="Duration (seconds)" value={timerForm.duration}
            onChange={e => setTimerForm(v => ({ ...v, duration: e.target.value }))} />
          <div className="flex gap-2">
            <button onClick={() => addTimer.mutate()} disabled={!timerForm.name || !timerForm.duration}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-1.5 rounded-lg text-sm">Add</button>
            <button onClick={() => setShowTimer(false)} className="text-gray-400 hover:text-white text-sm px-3">Cancel</button>
          </div>
        </div>
      )}

      {showUrl && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6 max-w-md">
          <h2 className="text-sm font-semibold mb-3">Add Web URL</h2>
          <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-2"
            placeholder="Name" value={urlForm.name} onChange={e => setUrlForm(v => ({ ...v, name: e.target.value }))} />
          <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-2"
            placeholder="https://..." value={urlForm.url} onChange={e => setUrlForm(v => ({ ...v, url: e.target.value }))} />
          <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-3"
            type="number" placeholder="Duration (s)" value={urlForm.duration}
            onChange={e => setUrlForm(v => ({ ...v, duration: e.target.value }))} />
          <div className="flex gap-2">
            <button onClick={() => addUrl.mutate()} disabled={!urlForm.name || !urlForm.url}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-1.5 rounded-lg text-sm">Add</button>
            <button onClick={() => setShowUrl(false)} className="text-gray-400 hover:text-white text-sm px-3">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {(items as MediaItem[]).map(item => {
          const Icon = icons[item.type as keyof typeof icons] ?? ImgIcon;
          return (
            <div key={item.id} className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
                {item.thumbnail_url
                  ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  : <Icon size={32} className="text-gray-600" />}
                <button onClick={() => del.mutate(item.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 p-1.5 rounded-lg transition-opacity">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="p-2.5">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-gray-500 uppercase">{item.type}</p>
              </div>
              {item.type === 'pptx' && item.slide_count != null && item.slide_count > 0 && (
                <div className="px-2.5 pb-2">
                  <p className="text-xs text-gray-500">{item.slide_count} slide{item.slide_count !== 1 ? 's' : ''}</p>
                </div>
              )}
              {item.type === 'timer' && (
                <div className="px-2.5 pb-2">
                  <p className="text-xs text-gray-500">{item.duration_seconds}s</p>
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && <p className="text-gray-500 text-sm col-span-4">No media uploaded yet.</p>}
      </div>
    </div>
  );
}
