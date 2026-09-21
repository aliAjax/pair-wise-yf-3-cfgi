import type { RelocationBatch, Room, SmellMemory } from '../../utils/constants';
import { BATCH_STATUS_INFO, getSeasonInfo, getSmellTypeInfo } from '../../utils/constants';
import { formatDate, getUndoBlockReason } from '../../utils/helpers';
import { CheckCircle2, XCircle, Undo2, Archive } from 'lucide-react';

interface Props {
  batches: RelocationBatch[];
  memories: SmellMemory[];
  rooms: Room[];
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onUndo: (id: string) => void;
}

export default function BatchList({ batches, memories, rooms, onConfirm, onCancel, onUndo }: Props) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
          <Archive className="w-5 h-5" />
          搬迁档案
        </h3>
        <span className="text-xs text-ink-700/50">共 {batches.length} 个批次 · 全程留档</span>
      </div>

      {batches.length === 0 ? (
        <div className="bg-paper-50/70 backdrop-blur rounded-3xl border-2 border-dashed border-paper-400 py-14 text-center">
          <div className="text-5xl mb-3 select-none">🚚</div>
          <p className="text-ink-700/60 text-sm">还没有搬迁记录。选好记忆，创建第一个搬迁批次吧。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => {
            const info = BATCH_STATUS_INFO[batch.status];
            const target = rooms.find((r) => r.id === batch.target_room_id);
            const undoBlock = getUndoBlockReason(batch, memories);
            return (
              <article
                key={batch.id}
                className="bg-paper-50/80 backdrop-blur rounded-2xl border border-paper-300 p-5 shadow-paper"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`scent-tag ${info.bg} ${info.text}`}>
                        {info.emoji} {info.label}
                      </span>
                      <span className="text-[11px] text-ink-700/50">
                        创建于 {formatDate(batch.created_at)}
                      </span>
                    </div>
                    <div className="font-serif text-lg text-ink-800">
                      {batch.items.length} 条记忆
                      <span className="mx-2 text-ochre-500">→</span>
                      {target ? `${target.emoji} ${target.name}` : '（房间已不存在）'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {batch.status === 'pending' && (
                      <>
                        <button
                          onClick={() => onConfirm(batch.id)}
                          className="btn-primary !px-4 !py-2 text-sm inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          确认搬迁
                        </button>
                        <button
                          onClick={() => onCancel(batch.id)}
                          className="btn-secondary !px-4 !py-2 text-sm inline-flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          取消批次
                        </button>
                      </>
                    )}
                    {batch.status === 'confirmed' && (
                      <button
                        onClick={() => onUndo(batch.id)}
                        disabled={!!undoBlock}
                        title={undoBlock ?? '恢复原房间和原顺序'}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          undoBlock
                            ? 'bg-paper-200/50 text-ink-700/40 cursor-not-allowed border border-paper-300'
                            : 'bg-lavender-500 hover:bg-lavender-600 text-paper-50 shadow-paper hover:-translate-y-0.5'
                        }`}
                      >
                        <Undo2 className="w-4 h-4" />
                        撤销搬迁
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm mb-3">
                  <div className="text-ink-700/80">🗓️ 交接日：{batch.handover_date}</div>
                  <div className="sm:col-span-2 text-ink-700/80 truncate" title={batch.reason}>
                    📝 原因：{batch.reason}
                  </div>
                </div>

                {batch.status === 'confirmed' && undoBlock && (
                  <p className="text-xs text-brick-500 mb-3">🔒 {undoBlock}</p>
                )}

                <div className="border-t border-paper-200 pt-3">
                  <div className="flex flex-wrap gap-2">
                    {batch.items.map((item) => {
                      const m = memories.find((mm) => mm.id === item.memory_id);
                      const fromRoom = rooms.find((r) => r.id === item.from_room_id);
                      if (!m) {
                        return (
                          <span
                            key={item.memory_id}
                            className="scent-tag bg-paper-200 text-ink-700/40 line-through"
                          >
                            已删除的记忆
                          </span>
                        );
                      }
                      const stype = getSmellTypeInfo(m.smell_type);
                      const season = getSeasonInfo(m.season);
                      return (
                        <span
                          key={item.memory_id}
                          className="scent-tag bg-paper-100 border border-paper-300 text-ink-700"
                          title={`${stype.label} · ${season.label}`}
                        >
                          {season.emoji}
                          {stype.emoji}
                          <span className="max-w-[10rem] truncate">{m.location}</span>
                          <span className="text-ink-700/50">
                            {fromRoom?.name ?? '未知'} → {target?.name ?? '未知'}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-ink-700/50 flex flex-wrap gap-x-4 gap-y-1">
                  <span>📥 创建 {formatDate(batch.created_at)}</span>
                  {batch.confirmed_at && <span>✅ 确认 {formatDate(batch.confirmed_at)}</span>}
                  {batch.cancelled_at && <span>🚫 取消 {formatDate(batch.cancelled_at)}</span>}
                  {batch.undone_at && <span>↩️ 撤销 {formatDate(batch.undone_at)}</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
