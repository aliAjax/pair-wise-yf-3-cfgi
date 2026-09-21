import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion } from '../utils/constants';
import { generateId } from '../utils/helpers';
import { mockMemories } from '../data/mockData';
import {
  type Room,
  type RelocationBatch,
  type BatchItem,
  type PlanInput,
  validatePlan,
  getUndoBlockers,
  findRoomByLocation,
} from '../utils/relocation';

export interface MemoryInput {
  location: string;
  source_guess: string;
  intensity: number;
  humidity: number;
  season: Season;
  smell_type: SmellType;
  memory_text: string;
  color_association: string;
  emotion: Emotion;
  want_again: boolean;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** 与 mockMemories 一一对应的初始房间及容量 */
export const defaultRooms = (): Room[] => {
  const now = new Date().toISOString();
  const defs: [string, number][] = [
    ['外婆家的老衣柜', 3],
    ['高中教室雨后的走廊', 3],
    ['大学图书馆五楼角落', 2],
    ['爷爷的中药铺', 4],
    ['第一次租的房子的厨房', 3],
    ['春天公园的樱花树下', 5],
    ['老小区的楼道', 6],
    ['童年的海边', 3],
  ];
  return defs.map(([name, capacity], i) => ({
    id: `room-${String(i + 1).padStart(3, '0')}`,
    name,
    capacity,
    created_at: now,
  }));
};

interface MemoryStore {
  memories: SmellMemory[];
  rooms: Room[];
  batches: RelocationBatch[];
  addMemory: (input: MemoryInput) => void;
  updateMemory: (id: string, input: MemoryInput) => ActionResult;
  deleteMemory: (id: string) => ActionResult;
  initIfEmpty: () => void;

  addRoom: (name: string, capacity: number) => ActionResult;
  updateRoomCapacity: (id: string, capacity: number) => ActionResult;
  deleteRoom: (id: string) => ActionResult;

  createBatch: (plan: PlanInput) => ActionResult;
  cancelBatch: (id: string) => ActionResult;
  confirmBatch: (id: string) => ActionResult;
  undoBatch: (id: string) => ActionResult;
}

const lockedMemoryIds = (batches: RelocationBatch[]): Set<string> => {
  const ids = new Set<string>();
  batches
    .filter((b) => b.status === 'draft')
    .forEach((b) => b.memoryIds.forEach((id) => ids.add(id)));
  return ids;
};

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      rooms: [],
      batches: [],

      addMemory: (input) => {
        const now = new Date().toISOString();
        const newMem: SmellMemory = {
          id: generateId(),
          ...input,
          created_at: now,
          updated_at: now,
        };
        set({ memories: [newMem, ...get().memories] });
      },

      updateMemory: (id, input) => {
        if (lockedMemoryIds(get().batches).has(id)) {
          return { ok: false, error: '这条记忆已被待确认的搬迁批次锁定，先确认或取消批次后再修改' };
        }
        set({
          memories: get().memories.map((m) =>
            m.id === id
              ? { ...m, ...input, updated_at: new Date().toISOString() }
              : m,
          ),
        });
        return { ok: true };
      },

      deleteMemory: (id) => {
        if (lockedMemoryIds(get().batches).has(id)) {
          return { ok: false, error: '这条记忆已被待确认的搬迁批次锁定，无法删除' };
        }
        set({ memories: get().memories.filter((m) => m.id !== id) });
        return { ok: true };
      },

      initIfEmpty: () => {
        const state = get();
        const patch: Partial<MemoryStore> = {};
        if (state.memories.length === 0) patch.memories = mockMemories;
        if (state.rooms.length === 0) patch.rooms = defaultRooms();
        if (Object.keys(patch).length) set(patch);
      },

      /* ---------------- 房间 ---------------- */

      addRoom: (name, capacity) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: '请填写房间名称' };
        if (!Number.isInteger(capacity) || capacity < 1) {
          return { ok: false, error: '容量需为不小于 1 的整数' };
        }
        const rooms = get().rooms;
        if (rooms.some((r) => r.name === trimmed)) {
          return { ok: false, error: '已存在同名房间' };
        }
        const room: Room = {
          id: generateId(),
          name: trimmed,
          capacity,
          created_at: new Date().toISOString(),
        };
        set({ rooms: [...rooms, room] });
        return { ok: true };
      },

      updateRoomCapacity: (id, capacity) => {
        const { rooms, memories } = get();
        const room = rooms.find((r) => r.id === id);
        if (!room) return { ok: false, error: '房间不存在' };
        if (!Number.isInteger(capacity) || capacity < 1) {
          return { ok: false, error: '容量需为不小于 1 的整数' };
        }
        const used = memories.filter((m) => m.location === room.name).length;
        if (capacity < used) {
          return { ok: false, error: `容量不能小于当前入住数（${used} 条）` };
        }
        set({
          rooms: rooms.map((r) => (r.id === id ? { ...r, capacity } : r)),
        });
        return { ok: true };
      },

      deleteRoom: (id) => {
        const { rooms, memories, batches } = get();
        const room = rooms.find((r) => r.id === id);
        if (!room) return { ok: false, error: '房间不存在' };
        const used = memories.filter((m) => m.location === room.name).length;
        if (used > 0) return { ok: false, error: `房间里还有 ${used} 条记忆，无法删除` };
        const draftRef = batches.find(
          (b) => b.status === 'draft' && b.targetRoomId === id,
        );
        if (draftRef) return { ok: false, error: '有待确认批次正指向该房间' };
        set({ rooms: rooms.filter((r) => r.id !== id) });
        return { ok: true };
      },

      /* ---------------- 搬迁批次 ---------------- */

      createBatch: (plan) => {
        const { memories, rooms, batches } = get();
        const validation = validatePlan(plan, memories, rooms, batches);
        if (!validation.ok) {
          return { ok: false, error: validation.global.join('；') || '所选记忆存在校验问题，请按提示调整' };
        }
        const target = rooms.find((r) => r.id === plan.targetRoomId)!;
        const now = new Date().toISOString();
        const batch: RelocationBatch = {
          id: generateId(),
          status: 'draft',
          memoryIds: plan.memoryIds,
          targetRoomId: target.id,
          targetRoomName: target.name,
          handoverDate: plan.handoverDate,
          reason: plan.reason.trim(),
          created_at: now,
          confirmed_at: null,
          undone_at: null,
          items: [],
        };
        set({ batches: [...batches, batch] });
        return { ok: true };
      },

      cancelBatch: (id) => {
        const batch = get().batches.find((b) => b.id === id);
        if (!batch) return { ok: false, error: '批次不存在' };
        if (batch.status !== 'draft') return { ok: false, error: '只有待确认批次可以取消' };
        // 取消即丢弃草稿，记忆从未被改动
        set({ batches: get().batches.filter((b) => b.id !== id) });
        return { ok: true };
      },

      confirmBatch: (id) => {
        const state = get();
        const batch = state.batches.find((b) => b.id === id);
        if (!batch) return { ok: false, error: '批次不存在' };
        if (batch.status !== 'draft') return { ok: false, error: '该批次不是待确认状态' };

        const validation = validatePlan(
          {
            memoryIds: batch.memoryIds,
            targetRoomId: batch.targetRoomId,
            handoverDate: batch.handoverDate,
            reason: batch.reason,
          },
          state.memories,
          state.rooms,
          state.batches,
          batch.id,
        );
        if (!validation.ok) {
          return {
            ok: false,
            error:
              validation.global.join('；') ||
              Object.values(validation.perItem)[0] ||
              '当前条件已不满足，请取消批次后重新编排',
          };
        }

        const target = state.rooms.find((r) => r.id === batch.targetRoomId)!;
        const now = new Date().toISOString();
        const moveSet = new Set(batch.memoryIds);
        const afterMap = new Map<string, SmellMemory>();

        const movedMemories = state.memories.map((m) => {
          if (!moveSet.has(m.id)) return m;
          const moved: SmellMemory = { ...m, location: target.name, updated_at: now };
          afterMap.set(m.id, moved);
          return moved;
        });

        // 未搬的保持原顺序；搬走的按批次选择顺序追加到档案末尾（即目标房间队尾）
        const rest = movedMemories.filter((m) => !moveSet.has(m.id));
        const movedOrdered = batch.memoryIds
          .map((mid) => afterMap.get(mid))
          .filter((m): m is SmellMemory => Boolean(m));
        const finalMemories = [...rest, ...movedOrdered];

        const items: BatchItem[] = batch.memoryIds.map((mid, i) => {
          const mem = state.memories.find((m) => m.id === mid)!;
          const fromRoom = findRoomByLocation(state.rooms, mem.location)!;
          return {
            memoryId: mid,
            memoryLabel: mem.location,
            fromRoomId: fromRoom.id,
            fromRoomName: fromRoom.name,
            beforeIndex: state.memories.findIndex((m) => m.id === mid),
            before: mem,
            after: movedOrdered[i] ?? afterMap.get(mid) ?? null,
          };
        });

        set({
          memories: finalMemories,
          batches: state.batches.map((b) =>
            b.id === id
              ? { ...b, status: 'confirmed', confirmed_at: now, targetRoomName: target.name, items }
              : b,
          ),
        });
        return { ok: true };
      },

      undoBatch: (id) => {
        const state = get();
        const batch = state.batches.find((b) => b.id === id);
        if (!batch) return { ok: false, error: '批次不存在' };
        if (batch.status !== 'confirmed') return { ok: false, error: '只有已确认批次可以撤销' };

        const blockers = getUndoBlockers(batch, state.memories);
        if (blockers.length) return { ok: false, error: blockers.join('；') };

        const involved = new Set(batch.items.map((it) => it.memoryId));
        const restArr = state.memories.filter((m) => !involved.has(m.id));
        // 按下标升序插回，恢复原房间与档案顺序
        const inserts = [...batch.items].sort((a, b) => a.beforeIndex - b.beforeIndex);
        for (const item of inserts) {
          restArr.splice(Math.min(item.beforeIndex, restArr.length), 0, item.before!);
        }

        set({
          memories: restArr,
          batches: state.batches.map((b) =>
            b.id === id ? { ...b, status: 'undone', undone_at: new Date().toISOString() } : b,
          ),
        });
        return { ok: true };
      },
    }),
    {
      name: 'scent-memory-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
