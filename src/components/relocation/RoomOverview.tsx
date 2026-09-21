import { useMemo } from 'react';
import type { Room, SmellMemory, RelocationBatch } from '../../utils/constants';
import { getSeasonInfo, getSmellTypeInfo } from '../../utils/constants';

interface Props {
  memories: SmellMemory[];
  rooms: Room[];
  batches: RelocationBatch[];
}

function occupancyOf(memories: SmellMemory[], roomId: string): SmellMemory[] {
  return memories.filter((m) => m.room_id === roomId);
}

function barColor(pct: number): string {
  if (pct >= 100) return 'linear-gradient(90deg, #B8623A 0%, #A0522D 100%)';
  if (pct >= 70) return 'linear-gradient(90deg, #D4B487 0%, #A06932 100%)';
  return 'linear-gradient(90deg, #CFDBD3 0%, #5A7D6A 100%)';
}

export default function RoomOverview({ memories, rooms, batches }: Props) {
  const totalCapacity = useMemo(() => rooms.reduce((s, r) => s + r.capacity, 0), [rooms]);
  const used = memories.filter((m) => m.room_id).length;
  const homeless = memories.length - used;
  const pendingCount = batches.filter((b) => b.status === 'pending').length;
  const confirmedCount = batches.filter((b) => b.status === 'confirmed').length;

  const stats = [
    { emoji: '🏠', label: '房间', value: String(rooms.length) },
    { emoji: '📦', label: '已安置', value: `${used}/${totalCapacity}` },
    { emoji: '🈳', label: '空闲位', value: String(totalCapacity - used) },
    { emoji: '⏳', label: '待确认批次', value: String(pendingCount) },
    { emoji: '✅', label: '已确认搬迁', value: String(confirmedCount) },
    { emoji: '🧳', label: '未归档记忆', value: String(homeless) },
  ];

  return (
    <section className="mb-8">
      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-paper-50/80 backdrop-blur rounded-2xl border border-paper-300 px-4 py-3 shadow-paper text-center"
          >
            <div className="text-lg leading-none mb-1.5">
              <span className="mr-1">{s.emoji}</span>
              <span className="font-serif font-bold text-ochre-600">{s.value}</span>
            </div>
            <div className="text-[11px] text-ink-700/60">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 占用图表 */}
      <div className="bg-paper-50/80 backdrop-blur rounded-2xl border border-paper-300 p-5 shadow-paper mb-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-hand text-xl text-ochre-600">房间占用图</h4>
          <span className="text-xs text-ink-700/60">容量 {totalCapacity} 格 · 随搬迁实时更新</span>
        </div>
        <div className="space-y-3">
          {rooms.map((room) => {
            const count = occupancyOf(memories, room.id).length;
            const pct = Math.min(100, Math.round((count / room.capacity) * 100));
            return (
              <div key={room.id} className="flex items-center gap-3">
                <div className="w-24 sm:w-28 shrink-0 text-sm text-ink-800 truncate">
                  <span className="mr-1">{room.emoji}</span>
                  {room.name}
                </div>
                <div className="flex-1 h-4 bg-paper-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%`, background: barColor(pct) }}
                  />
                </div>
                <div className="w-16 shrink-0 text-right text-xs">
                  <span className={`font-semibold ${count >= room.capacity ? 'text-brick-500' : 'text-ochre-600'}`}>
                    {count}
                  </span>
                  <span className="text-ink-700/50"> / {room.capacity}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 房间卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => {
          const members = occupancyOf(memories, room.id);
          const pct = Math.min(100, Math.round((members.length / room.capacity) * 100));
          const full = members.length >= room.capacity;
          return (
            <div
              key={room.id}
              className="bg-paper-50/80 backdrop-blur rounded-2xl border border-paper-300 p-4 shadow-paper hover:shadow-paper-hover transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="font-serif text-lg font-semibold text-ink-800">
                    <span className="mr-1.5">{room.emoji}</span>
                    {room.name}
                  </div>
                  <div className="text-[11px] text-ink-700/55 mt-0.5">{room.description}</div>
                </div>
                <span
                  className={`scent-tag shrink-0 ${
                    full ? 'bg-brick-500/15 text-brick-600' : 'bg-moss-100 text-moss-600'
                  }`}
                >
                  {full ? '已满' : `余 ${room.capacity - members.length}`}
                </span>
              </div>

              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-2 bg-paper-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(pct, members.length > 0 ? 8 : 0)}%`, background: barColor(pct) }}
                  />
                </div>
                <span className="text-[11px] text-ink-700/60 shrink-0">
                  {members.length}/{room.capacity}
                </span>
              </div>

              {members.length === 0 ? (
                <div className="text-center py-3 text-xs text-ink-700/40 border border-dashed border-paper-300 rounded-xl">
                  空房间，等待气味入住
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const season = getSeasonInfo(m.season);
                    const stype = getSmellTypeInfo(m.smell_type);
                    return (
                      <span
                        key={m.id}
                        className="scent-tag bg-paper-100 border border-paper-300 text-ink-700 max-w-full"
                        title={`${m.location} · ${stype.label} · ${season.label}`}
                      >
                        <span>{season.emoji}</span>
                        <span>{stype.emoji}</span>
                        <span className="truncate max-w-[9rem]">{m.location}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
