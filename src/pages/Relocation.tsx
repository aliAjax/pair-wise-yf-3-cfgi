import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { useMemoryStore } from '../store/memoryStore';
import { getLockedMemoryIds } from '../utils/helpers';
import RoomOverview from '../components/relocation/RoomOverview';
import BatchForm from '../components/relocation/BatchForm';
import BatchList from '../components/relocation/BatchList';

interface Notice {
  type: 'success' | 'error';
  text: string;
}

export default function Relocation() {
  const {
    memories,
    rooms,
    batches,
    initIfEmpty,
    createBatch,
    confirmBatch,
    undoBatch,
    cancelBatch,
  } = useMemoryStore();

  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const lockedIds = useMemo(() => getLockedMemoryIds(batches), [batches]);

  const handleConfirm = (id: string) => {
    if (!window.confirm('确认执行这次搬迁吗？批次内记忆将迁入目标房间并留档。')) return;
    const r = confirmBatch(id);
    if (r.ok) {
      setNotice({ type: 'success', text: '搬迁已确认：记忆已迁入新房间，档案已留存' });
    } else {
      setNotice({ type: 'error', text: `无法确认搬迁：${r.errors.join('；')}` });
    }
  };

  const handleUndo = (id: string) => {
    if (!window.confirm('撤销这次搬迁？记忆将恢复原房间和原顺序。')) return;
    const r = undoBatch(id);
    if (r.ok) {
      setNotice({ type: 'success', text: '已撤销：记忆已回到原房间和原顺序' });
    } else {
      setNotice({ type: 'error', text: `无法撤销：${r.errors.join('；')}` });
    }
  };

  const handleCancel = (id: string) => {
    if (!window.confirm('取消这个待确认批次？批次内记忆将解除锁定，数据完整回滚。')) return;
    const r = cancelBatch(id);
    if (r.ok) {
      setNotice({ type: 'success', text: '批次已取消：记忆已解除锁定，数据完整回滚' });
    } else {
      setNotice({ type: 'error', text: `无法取消：${r.errors.join('；')}` });
    }
  };

  return (
    <div className="min-h-screen">
      <header className="relative pt-10 pb-6 md:pt-14 md:pb-8">
        <div className="container max-w-6xl">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-ink-700/70 hover:text-ochre-600 transition-colors mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            返回气味档案
          </Link>
          <div className="relative">
            <div className="absolute -left-2 -top-7 text-6xl md:text-7xl opacity-10 select-none pointer-events-none font-serif text-ochre-500">
              迁
            </div>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-ink-800 leading-tight relative z-10">
              房间搬迁
              <span className="text-ochre-500">归属台</span>
            </h1>
            <p className="mt-2 font-hand text-lg md:text-xl text-ink-700/70 pl-1 relative z-10">
              把每段气味安置到合适的房间，每一次搬迁都留档可溯
            </p>
          </div>
          <div
            className="mt-6 h-px w-full"
            style={{ background: 'linear-gradient(90deg, transparent 0%, #CBB993 20%, #CBB993 80%, transparent 100%)' }}
          />
        </div>
      </header>

      <main className="container max-w-6xl pb-20">
        {notice && (
          <div
            className={`mb-6 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-paper animate-slideDown ${
              notice.type === 'success'
                ? 'bg-moss-100/90 border-moss-300 text-moss-600'
                : 'bg-brick-500/10 border-brick-500/40 text-brick-600'
            }`}
          >
            <span>{notice.type === 'success' ? '🌿' : '⚠️'} {notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              className="p-0.5 rounded hover:bg-black/5 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <RoomOverview memories={memories} rooms={rooms} batches={batches} />

        <BatchForm
          memories={memories}
          rooms={rooms}
          lockedIds={lockedIds}
          onSubmit={createBatch}
          onSuccess={(text) => setNotice({ type: 'success', text })}
        />

        <BatchList
          batches={batches}
          memories={memories}
          rooms={rooms}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onUndo={handleUndo}
        />
      </main>

      <footer className="pb-10 pt-4 text-center text-xs text-ink-700/40 font-hand text-lg">
        <p>每一次搬迁，都是记忆重新安家的仪式 · Relocation Board</p>
      </footer>
    </div>
  );
}
