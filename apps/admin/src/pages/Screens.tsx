import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Plus, Wifi, WifiOff } from 'lucide-react';
import { api } from '../api/index.js';
import { socket } from '../socket.js';

type Screen = { id: string; name: string; location?: string; status: string; playlist_name?: string };

export function Screens() {
  const qc = useQueryClient();
  const { data: screens = [], isLoading } = useQuery({ queryKey: ['screens'], queryFn: api.screens.list });
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  const create = useMutation({
    mutationFn: () => api.screens.create({ name, location: location || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screens'] });
      setShowCreate(false);
      setName('');
      setLocation('');
    },
  });

  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ['screens'] });
    socket.on('screen:status', handler);
    return () => { socket.off('screen:status', handler); };
  }, [qc]);

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Screens</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Add Screen
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-gray-900 border border-gray-700 rounded-xl p-4 max-w-md">
          <h2 className="text-sm font-semibold mb-3">New Screen</h2>
          <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-2"
            placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-3"
            placeholder="Location (optional)" value={location} onChange={e => setLocation(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => create.mutate()} disabled={!name}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-1.5 rounded-lg text-sm">
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white text-sm px-3">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(screens as Screen[]).map(s => (
          <Link key={s.id} to={`/screens/${s.id}`}
            className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <Monitor size={20} className="text-gray-500" />
              {s.status === 'online'
                ? <span className="flex items-center gap-1.5 text-xs text-green-400"><Wifi size={12} /> Online</span>
                : <span className="flex items-center gap-1.5 text-xs text-gray-500"><WifiOff size={12} /> Offline</span>}
            </div>
            <p className="font-semibold">{s.name}</p>
            {s.location && <p className="text-xs text-gray-500 mt-0.5">{s.location}</p>}
            {s.playlist_name && <p className="text-xs text-blue-400 mt-2">▶ {s.playlist_name}</p>}
          </Link>
        ))}
        {screens.length === 0 && <p className="text-gray-500 text-sm col-span-3">No screens registered yet.</p>}
      </div>
    </div>
  );
}
