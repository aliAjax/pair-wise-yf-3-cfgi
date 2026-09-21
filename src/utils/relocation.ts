import type { SmellMemory } from './constants';
import { getSeasonInfo, getSmellTypeInfo } from './constants';

/* ---------------- 领域类型 ---------------- */

export interface Room {
  id: string;
  name: string;
  capacity: number;
  created_at: string;
}

export type BatchStatus = 'draft' | 'confirmed' | 'undone';

export interface BatchItem {
  memoryId: string;
  memoryLabel: string;
  fromRoomId: string;
  fromRoomName: string;
  /** 确认搬迁时，记忆在档案列表中的原始下标（用于撤销时恢复顺序） */
  beforeIndex: number;
  /** 确认前完整快照 */
  before: SmellMemory | null;
  /** 确认后完整快照 */
  after: SmellMemory | null;
}

export interface RelocationBatch {
  id: string;
  status: BatchStatus;
  memoryIds: string[];
  targetRoomId: string;
  targetRoomName: string;
  /** 交接日 yyyy-mm-dd */
  handoverDate: string;
  reason: string;
  created_at: string;
  confirmed_at: string | null;
  undone_at: string | null;
  items: BatchItem[];
}

export interface PlanInput {
  memoryIds: string[];
  targetRoomId: string;
  handoverDate: string;
  reason: string;
}

export interface PlanValidation {
  ok: boolean;
  global: string[];
  /** memoryId -> 错误信息 */
  perItem: Record<string, string>;
}

/* ---------------- 日期工具 ---------------- */

export function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDay(value: string): string {
  const d = parseDay(value);
  if (!d) return value;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------------- 房间与占用 ---------------- */

export function findRoomByLocation(rooms: Room[], location: string): Room | undefined {
  return rooms.find((r) => r.name === location);
}

export function roomResidents(memories: SmellMemory[], room: Room): SmellMemory[] {
  return memories.filter((m) => m.location === room.name);
}

/* ---------------- 批次校验 ---------------- */

const MEMORY_FIELDS: (keyof SmellMemory)[] = [
  'location', 'source_guess', 'intensity', 'humidity', 'season', 'smell_type',
  'memory_text', 'color_association', 'emotion', 'want_again', 'created_at', 'updated_at',
];

export function isMemoryEqual(a: SmellMemory, b: SmellMemory): boolean {
  if (a.id !== b.id) return false;
  return MEMORY_FIELDS.every((k) => a[k] === b[k]);
}

/** 已确认批次是否满足「未再修改」的撤销前提 */
export function getUndoBlockers(batch: RelocationBatch, memories: SmellMemory[]): string[] {
  const blockers: string[] = [];
  for (const item of batch.items) {
    const cur = memories.find((m) => m.id === item.memoryId);
    if (!cur) {
      blockers.push(`《${item.memoryLabel}》已被删除，无法恢复`);
      continue;
    }
    if (!item.after || !isMemoryEqual(cur, item.after)) {
      blockers.push(`《${item.memoryLabel}》搬迁后又被修改过，已不可撤销`);
    }
  }
  return blockers;
}

export function validatePlan(
  plan: PlanInput,
  memories: SmellMemory[],
  rooms: Room[],
  drafts: RelocationBatch[],
  excludeDraftId?: string,
): PlanValidation {
  const global: string[] = [];
  const perItem: Record<string, string> = {};
  const failItem = (id: string, msg: string) => {
    if (!perItem[id]) perItem[id] = msg;
  };

  const ids = Array.from(new Set(plan.memoryIds));

  if (ids.length < 2) global.push(`至少选择两条记忆（当前 ${ids.length} 条）`);
  if (!plan.handoverDate.trim() || !parseDay(plan.handoverDate)) {
    global.push('请选择有效的交接日');
  }
  if (!plan.reason.trim()) global.push('请填写搬迁原因');
  const target = rooms.find((r) => r.id === plan.targetRoomId);
  if (!plan.targetRoomId) global.push('请选择目标房间');
  else if (!target) global.push('目标房间不存在或已被删除');

  // 其他待确认批次的锁定
  const lockedIds = new Set<string>();
  for (const d of drafts) {
    if (d.status === 'draft' && d.id !== excludeDraftId) {
      d.memoryIds.forEach((id) => lockedIds.add(id));
    }
  }

  const handoverDay = parseDay(plan.handoverDate);
  const selected: { mem: SmellMemory; room: Room | undefined }[] = [];

  for (const id of ids) {
    const mem = memories.find((m) => m.id === id);
    if (!mem) {
      failItem(id, '记忆不存在');
      continue;
    }
    if (lockedIds.has(id)) {
      failItem(id, '已被其他待确认批次锁定');
      continue;
    }
    const room = findRoomByLocation(rooms, mem.location);
    if (!room) failItem(id, '缺少原房间：档案位置尚未登记为房间');
    else if (target && room.id === target.id) failItem(id, '原房间与目标房间相同');

    if (handoverDay) {
      const sealedDay = new Date(mem.created_at);
      const sealedStart = new Date(sealedDay.getFullYear(), sealedDay.getMonth(), sealedDay.getDate());
      if (handoverDay.getTime() < sealedStart.getTime()) {
        failItem(id, '交接日早于该记忆的封存时间');
      }
    }
    selected.push({ mem, room });
  }

  // 容量与同类同季节
  if (target) {
    const selectedIds = new Set(ids);
    const residents = memories.filter(
      (m) => m.location === target.name && !selectedIds.has(m.id),
    );
    if (residents.length + ids.length > target.capacity) {
      global.push(
        `目标房间容量不足：需入住 ${ids.length} 条，现住 ${residents.length} 条 / 容量 ${target.capacity} 条（空余 ${Math.max(target.capacity - residents.length, 0)} 格）`,
      );
    }

    for (const { mem } of selected) {
      const clash = residents.find(
        (r) => r.smell_type === mem.smell_type && r.season === mem.season,
      );
      if (clash) {
        const t = getSmellTypeInfo(mem.smell_type);
        const s = getSeasonInfo(mem.season);
        failItem(mem.id, `目标房间已有同类型同季节记录（${t.label}·${s.label}：${clash.source_guess || clash.location}）`);
      }
    }

    // 批次内同类同季节互查
    const seen = new Map<string, string>();
    for (const { mem } of selected) {
      const key = `${mem.smell_type}|${mem.season}`;
      const prev = seen.get(key);
      if (prev) {
        failItem(mem.id, `批次内与《${prev}》同类型同季节`);
      } else {
        seen.set(key, mem.location);
      }
    }
  }

  return { ok: global.length === 0 && Object.keys(perItem).length === 0, global, perItem };
}

/* ---------------- 统计 ---------------- */

export interface RoomUsage {
  room: Room;
  used: number;
  free: number;
  pct: number;
}

export function getRoomUsage(rooms: Room[], memories: SmellMemory[]): RoomUsage[] {
  return rooms.map((room) => {
    const used = memories.filter((m) => m.location === room.name).length;
    return {
      room,
      used,
      free: Math.max(room.capacity - used, 0),
      pct: room.capacity > 0 ? Math.min(100, Math.round((used / room.capacity) * 100)) : 0,
    };
  });
}

export interface RoomSlice {
  roomName: string;
  count: number;
}

/** 已确认批次按目标房间分布（按批次数） */
export function getBatchRoomSlices(batches: RelocationBatch[]): RoomSlice[] {
  const map = new Map<string, number>();
  for (const b of batches) {
    if (b.status !== 'confirmed') continue;
    map.set(b.targetRoomName, (map.get(b.targetRoomName) ?? 0) + 1);
  }
  return Array.from(map, ([roomName, count]) => ({ roomName, count })).sort((a, b) => b.count - a.count);
}

export interface DayPoint {
  date: string;
  count: number;
}

/** 已确认批次交接日时间线（按搬迁记忆条数） */
export function getHandoverTimeline(batches: RelocationBatch[]): DayPoint[] {
  const map = new Map<string, number>();
  for (const b of batches) {
    if (b.status !== 'confirmed') continue;
    map.set(b.handoverDate, (map.get(b.handoverDate) ?? 0) + b.memoryIds.length);
  }
  return Array.from(map, ([date, count]) => ({ date, count })).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
