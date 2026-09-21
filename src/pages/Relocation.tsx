import { useEffect } from 'react';
import { DoorOpen, Lock, ShieldCheck, Undo2 } from 'lucide-react';
import TopNav from '@/components/TopNav';
import RoomBoard from '@/components/relocation/RoomBoard';
import BatchComposer from '@/components/relocation/BatchComposer';
import BatchList from '@/components/relocation/BatchList';
import DeskStats from '@/components/relocation/DeskStats';
import { useMemoryStore } from '@/store/memoryStore';

export default function Relocation() {
  const { initIfEmpty } = useMemoryStore();

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  return (
    <div className="min-h-screen">
      <TopNav />

      <header className="pt-10 pb-8 md:pt-14">
        <div className="container max-w-6xl">
          <div className="absolute -left-2 -top-2 text-7xl opacity-10 select-none pointer-events-none font-serif text-ochre-500">
            迁
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-ink-800 leading-tight">
            房间<span className="text-ochre-500">搬迁</span>归属台
          </h1>
          <p className="mt-3 font-hand text-lg md:text-xl text-ink-700/70">
            成批编排、整批校验、确认换房；未再修改才可撤销，取消即完整回滚
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-paper-200/80 text-ink-700/80 text-xs border border-paper-300">
              <Lock className="w-3.5 h-3.5" /> 批次内记忆锁定
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-paper-200/80 text-ink-700/80 text-xs border border-paper-300">
              <ShieldCheck className="w-3.5 h-3.5" /> 校验失败整批不建
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-paper-200/80 text-ink-700/80 text-xs border border-paper-300">
              <DoorOpen className="w-3.5 h-3.5" /> 确认后换房留档
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-paper-200/80 text-ink-700/80 text-xs border border-paper-300">
              <Undo2 className="w-3.5 h-3.5" /> 撤销恢复原房间与顺序
            </span>
          </div>
          <div className="mt-7 h-px w-full" style={{ background: 'linear-gradient(90deg, transparent 0%, #CBB993 20%, #CBB993 80%, transparent 100%)' }} />
        </div>
      </header>

      <main className="container max-w-6xl pb-20 space-y-6">
        <DeskStats />
        <RoomBoard />
        <BatchComposer />
        <BatchList />
      </main>

      <footer className="pb-10 pt-2 text-center text-xs text-ink-700/40 font-hand text-lg">
        <p>每一次搬迁，都给旧气味安一个新家 · Relocation Desk</p>
      </footer>
    </div>
  );
}
