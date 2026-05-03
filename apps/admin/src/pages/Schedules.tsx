import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { api } from '../api/index.js';

type Screen = { id: string; name: string };
type Playlist = { id: string; name: string };
type Schedule = { id: string; screen_name: string; playlist_name: string; start_at: string; end_at?: string };

const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date()), getDay, locales: {} });

export function Schedules() {
  const qc = useQueryClient();
  const { data: schedules = [] } = useQuery({ queryKey: ['schedules'], queryFn: api.schedules.list });
  const { data: screens = [] } = useQuery({ queryKey: ['screens'], queryFn: api.screens.list });
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: api.playlists.list });
  const [form, setForm] = useState({ screen_id: '', playlist_id: '', start_at: '', end_at: '' });

  const create = useMutation({
    mutationFn: () => api.schedules.create({ ...form, end_at: form.end_at || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      setForm({ screen_id: '', playlist_id: '', start_at: '', end_at: '' });
    },
  });

  const del = useMutation({
    mutationFn: api.schedules.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const events = (schedules as Schedule[]).map(s => ({
    id: s.id,
    title: `${s.screen_name} → ${s.playlist_name}`,
    start: new Date(s.start_at),
    end: s.end_at ? new Date(s.end_at) : new Date(new Date(s.start_at).getTime() + 3600000),
  }));

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Schedules</h1>

      <div style={{ height: 500 }} className="mb-6">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView={Views.WEEK}
          style={{ background: '#111827', color: '#fff' }}
        />
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">New Schedule</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            value={form.screen_id} onChange={e => setForm(v => ({ ...v, screen_id: e.target.value }))}>
            <option value="">Select screen...</option>
            {(screens as Screen[]).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            value={form.playlist_id} onChange={e => setForm(v => ({ ...v, playlist_id: e.target.value }))}>
            <option value="">Select playlist...</option>
            {(playlists as Playlist[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Start</label>
            <input type="datetime-local" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              value={form.start_at} onChange={e => setForm(v => ({ ...v, start_at: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">End (optional)</label>
            <input type="datetime-local" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              value={form.end_at} onChange={e => setForm(v => ({ ...v, end_at: e.target.value }))} />
          </div>
        </div>
        <button onClick={() => create.mutate()}
          disabled={!form.screen_id || !form.playlist_id || !form.start_at}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-2 rounded-lg text-sm">
          <Plus size={14} /> Create Schedule
        </button>
      </div>

      <div className="space-y-2">
        {(schedules as Schedule[]).map(s => (
          <div key={s.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium">{s.screen_name} → {s.playlist_name}</p>
              <p className="text-xs text-gray-500">
                {new Date(s.start_at).toLocaleString()}
                {s.end_at && ` → ${new Date(s.end_at).toLocaleString()}`}
              </p>
            </div>
            <button onClick={() => del.mutate(s.id)} className="text-gray-600 hover:text-red-400 p-1">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {schedules.length === 0 && <p className="text-gray-500 text-sm">No schedules yet.</p>}
      </div>
    </div>
  );
}
