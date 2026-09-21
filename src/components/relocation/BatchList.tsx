import { useMemo, useState } from 'react';
import {
  ClipboardList, CheckCircle2, XCircle, Undo2, Lock, DoorClosed,
  CalendarDays, FileText, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { useMemoryStore } from '@/store/memoryStore';
import type { RelocationBatch } from '@/utils/relocation';
import { formatDay, getUndoBlockers } from '@/utils/relocation';

type Tab = 'draft' | 'archive';

function StatusBadge({ batch }: { batch: RelocationBatch }) {
  if (batch.status === 'draft') {
    return (
      <span className="scent-tag bg-ochre-100 text-ochre-600">
        <Lock className="w-3 h-3" /> 待确认·记忆锁定中
      </span>
    );
  }
  if (batch.status === 'confirmed') {
    return <span className="scent-tag bg-moss-100 text-moss-600"><CheckCircle2 className="w-3 h-3" /> 已确认·已留档</span>;
  }
  return <span className="scent-tag bg-paper-200 text-ink-700/70"><Undo2 className="w-3 h-3" /> 已撤销·已回原房间</span>;
}

function BatchCard({ batch }: { batch: RelocationBatch }) {
  const { memories, confirmBatch, cancelBatch, undoBatch } = useMemoryStore();
  const [expanded, setExpanded] = useState(false);
  const [actionError, setActionError] = useState('');

  const undoBlockers = useMemo(
    () => (batch.status === 'confirmed' ? getUndoBlockers(batch, memories) : []),
    [batch, memories],
  );

  const handle = (fn: () => { ok: boolean; error?: string }, label: string, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActionError('');
    const res = fn();
    if (!res.ok) setActionError(res.error ?? `${label}失败`);
  };

  return (
    <article className="rounded-xl border border-paper-300 bg-paper-50 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-serif text-lg font-semibold text-ink-800">
              搬迁至「{batch.targetRoomName}」
            </h4>
            <StatusBadge batch={batch} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-700/65">
            <span className="inline-flex items-center gap-1">
              <DoorClosed className="w-3.5 h-3.5" /> {batch.memoryIds.length} 条记忆
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> 交接日 {formatDay(batch.handoverDate)}
            </span>
            {batch.confirmed_at && <span>确认于 {formatDay(batch.confirmed_at.slice(0, 10))}</span>}
            {batch.undone_at && <span>撤销于 {formatDay(batch.undone_at.slice(0, 10))}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {batch.status === 'draft' && (
            <>
              <button
                onClick={() => handle(() => cancelBatch(batch.id), '取消', '确认取消该批次？批次将被丢弃，锁定立即解除，记忆无任何改动。')}
                className="btn-ghost !py-1.5 text-sm text-brick-500 hover:bg-brick-500/10"
              >
                <XCircle className="w-4 h-4" /> 取消批次
              </button>
              <button
                onClick={() => handle(
                  () => confirmBatch(batch.id),
                  '确认',
                  '确认后所选记忆将整体换房、更新顺序并留档，确定吗？',
                )}
                className="btn-primary !py-1.5 text-sm"
              >
                <CheckCircle2 className="w-4 h-4" /> 确认搬迁
              </button>
            </>
          )}
          {batch.status === 'confirmed' && (
            <button
              disabled={undoBlockers.length > 0}
              title={undoBlockers[0] ?? '恢复原房间与档案顺序'}
              onClick={() => handle(
                () => undoBatch(batch.id),
                '撤销',
                '撤销后全部记忆回到原房间并恢复原来的档案顺序，确定吗？',
              )}
              className={`btn-secondary !py-1.5 text-sm ${undoBlockers.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Undo2 className="w-4 h-4" /> 撤销搬迁
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-ochre-600 hover:bg-ochre-100"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-start gap-2 text-sm text-ink-700/75">
        <FileText className="w-4 h-4 mt-0.5 shrink-0 text-lavender-500" />
        <span>{batch.reason}</span>
      </div>

      {actionError && (
        <div className="mt-3 flex items-start gap-2 text-sm text-brick-600 bg-brick-500/10 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {actionError}
        </div>
      )}

      {batch.status === 'confirmed' && undoBlockers.length > 0 && (
        <div className="mt-3 rounded-lg bg-paper-200/70 px-3 py-2 text-xs text-ink-700/70">
          该批次已不可撤销：{undoBlockers.join('；')}
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-paper-200 space-y-2 animate-expand">
          {batch.items.length === 0 && (
            <p className="text-xs text-ink-700/50">确认后将按以下顺序换房并留档：</p>
          )}
          {batch.memoryIds.map((mid, i) => {
            const item = batch.items.find((it) => it.memoryId === mid);
            const mem = memories.find((m) => m.id === mid);
            return (
              <div key={mid} className="flex items-center gap-2 text-sm flex-wrap">
                <span className="w-6 h-6 shrink-0 rounded-full bg-paper-200 text-ink-700 text-xs font-semibold inline-flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-ink-800 font-medium">{item?.memoryLabel ?? mem?.location ?? '（已删除记忆）'}</span>
                {item && (
                  <span className="text-xs text-ink-700/60 inline-flex items-center gap-1">
                    {item.fromRoomName}
                    <span className="text-ochre-500">→</span>
                    {batch.targetRoomName}
                    {batch.status === 'undone' && <span className="text-moss-600">（已恢复）</span>}
                  </span>
                )}
                {!item && mem && <span className="text-xs text-ink-700/50">（锁定中，确认后换房）</span>}
              </div>
            );
          })}
          {batch.items.length > 0 && (
            <p className="text-[11px] text-ink-700/45 pt-1">
              撤销时将按下标恢复到档案原位置：{batch.items.map((it) => it.beforeIndex).join('、')}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default function BatchList() {
  const { batches } = useMemoryStore();
  const [tab, setTab] = useState<Tab>('draft');

  const drafts = useMemo(
    () => batches.filter((b) => b.status === 'draft').sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [batches],
  );
  const archive = useMemo(
    () => batches.filter((b) => b.status !== 'draft').sort((a, b) => (b.confirmed_at ?? b.created_at).localeCompare(a.confirmed_at ?? a.created_at)),
    [batches],
  );

  const list = tab === 'draft' ? drafts : archive;

  return (
    <section className="bg-paper-50/80 backdrop-blur rounded-2xl border border-paper-300 p-5 shadow-paper">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <ClipboardList className="w-5 h-5 text-ochre-600" />
        <h3 className="font-hand text-xl text-ochre-600">搬迁批次</h3>
        <div className="ml-auto inline-flex rounded-xl bg-paper-200 p-1">
          <button
            onClick={() => setTab('draft')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'draft' ? 'bg-ochre-500 text-paper-50 shadow-paper' : 'text-ink-700/70 hover:text-ink-800'}`}
          >
            待确认 {drafts.length > 0 && <b className="ml-0.5">{drafts.length}</b>}
          </button>
          <button
            onClick={() => setTab('archive')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'archive' ? 'bg-ochre-500 text-paper-50 shadow-paper' : 'text-ink-700/70 hover:text-ink-800'}`}
          >
            留档记录 {archive.length > 0 && <b className="ml-0.5">{archive.length}</b>}
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-4xl mb-2 select-none">{tab === 'draft' ? '🔒' : '📜'}</div>
          <p className="text-sm text-ink-700/60">
            {tab === 'draft' ? '还没有待确认的搬迁批次' : '还没有任何已确认或已撤销的留档'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => <BatchCard key={b.id} batch={b} />)}
        </div>
      )}
    </section>
  );
}
