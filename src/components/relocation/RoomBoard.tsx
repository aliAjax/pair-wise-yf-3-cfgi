import { useMemo, useState } from 'react';
import { DoorOpen, Pencil, Trash2, Plus, Check, X, Users } from 'lucide-react';
import { useMemoryStore } from '@/store/memoryStore';

export default function RoomBoard() {
  const { rooms, memories, addRoom, updateRoomCapacity, deleteRoom } = useMemoryStore();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCapacity, setNewCapacity] = useState(3);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCapacity, setEditCapacity] = useState(1);

  const usedMap = useMemo(() => {
    const map = new Map<string, number>();
    memories.forEach((m) => map.set(m.location, (map.get(m.location) ?? 0) + 1));
    return map;
  }, [memories]);

  const unassigned = useMemo(
    () => new Set(memories.map((m) => m.location).filter((loc) => !rooms.some((r) => r.name === loc))),
    [memories, rooms],
  );

  const commitAdd = () => {
    const res = addRoom(newName, newCapacity);
    if (!res.ok) {
      setError(res.error ?? '创建失败');
      return;
    }
    setAdding(false);
    setNewName('');
    setNewCapacity(3);
    setError('');
  };

  const startEdit = (id: string, capacity: number) => {
    setEditingId(id);
    setEditCapacity(capacity);
  };

  const commitEdit = (id: string) => {
    const res = updateRoomCapacity(id, editCapacity);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    setEditingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`确认删除房间「${name}」吗？房间清空且无待确认批次时才能删除。`)) return;
    const res = deleteRoom(id);
    if (!res.ok) window.alert(res.error);
  };

  return (
    <section className="bg-paper-50/80 backdrop-blur rounded-2xl border border-paper-300 p-5 shadow-paper">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-ochre-600" />
          <h3 className="font-hand text-xl text-ochre-600">房间容量</h3>
          <span className="text-xs text-ink-700/50">· {rooms.length} 间房</span>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-secondary !py-1.5 !px-3 text-sm">
            <Plus className="w-4 h-4" /> 新建房间
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4 rounded-xl border border-ochre-300 bg-ochre-50/60 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitAdd()}
              placeholder="房间名称（需与记忆里的地点一致才能被识别为原房间）"
              className="scent-input"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-700/70 shrink-0">容量</span>
              <input
                type="number"
                min={1}
                value={newCapacity}
                onChange={(e) => setNewCapacity(Math.max(1, Number(e.target.value)))}
                className="scent-input"
              />
            </div>
          </div>
          {error && <p className="text-xs text-brick-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAdding(false); setError(''); }} className="btn-ghost !py-1.5 text-sm">
              <X className="w-4 h-4" /> 取消
            </button>
            <button onClick={commitAdd} className="btn-primary !py-1.5 text-sm">
              <Check className="w-4 h-4" /> 创建
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {rooms.map((room) => {
          const used = usedMap.get(room.name) ?? 0;
          const pct = Math.min(100, Math.round((used / room.capacity) * 100));
          const full = used >= room.capacity;
          return (
            <div key={room.id} className="rounded-xl border border-paper-300 bg-paper-50 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-serif text-base font-semibold text-ink-800 truncate">{room.name}</h4>
                  {editingId === room.id ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={editCapacity}
                        onChange={(e) => setEditCapacity(Math.max(1, Number(e.target.value)))}
                        className="scent-input !py-0.5 !px-2 w-16 text-sm"
                      />
                      <span className="text-[11px] text-ink-700/60">/ 容量（已住 {used}）</span>
                      <button onClick={() => commitEdit(room.id)} className="p-1 rounded text-moss-600 hover:bg-moss-100">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 rounded text-brick-500 hover:bg-brick-500/10">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className={`text-[11px] mt-0.5 inline-flex items-center gap-1 ${full ? 'text-brick-600' : 'text-moss-600'}`}>
                      <Users className="w-3 h-3" />
                      {used} / {room.capacity} 条记忆{full ? '（已满）' : `（余 ${room.capacity - used}）`}
                    </p>
                  )}
                </div>
                {editingId !== room.id && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => startEdit(room.id, room.capacity)}
                      className="p-1.5 rounded-lg text-ochre-600 hover:bg-ochre-100 transition-colors"
                      title="调整容量"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id, room.name)}
                      className="p-1.5 rounded-lg text-brick-500 hover:bg-brick-500/10 transition-colors"
                      title="删除房间"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2.5 h-2 rounded-full bg-paper-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: full
                      ? 'linear-gradient(90deg,#CD5C5C,#A0522D)'
                      : 'linear-gradient(90deg,#CFDBD3 0%,#7DA08C 100%)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {unassigned.size > 0 && (
        <p className="mt-4 text-xs text-brick-600/90">
          ⚠ 还有 {unassigned.size} 个未登记房间的位置：{Array.from(unassigned).map((l) => `「${l}」`).join('、')}
        </p>
      )}
    </section>
  );
}
