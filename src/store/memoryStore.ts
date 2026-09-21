import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion, Room, RelocationBatch } from '../utils/constants';
import { getSeasonInfo, getSmellTypeInfo } from '../utils/constants';
import { generateId, localDateStr, getLockedMemoryIds } from '../utils/helpers';
import { mockMemories, defaultRooms } from '../data/mockData';

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
  room_id: string | null;
}

export interface BatchInput {
  memory_ids: string[];
  target_room_id: string;
  handover_date: string;
  reason: string;
}

export interface BatchResult {
  ok: boolean;
  errors: string[];
}

const typeSeasonLabel = (m: SmellMemory) =>
  `${getSmellTypeInfo(m.smell_type).label}·${getSeasonInfo(m.season).label}`;

/**
 * 搬迁批次校验：任一条件不满足则整批不建、原数据不变。
 * excludeBatchId 用于确认批次时重新校验（排除批次自身的锁定）。
 */
function validateBatch(
  memories: SmellMemory[],
  rooms: Room[],
  batches: RelocationBatch[],
  input: BatchInput,
  excludeBatchId?: string,
): string[] {
  const errors: string[] = [];
  const ids = [...new Set(input.memory_ids)];

  if (ids.length < 2) {
    errors.push('搬迁批次至少需要选择两条记忆');
  }

  const selected = ids
    .map((id) => memories.find((m) => m.id === id))
    .filter((m): m is SmellMemory => !!m);
  if (selected.length !== ids.length) {
    errors.push('部分所选记忆已不存在，请刷新后重试');
  }

  const target = rooms.find((r) => r.id === input.target_room_id);
  if (!target) {
    errors.push('请选择目标房间');
  }
  if (!input.handover_date) {
    errors.push('请选择交接日');
  }
  if (!input.reason.trim()) {
    errors.push('请填写搬迁原因');
  }
  if (selected.length === 0) {
    return errors;
  }

  // 1. 任一记忆缺原房间
  const homeless = selected.filter((m) => !m.room_id);
  if (homeless.length > 0) {
    errors.push(
      `以下记忆缺少原房间，无法搬迁：${homeless.map((m) => `「${m.location}」`).join('、')}（请先在气味档案中编辑并分配房间）`,
    );
  }

  // 2. 任一记忆已被其他待确认批次锁定
  const lockedIds = getLockedMemoryIds(
    excludeBatchId ? batches.filter((b) => b.id !== excludeBatchId) : batches,
  );
  const lockedSelected = selected.filter((m) => lockedIds.has(m.id));
  if (lockedSelected.length > 0) {
    errors.push(
      `以下记忆已在进行中的搬迁批次里：${lockedSelected.map((m) => `「${m.location}」`).join('、')}`,
    );
  }

  if (target) {
    const selectedIds = new Set(ids);
    // 3. 目标房间容量不足（批次外现有占用 + 净迁入数 > 容量）
    const occupancy = memories.filter(
      (m) => m.room_id === target.id && !selectedIds.has(m.id),
    ).length;
    const movingIn = selected.filter((m) => m.room_id !== target.id).length;
    if (occupancy + movingIn > target.capacity) {
      errors.push(
        `目标房间「${target.name}」容量不足：现有 ${occupancy} 条 + 本批迁入 ${movingIn} 条 = ${occupancy + movingIn}，超过容量上限 ${target.capacity}`,
      );
    }

    // 4. 目标房间已有同类型同季节记录
    const existingKeys = new Map<string, SmellMemory>();
    memories
      .filter((m) => m.room_id === target.id && !selectedIds.has(m.id))
      .forEach((m) => existingKeys.set(`${m.smell_type}|${m.season}`, m));
    const conflicts = selected.filter((m) => existingKeys.has(`${m.smell_type}|${m.season}`));
    if (conflicts.length > 0) {
      errors.push(
        `目标房间「${target.name}」已存在同类型同季节的记录：${conflicts
          .map((m) => `「${m.location}」(${typeSeasonLabel(m)})`)
          .join('、')}`,
      );
    }
  }

  // 5. 批次内部同类型同季节重复（迁入后会造成目标房间重复）
  const seen = new Map<string, SmellMemory>();
  const dupLabels = new Set<string>();
  for (const m of selected) {
    const key = `${m.smell_type}|${m.season}`;
    if (seen.has(key)) dupLabels.add(typeSeasonLabel(m));
    seen.set(key, m);
  }
  if (dupLabels.size > 0) {
    errors.push(
      `批次内部存在同类型同季节的记忆（${[...dupLabels].join('、')}），同一房间不允许重复安置`,
    );
  }

  // 6. 交接日早于任一记忆的封存时间
  if (input.handover_date) {
    const tooEarly = selected.filter((m) => input.handover_date < localDateStr(m.created_at));
    if (tooEarly.length > 0) {
      errors.push(
        `交接日 ${input.handover_date} 早于以下记忆的封存时间：${tooEarly
          .map((m) => `「${m.location}」(封存于 ${localDateStr(m.created_at)})`)
          .join('、')}`,
      );
    }
  }

  return errors;
}

interface MemoryStore {
  memories: SmellMemory[];
  rooms: Room[];
  batches: RelocationBatch[];
  addMemory: (input: MemoryInput) => void;
  updateMemory: (id: string, input: MemoryInput) => void;
  deleteMemory: (id: string) => void;
  createBatch: (input: BatchInput) => BatchResult;
  confirmBatch: (id: string) => BatchResult;
  undoBatch: (id: string) => BatchResult;
  cancelBatch: (id: string) => BatchResult;
  initIfEmpty: () => void;
}

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
        if (getLockedMemoryIds(get().batches).has(id)) return; // 搬迁批次锁定中
        set({
          memories: get().memories.map((m) =>
            m.id === id
              ? { ...m, ...input, updated_at: new Date().toISOString() }
              : m,
          ),
        });
      },

      deleteMemory: (id) => {
        if (getLockedMemoryIds(get().batches).has(id)) return; // 搬迁批次锁定中
        set({ memories: get().memories.filter((m) => m.id !== id) });
      },

      createBatch: (input) => {
        const { memories, rooms, batches } = get();
        const errors = validateBatch(memories, rooms, batches, input);
        if (errors.length > 0) {
          return { ok: false, errors }; // 整批不建，原数据不变
        }
        const now = new Date().toISOString();
        const batch: RelocationBatch = {
          id: generateId(),
          items: [...new Set(input.memory_ids)].map((id) => ({
            memory_id: id,
            from_room_id: memories.find((m) => m.id === id)!.room_id!,
          })),
          target_room_id: input.target_room_id,
          handover_date: input.handover_date,
          reason: input.reason.trim(),
          status: 'pending',
          created_at: now,
          confirmed_at: null,
          cancelled_at: null,
          undone_at: null,
          confirm_snapshot: null,
          restore_indices: null,
        };
        set({ batches: [batch, ...batches] });
        return { ok: true, errors: [] };
      },

      confirmBatch: (id) => {
        const { memories, rooms, batches } = get();
        const batch = batches.find((b) => b.id === id);
        if (!batch || batch.status !== 'pending') {
          return { ok: false, errors: ['批次不存在或已被处理'] };
        }
        // 确认前重新校验（容量 / 冲突可能已变化），排除批次自身的锁定
        const errors = validateBatch(
          memories,
          rooms,
          batches,
          {
            memory_ids: batch.items.map((i) => i.memory_id),
            target_room_id: batch.target_room_id,
            handover_date: batch.handover_date,
            reason: batch.reason,
          },
          id,
        );
        if (errors.length > 0) {
          return { ok: false, errors };
        }
        const movingIds = new Set(batch.items.map((i) => i.memory_id));
        // 确认前的位置与内容快照，供撤销时恢复原房间和顺序
        const restore_indices: Record<string, number> = {};
        const confirm_snapshot: Record<string, string> = {};
        memories.forEach((m, idx) => {
          if (movingIds.has(m.id)) {
            restore_indices[m.id] = idx;
            confirm_snapshot[m.id] = m.updated_at;
          }
        });
        // 换房：迁入的记忆移到列表末尾（保持相对顺序），标记新归属
        const moving = memories
          .filter((m) => movingIds.has(m.id))
          .map((m) => ({ ...m, room_id: batch.target_room_id }));
        const rest = memories.filter((m) => !movingIds.has(m.id));
        set({
          memories: [...rest, ...moving],
          batches: batches.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: 'confirmed',
                  confirmed_at: new Date().toISOString(),
                  confirm_snapshot,
                  restore_indices,
                }
              : b,
          ),
        });
        return { ok: true, errors: [] };
      },

      undoBatch: (id) => {
        const { memories, batches } = get();
        const batch = batches.find((b) => b.id === id);
        if (!batch || batch.status !== 'confirmed') {
          return { ok: false, errors: ['仅已确认的批次可以撤销'] };
        }
        // 未再修改才可撤销
        const snapshot = batch.confirm_snapshot ?? {};
        const errors: string[] = [];
        const missing: string[] = [];
        const modified: string[] = [];
        for (const item of batch.items) {
          const m = memories.find((mm) => mm.id === item.memory_id);
          if (!m) {
            missing.push(item.memory_id);
          } else if (m.updated_at !== snapshot[item.memory_id]) {
            modified.push(m.location);
          }
        }
        if (missing.length > 0) {
          errors.push('批次内部分记忆已被删除，无法完整恢复原房间和顺序');
        }
        if (modified.length > 0) {
          errors.push(
            `以下记忆在确认后被修改过：${modified.map((l) => `「${l}」`).join('、')}，无法撤销`,
          );
        }
        if (errors.length > 0) {
          return { ok: false, errors };
        }
        // 恢复原房间
        const fromRoom = new Map(batch.items.map((i) => [i.memory_id, i.from_room_id]));
        const movingIds = new Set(batch.items.map((i) => i.memory_id));
        const moving = memories
          .filter((m) => movingIds.has(m.id))
          .map((m) => ({ ...m, room_id: fromRoom.get(m.id)! }));
        const rest = memories.filter((m) => !movingIds.has(m.id));
        // 恢复原顺序：按确认前的位置快照逐一插回
        const result = [...rest];
        const indices = batch.restore_indices ?? {};
        const sortedItems = [...batch.items].sort(
          (a, b) => (indices[a.memory_id] ?? 0) - (indices[b.memory_id] ?? 0),
        );
        for (const item of sortedItems) {
          const mem = moving.find((m) => m.id === item.memory_id)!;
          const idx = Math.min(indices[item.memory_id] ?? result.length, result.length);
          result.splice(idx, 0, mem);
        }
        set({
          memories: result,
          batches: batches.map((b) =>
            b.id === id
              ? { ...b, status: 'undone', undone_at: new Date().toISOString() }
              : b,
          ),
        });
        return { ok: true, errors: [] };
      },

      cancelBatch: (id) => {
        const { batches } = get();
        const batch = batches.find((b) => b.id === id);
        if (!batch || batch.status !== 'pending') {
          return { ok: false, errors: ['仅待确认的批次可以取消'] };
        }
        // 待确认批次尚未改动任何记忆数据，取消即完整回滚（锁定随之解除）
        set({
          batches: batches.map((b) =>
            b.id === id
              ? { ...b, status: 'cancelled', cancelled_at: new Date().toISOString() }
              : b,
          ),
        });
        return { ok: true, errors: [] };
      },

      initIfEmpty: () => {
        const { memories, rooms } = get();
        if (rooms.length === 0) {
          set({ rooms: defaultRooms });
        }
        if (memories.length === 0) {
          set({ memories: mockMemories });
        }
      },
    }),
    {
      name: 'scent-memory-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as {
          memories?: SmellMemory[];
          rooms?: Room[];
          batches?: RelocationBatch[];
        };
        if (version < 1) {
          // 旧版本数据：补房间与批次档案，记忆按 mock id 回填归属，其余标记为未归档
          state.rooms = state.rooms?.length ? state.rooms : defaultRooms;
          state.batches = state.batches ?? [];
          state.memories = (state.memories ?? []).map((m) => {
            if (m.room_id !== undefined) return m;
            const mock = mockMemories.find((mm) => mm.id === m.id);
            return { ...m, room_id: mock?.room_id ?? null };
          });
        }
        return state;
      },
    },
  ),
);
