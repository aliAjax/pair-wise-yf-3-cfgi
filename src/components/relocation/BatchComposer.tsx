import { useMemo, useState } from 'react';
import { ClipboardPlus, Info, AlertTriangle, Check, X, Search, Lock, RotateCcw } from 'lucide-react';
import { useMemoryStore } from '@/store/memoryStore';
import { validatePlan, todayInput, findRoomByLocation } from '@/utils/relocation';
import type { PlanInput } from '@/utils/relocation';
import { getSeasonInfo, getSmellTypeInfo } from '@/utils/constants';
import { formatDate } from '@/utils/helpers';

export default function BatchComposer() {
  const { memories, rooms, batches, createBatch } = useMemoryStore();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [handoverDate, setHandoverDate] = useState(todayInput());
  const [reason, setReason] = useState('');
  const [keyword, setKeyword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const lockedByOthers = useMemo(() => {
    const ids = new Set<string>();
    batches.filter((b) => b.status === 'draft').forEach((b) => b.memoryIds.forEach((id) => ids.add(id)));
    return ids;
  }, [batches]);

  const plan: PlanInput = useMemo(
    () => ({ memoryIds: selected, targetRoomId, handoverDate, reason }),
    [selected, targetRoomId, handoverDate, reason],
  );

  // 新建时排除自身，此处还没有批次 id
  const validation = useMemo(
    () => validatePlan(plan, memories, rooms, batches),
    [plan, memories, rooms, batches],
  );

  const filteredMemories = useMemo(() => {
    const kw = keyword.trim();
    if (!kw) return memories;
    return memories.filter(
      (m) => m.location.includes(kw) || m.source_guess.includes(kw) || m.memory_text.includes(kw),
    );
  }, [memories, keyword]);

  const toggle = (id: string) => {
    setSubmitError('');
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };

  const resetForm = () => {
    setSelected([]);
    setTargetRoomId('');
    setHandoverDate(todayInput());
    setReason('');
    setKeyword('');
    setSubmitError('');
  };

  const handleSubmit = () => {
    setSubmitError('');
    const res = createBatch(plan);
    if (!res.ok) {
      setSubmitError(res.error ?? '批次创建失败，原数据未改动');
      return;
    }
    resetForm();
    setOpen(false);
    setSuccessMsg('批次已建立，所选记忆已锁定。请在下方批次列表中确认搬迁。');
    window.setTimeout(() => setSuccessMsg(''), 4000);
  };

  if (!open) {
    return (
      <section className="rounded-2xl border border-paper-300 bg-gradient-to-br from-ochre-50 to-paper-50 p-5 shadow-paper">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-hand text-xl text-ochre-600 flex items-center gap-2">
              <ClipboardPlus className="w-5 h-5" />
              新建搬迁批次
            </h3>
            <p className="text-sm text-ink-700/60 mt-1">
              至少选两条记忆，填写目标房间、交接日与原因。任一项校验不通过，整批都不会建立，原数据不变。
            </p>
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary shrink-0">
            <ClipboardPlus className="w-4 h-4" /> 编排新批次
          </button>
        </div>
        {successMsg && (
          <div className="mt-4 rounded-xl bg-moss-100 text-moss-600 px-4 py-2.5 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> {successMsg}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-ochre-300 bg-paper-50 p-5 shadow-paper-hover">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
          <ClipboardPlus className="w-5 h-5" />
          编排搬迁批次
        </h3>
        <button
          onClick={() => { setOpen(false); setSubmitError(''); }}
          className="p-2 rounded-xl text-ink-700/60 hover:bg-paper-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 全局校验 */}
      <div className="mb-4 space-y-1.5">
        {validation.global.map((msg, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-brick-600 bg-brick-500/10 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {msg}
          </div>
        ))}
        {validation.ok && selected.length >= 2 && (
          <div className="flex items-center gap-2 text-sm text-moss-600 bg-moss-100 rounded-lg px-3 py-2">
            <Check className="w-4 h-4" /> 校验全部通过，可以建立批次
          </div>
        )}
      </div>

      {/* 记忆选择 */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-ink-800">
            选择记忆 <span className="text-brick-600">*</span>
            <span className="ml-2 text-xs text-ink-700/55">已选 {selected.length} 条（至少 2 条）</span>
          </label>
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索地点/来源/回忆"
              className="scent-input !py-1.5 !pl-8 text-sm"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-paper-300 divide-y divide-paper-200">
          {filteredMemories.map((m) => {
            const room = findRoomByLocation(rooms, m.location);
            const locked = lockedByOthers.has(m.id);
            const checked = selected.includes(m.id);
            const itemError = validation.perItem[m.id];
            const t = getSmellTypeInfo(m.smell_type);
            const s = getSeasonInfo(m.season);
            const disabled = locked;
            return (
              <label
                key={m.id}
                className={`flex items-start gap-3 px-3.5 py-3 cursor-pointer transition-colors ${
                  disabled ? 'opacity-60 cursor-not-allowed bg-paper-100/60' : checked ? 'bg-ochre-50' : 'hover:bg-paper-100'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 accent-ochre-500 shrink-0"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(m.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-[15px] font-semibold text-ink-800">{m.location}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full text-paper-50" style={{ backgroundColor: t.color }}>
                      {t.emoji} {t.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-ochre-100 text-ochre-600">
                      {s.emoji} {s.label}
                    </span>
                    {locked && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brick-500/10 text-brick-600 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" /> 被其他批次锁定
                      </span>
                    )}
                    {!room && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brick-500/10 text-brick-600">
                        缺原房间
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-700/60 mt-0.5 truncate">
                    {room ? `原房间：${room.name} · ` : '原房间未登记 · '}
                    {m.source_guess} · 封存于 {formatDate(m.created_at)}
                  </p>
                  {itemError && (
                    <p className="text-xs text-brick-600 mt-1 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {itemError}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
          {filteredMemories.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink-700/50">没有匹配的记忆</p>
          )}
        </div>
      </div>

      {/* 目标房间 / 交接日 / 原因 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-ink-800 mb-1.5">
            目标房间 <span className="text-brick-600">*</span>
          </label>
          <select
            value={targetRoomId}
            onChange={(e) => setTargetRoomId(e.target.value)}
            className="scent-select"
          >
            <option value="">请选择目标房间…</option>
            {rooms.map((r) => {
              const used = memories.filter((m) => m.location === r.name).length;
              return (
                <option key={r.id} value={r.id}>
                  {r.name}（容量 {r.capacity}，现住 {used}，余 {Math.max(r.capacity - used, 0)}）
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-800 mb-1.5">
            交接日 <span className="text-brick-600">*</span>
            <span className="ml-2 text-xs text-ink-700/50">不得早于任一所选记忆的封存日</span>
          </label>
          <input
            type="date"
            value={handoverDate}
            onChange={(e) => setHandoverDate(e.target.value)}
            className="scent-input"
          />
        </div>
      </div>
      <div className="mb-5">
        <label className="block text-sm font-medium text-ink-800 mb-1.5">
          搬迁原因 <span className="text-brick-600">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="例如：梅雨季要到了，把怕潮的记忆挪到通风的阁楼房间……"
          className="scent-textarea"
        />
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-paper-100 border border-paper-200 px-4 py-3 text-xs text-ink-700/65 mb-5">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-ochre-500" />
        <p>
          建立批次后所选记忆即被锁定（不可编辑/删除）；确认时会再次校验容量与「同类型同季节」冲突。
          整批校验失败时不会产生任何批次，也不会改动记忆。取消批次会完整回滚并解除锁定。
        </p>
      </div>

      {submitError && (
        <div className="mb-4 flex items-start gap-2 text-sm text-brick-600 bg-brick-500/10 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {submitError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button onClick={resetForm} className="btn-ghost">
          <RotateCcw className="w-4 h-4" /> 清空
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary">
          收起
        </button>
        <button onClick={handleSubmit} disabled={!validation.ok} className={`btn-primary ${!validation.ok ? 'opacity-50 cursor-not-allowed hover:translate-y-0' : ''}`}>
          <Check className="w-4 h-4" /> 建立批次（锁定记忆）
        </button>
      </div>
    </section>
  );
}
