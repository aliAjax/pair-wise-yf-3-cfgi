import { useMemo, useState } from 'react';
import type { Room, SmellMemory } from '../../utils/constants';
import { getSeasonInfo, getSmellTypeInfo } from '../../utils/constants';
import type { BatchInput, BatchResult } from '../../store/memoryStore';
import { AlertTriangle, PackagePlus } from 'lucide-react';

interface Props {
  memories: SmellMemory[];
  rooms: Room[];
  lockedIds: Set<string>;
  onSubmit: (input: BatchInput) => BatchResult;
  onSuccess: (text: string) => void;
}

export default function BatchForm({ memories, rooms, lockedIds, onSubmit, onSuccess }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [handoverDate, setHandoverDate] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const occupancy = useMemo(() => {
    const map: Record<string, number> = {};
    memories.forEach((m) => {
      if (m.room_id) map[m.room_id] = (map[m.room_id] ?? 0) + 1;
    });
    return map;
  }, [memories]);

  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name ?? null;

  // 已归档的按房间聚拢，未归档的排在最后（醒目提示）
  const sortedMemories = useMemo(() => {
    return [...memories].sort((a, b) => {
      if (!a.room_id && !b.room_id) return 0;
      if (!a.room_id) return 1;
      if (!b.room_id) return -1;
      return a.room_id.localeCompare(b.room_id);
    });
  }, [memories]);

  const toggle = (id: string) => {
    setErrors([]);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const count = selected.length;
    const result = onSubmit({
      memory_ids: selected,
      target_room_id: targetRoomId,
      handover_date: handoverDate,
      reason,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSelected([]);
    setTargetRoomId('');
    setHandoverDate('');
    setReason('');
    setErrors([]);
    onSuccess(`搬迁批次已创建：${count} 条记忆已锁定，确认后将正式换房`);
  };

  return (
    <section className="mb-8">
      <div className="bg-paper-50/80 backdrop-blur rounded-2xl border border-paper-300 p-5 md:p-6 shadow-paper">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
            <PackagePlus className="w-5 h-5" />
            新建搬迁批次
          </h3>
          <span className="text-xs text-ink-700/50">至少选择两条记忆</span>
        </div>
        <p className="text-xs text-ink-700/55 mb-4">
          批次创建后记忆即刻锁定；确认后正式换房并留档，取消批次则完整回滚。
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-ink-700">
                选择记忆
                <span className={`ml-2 font-semibold ${selected.length >= 2 ? 'text-moss-600' : 'text-ochre-600'}`}>
                  已选 {selected.length} 条
                </span>
              </label>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="text-xs text-brick-500 hover:underline"
                >
                  清空选择
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {sortedMemories.map((m) => {
                const locked = lockedIds.has(m.id);
                const checked = selected.includes(m.id);
                const stype = getSmellTypeInfo(m.smell_type);
                const season = getSeasonInfo(m.season);
                const rname = roomName(m.room_id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={locked}
                    onClick={() => toggle(m.id)}
                    title={locked ? '该记忆已在进行中的搬迁批次里' : undefined}
                    className={`relative text-left p-3 rounded-xl border transition-all duration-200 ${
                      locked
                        ? 'bg-paper-100/50 border-paper-200 opacity-60 cursor-not-allowed'
                        : checked
                          ? 'bg-ochre-100/70 border-ochre-400 ring-2 ring-ochre-300'
                          : 'bg-paper-100/60 border-paper-200 hover:bg-paper-200/70 hover:border-paper-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span>{season.emoji}</span>
                      <span>{stype.emoji}</span>
                      <span className="text-sm font-medium text-ink-800 truncate">{m.location}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={rname ? 'text-ink-700/60' : 'text-brick-500 font-medium'}>
                        {rname ? `🏠 ${rname}` : '📦 未归档'}
                      </span>
                      {locked ? (
                        <span className="text-ochre-600">🔒 批次中</span>
                      ) : checked ? (
                        <span className="text-ochre-600 font-semibold">✓ 已选</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">目标房间 *</label>
              <select
                value={targetRoomId}
                onChange={(e) => { setErrors([]); setTargetRoomId(e.target.value); }}
                className="scent-input scent-select"
              >
                <option value="">请选择目标房间</option>
                {rooms.map((r) => {
                  const occ = occupancy[r.id] ?? 0;
                  return (
                    <option key={r.id} value={r.id}>
                      {r.emoji} {r.name} · 剩余 {r.capacity - occ}/{r.capacity}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">交接日 *</label>
              <input
                type="date"
                value={handoverDate}
                onChange={(e) => { setErrors([]); setHandoverDate(e.target.value); }}
                className="scent-input"
              />
              <p className="text-[11px] text-ink-700/50 mt-1">不得早于批次内任何记忆的封存日期</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">搬迁原因 *</label>
            <textarea
              value={reason}
              onChange={(e) => { setErrors([]); setReason(e.target.value); }}
              rows={2}
              placeholder="例如：老厨房要翻修，先把秋天的味道挪去阁楼避一避……"
              className="scent-textarea"
              style={{ minHeight: '64px' }}
            />
          </div>

          {errors.length > 0 && (
            <div className="rounded-xl border border-brick-500/40 bg-brick-500/10 p-4 animate-fadeInUp">
              <div className="flex items-center gap-2 text-brick-600 font-medium text-sm mb-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                本批次未创建，原有数据未受影响。请修正以下 {errors.length} 个问题：
              </div>
              <ul className="list-disc pl-5 space-y-1 text-sm text-brick-600/90">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <span className="text-[11px] text-ink-700/45 mr-auto">
              校验不通过时整批不建，记忆与房间数据保持原样
            </span>
            <button type="submit" className="btn-primary">
              创建搬迁批次
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
