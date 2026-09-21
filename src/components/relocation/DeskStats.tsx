import { useMemo } from 'react';
import { BarChart3, PieChart as PieIcon, Boxes, CheckCircle2, Lock, Undo2, DoorOpen } from 'lucide-react';
import { useMemoryStore } from '@/store/memoryStore';
import { getBatchRoomSlices, getHandoverTimeline } from '@/utils/relocation';
import { formatDay } from '@/utils/relocation';

const PALETTE = ['#8B5A2B', '#7DA08C', '#A0522D', '#9B8AA6', '#D4A574', '#5A7D6A', '#B8894F', '#CD5C5C', '#6B8E23', '#B8623A'];

function StatTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-paper-300 bg-paper-50 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
        {icon}
      </div>
      <div>
        <div className="font-serif text-2xl font-bold text-ink-800 leading-none">{value}</div>
        <div className="text-xs text-ink-700/60 mt-1">{label}</div>
      </div>
    </div>
  );
}

function RoomDonut() {
  const { batches } = useMemoryStore();
  const slices = useMemo(() => getBatchRoomSlices(batches), [batches]);
  const total = slices.reduce((a, s) => a + s.count, 0);

  const radius = 60;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="bg-paper-50/80 rounded-2xl border border-paper-300 p-5 shadow-paper">
      <h4 className="font-hand text-xl text-ochre-600 mb-3 flex items-center gap-2">
        <PieIcon className="w-5 h-5" /> 搬迁去向（批次数）
      </h4>
      {total === 0 ? (
        <p className="text-sm text-ink-700/50 py-8 text-center">确认批次后这里会出现归属分布</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0 -rotate-90">
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#EDE3CC" strokeWidth={20} />
            {slices.map((s, i) => {
              const frac = s.count / total;
              const dash = frac * circumference;
              const el = (
                <circle
                  key={s.roomName}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={20}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                >
                  <title>{`${s.roomName}: ${s.count} 批`}</title>
                </circle>
              );
              offset += dash;
              return el;
            })}
            <text x="80" y="76" textAnchor="middle" transform="rotate(90 80 80)" fontSize="26" fontWeight="700" fill="#3A2F25">
              {total}
            </text>
            <text x="80" y="98" textAnchor="middle" transform="rotate(90 80 80)" fontSize="11" fill="#4A3F33">
              已确认批次
            </text>
          </svg>
          <ul className="flex-1 w-full space-y-1.5">
            {slices.map((s, i) => (
              <li key={s.roomName} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                <span className="flex-1 truncate text-ink-800">{s.roomName}</span>
                <span className="text-xs font-semibold text-ochre-600">{s.count} 批</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HandoverBarChart() {
  const { batches } = useMemoryStore();
  const points = useMemo(() => getHandoverTimeline(batches), [batches]);
  const max = Math.max(...points.map((p) => p.count), 1);

  return (
    <div className="bg-paper-50/80 rounded-2xl border border-paper-300 p-5 shadow-paper">
      <h4 className="font-hand text-xl text-ochre-600 mb-3 flex items-center gap-2">
        <BarChart3 className="w-5 h-5" /> 交接日搬迁量（记忆条数）
      </h4>
      {points.length === 0 ? (
        <p className="text-sm text-ink-700/50 py-8 text-center">确认批次后这里会出现交接时间线</p>
      ) : (
        <div>
          <div className="flex items-end gap-3 h-40 overflow-x-auto pb-2">
            {points.map((p) => (
              <div key={p.date} className="flex-1 min-w-[52px] flex flex-col items-center justify-end gap-2 h-full">
                <span className="text-xs font-semibold text-ochre-600">{p.count}</span>
                <div
                  className="w-full max-w-[40px] rounded-t-lg transition-all duration-700"
                  style={{
                    height: `${Math.max((p.count / max) * 100, 8)}%`,
                    background: 'linear-gradient(180deg,#B8894F 0%,#8B5A2B 60%,#5C3A1D 100%)',
                  }}
                  title={`${formatDay(p.date)}：${p.count} 条`}
                />
                <span className="text-[10px] text-ink-700/60 whitespace-nowrap">{formatDay(p.date).slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeskStats() {
  const { memories, rooms, batches } = useMemoryStore();

  const draftCount = batches.filter((b) => b.status === 'draft').length;
  const confirmedCount = batches.filter((b) => b.status === 'confirmed').length;
  const undoneCount = batches.filter((b) => b.status === 'undone').length;
  const relocatedMemCount = useMemo(() => {
    const ids = new Set<string>();
    batches.filter((b) => b.status === 'confirmed').forEach((b) => b.memoryIds.forEach((id) => ids.add(id)));
    return ids.size;
  }, [batches]);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={<Lock className="w-5 h-5 text-ochre-600" />} label="待确认批次（锁定中）" value={draftCount} tone="bg-ochre-100" />
        <StatTile icon={<CheckCircle2 className="w-5 h-5 text-moss-600" />} label="已确认批次" value={confirmedCount} tone="bg-moss-100" />
        <StatTile icon={<Boxes className="w-5 h-5 text-lavender-600" />} label="已搬迁记忆（去重）" value={relocatedMemCount} tone="bg-lavender-300/30" />
        <StatTile icon={<Undo2 className="w-5 h-5 text-brick-500" />} label="已撤销批次" value={undoneCount} tone="bg-brick-500/10" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RoomDonut />
        <HandoverBarChart />
      </div>
      <div className="rounded-2xl border border-paper-300 bg-paper-50/80 p-4 flex items-center gap-2 text-xs text-ink-700/55">
        <DoorOpen className="w-4 h-4 text-ochre-500 shrink-0" />
        全部数据（记忆、房间、批次与留档）均保存在浏览器本地，自动同步，刷新页面不会丢失。档案总数 {memories.length} 条 · 房间 {rooms.length} 间。
      </div>
    </section>
  );
}
