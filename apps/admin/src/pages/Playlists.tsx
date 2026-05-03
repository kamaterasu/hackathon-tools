import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { api } from '../api/index.js';

type Item = { id: string; media: { name: string; type: string } };
type PlaylistDetail = { id: string; name: string; items: Item[] };
type Playlist = { id: string; name: string };
type MediaItem = { id: string; name: string };

function SortableItem({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
      <span {...attributes} {...listeners} className="cursor-grab text-gray-600 touch-none"><GripVertical size={16} /></span>
      <span className="flex-1 text-sm">{item.media.name}</span>
      <span className="text-xs text-gray-500 uppercase">{item.media.type}</span>
      <button onClick={onRemove} className="text-gray-600 hover:text-red-400 ml-1"><Trash2 size={14} /></button>
    </div>
  );
}

export function Playlists() {
  const qc = useQueryClient();
  const { data: playlists = [] } = useQuery({ queryKey: ['playlists'], queryFn: api.playlists.list });
  const { data: media = [] } = useQuery({ queryKey: ['media'], queryFn: api.media.list });
  const [selected, setSelected] = useState<string | null>(null);
  const { data: detail } = useQuery({
    queryKey: ['playlists', selected],
    queryFn: () => api.playlists.get(selected!),
    enabled: !!selected,
  });
  const [newName, setNewName] = useState('');

  const create = useMutation({
    mutationFn: () => api.playlists.create({ name: newName }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['playlists'] });
      setSelected((p as Playlist).id);
      setNewName('');
    },
  });

  const addItem = useMutation({
    mutationFn: (media_item_id: string) => api.playlists.addItem(selected!, { media_item_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playlists', selected] }),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => api.playlists.removeItem(selected!, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playlists', selected] }),
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!detail || !event.over || event.active.id === event.over.id) return;
    const d = detail as PlaylistDetail;
    const oldIdx = d.items.findIndex(i => i.id === event.active.id);
    const newIdx = d.items.findIndex(i => i.id === event.over!.id);
    const reordered = arrayMove(d.items, oldIdx, newIdx);
    await api.playlists.update(selected!, { items: reordered.map((item, position) => ({ id: item.id, position })) });
    qc.invalidateQueries({ queryKey: ['playlists', selected] });
  };

  const d = detail as PlaylistDetail | undefined;

  return (
    <div className="p-8 flex gap-6">
      <div className="w-64 shrink-0">
        <h1 className="text-lg font-bold mb-4">Playlists</h1>
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            placeholder="New playlist..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newName && create.mutate()}
          />
          <button onClick={() => create.mutate()} disabled={!newName}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 p-2 rounded-lg">
            <Plus size={16} />
          </button>
        </div>
        {(playlists as Playlist[]).map(p => (
          <button key={p.id} onClick={() => setSelected(p.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
              selected === p.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-300'
            }`}>
            {p.name}
          </button>
        ))}
        {playlists.length === 0 && <p className="text-gray-500 text-xs">No playlists yet.</p>}
      </div>

      {selected && d && (
        <div className="flex-1">
          <h2 className="text-lg font-semibold mb-4">{d.name}</h2>
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-4"
            defaultValue=""
            onChange={e => {
              if (e.target.value) {
                addItem.mutate(e.target.value);
                (e.target as HTMLSelectElement).value = '';
              }
            }}>
            <option value="">+ Add media item...</option>
            {(media as MediaItem[]).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          {d.items.length === 0 && <p className="text-gray-500 text-sm">No items yet. Add media above.</p>}

          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={d.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {d.items.map(item => (
                  <SortableItem key={item.id} item={item} onRemove={() => removeItem.mutate(item.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {selected && !d && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Loading...</div>
      )}
    </div>
  );
}
