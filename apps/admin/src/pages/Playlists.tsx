import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, Trash2 } from "lucide-react";
import { api } from "../api/index.js";

type Item = {
  id: string;
  media: { name: string; type: string };
  duration_seconds?: number;
};
type PlaylistDetail = { id: string; name: string; items: Item[] };
type Playlist = { id: string; name: string };
type MediaItem = { id: string; name: string };

function SortableItem({
  item,
  onRemove,
  onDurationChange,
}: {
  item: Item;
  onRemove: () => void;
  onDurationChange: (seconds: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-600 touch-none"
      >
        <GripVertical size={16} />
      </span>
      <span className="flex-1 text-sm">{item.media.name}</span>
      <span className="text-xs text-gray-500 uppercase">{item.media.type}</span>
      <input
        type="number"
        min={1}
        className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-center"
        defaultValue={item.duration_seconds ?? 10}
        onBlur={(e) => onDurationChange(Number(e.target.value))}
        onClick={(e) => e.stopPropagation()}
      />
      <span className="text-xs text-gray-600">s</span>
      <button
        onClick={onRemove}
        className="text-gray-600 hover:text-red-400 ml-1"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function Playlists() {
  const qc = useQueryClient();
  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: api.playlists.list,
  });
  const { data: media = [] } = useQuery({
    queryKey: ["media"],
    queryFn: api.media.list,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const { data: detail } = useQuery({
    queryKey: ["playlists", selected],
    queryFn: () => api.playlists.get(selected!),
    enabled: !!selected,
  });
  const [newName, setNewName] = useState("");

  const deletePlaylist = useMutation({
    mutationFn: (id: string) => api.playlists.delete(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      if (selected === id) setSelected(null);
    },
  });

  const create = useMutation({
    mutationFn: () => api.playlists.create({ name: newName }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      setSelected((p as Playlist).id);
      setNewName("");
    },
  });

  const addItem = useMutation({
    mutationFn: (media_item_id: string) =>
      api.playlists.addItem(selected!, { media_item_id }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["playlists", selected] }),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => api.playlists.removeItem(selected!, itemId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["playlists", selected] }),
  });

  const updateItem = useMutation({
    mutationFn: ({
      itemId,
      duration_seconds,
    }: {
      itemId: string;
      duration_seconds: number;
    }) => {
      const d = detail as PlaylistDetail | undefined;
      if (!d) return Promise.resolve();
      const items = d.items.map((item, position) => ({
        id: item.id,
        position,
        duration_seconds:
          item.id === itemId ? duration_seconds : item.duration_seconds,
      }));
      return api.playlists.update(selected!, { items });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["playlists", selected] }),
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!detail || !event.over || event.active.id === event.over.id) return;
    const d = detail as PlaylistDetail;
    const oldIdx = d.items.findIndex((i) => i.id === event.active.id);
    const newIdx = d.items.findIndex((i) => i.id === event.over!.id);
    const reordered = arrayMove(d.items, oldIdx, newIdx);
    await api.playlists.update(selected!, {
      items: reordered.map((item, position) => ({ id: item.id, position })),
    });
    qc.invalidateQueries({ queryKey: ["playlists", selected] });
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
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName && create.mutate()}
          />
          <button
            onClick={() => create.mutate()}
            disabled={!newName}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 p-2 rounded-lg"
          >
            <Plus size={16} />
          </button>
        </div>
        {(playlists as Playlist[]).map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-1 rounded-lg mb-1 transition-colors ${
              selected === p.id
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-800 text-gray-300"
            }`}
          >
            <button
              onClick={() => setSelected(p.id)}
              className="flex-1 text-left px-3 py-2 text-sm"
            >
              {p.name}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deletePlaylist.mutate(p.id);
              }}
              className="pr-2 text-gray-500 hover:text-red-400 transition-colors"
              title="Delete playlist"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {playlists.length === 0 && (
          <p className="text-gray-500 text-xs">No playlists yet.</p>
        )}
      </div>

      {selected && d && (
        <div className="flex-1">
          <h2 className="text-lg font-semibold mb-4">{d.name}</h2>
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-4"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                addItem.mutate(e.target.value);
                (e.target as HTMLSelectElement).value = "";
              }
            }}
          >
            <option value="">+ Add media item...</option>
            {(media as MediaItem[]).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {d.items.length === 0 && (
            <p className="text-gray-500 text-sm">
              No items yet. Add media above.
            </p>
          )}

          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={d.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {d.items.map((item) => (
                  <SortableItem
                    key={`${item.id}-${item.duration_seconds ?? 10}`}
                    item={item}
                    onRemove={() => removeItem.mutate(item.id)}
                    onDurationChange={(seconds) =>
                      updateItem.mutate({
                        itemId: item.id,
                        duration_seconds: seconds,
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {selected && !d && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Loading...
        </div>
      )}
    </div>
  );
}
