// 功能冒烟测试：搬迁批次核心逻辑（在 node 中运行，esbuild 打包）
const store = new Map<string, string>();
Object.assign(globalThis, { localStorage: {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  get length() { return store.size; },
} });

const { useMemoryStore } = await import('../src/store/memoryStore');

let passed = 0;
let failed = 0;
function assert(cond: boolean, name: string, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`, extra ?? ''); }
}

const S = () => useMemoryStore.getState();
const mem = (id: string) => S().memories.find((m) => m.id === id);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

console.log('▶ 初始化');
S().initIfEmpty();
assert(S().memories.length === 8, '初始 8 条记忆');
assert(S().rooms.length === 5, '初始 5 个房间');
assert(mem('mock-001')!.room_id === 'room-east', 'mock 记忆已归档');

console.log('▶ 校验：至少两条记忆');
let r = S().createBatch({ memory_ids: ['mock-001'], target_room_id: 'room-west', handover_date: today(), reason: '测试' });
assert(!r.ok && r.errors.some((e) => e.includes('至少需要')), '单条记忆被拒绝', r.errors);

console.log('▶ 校验：缺原房间');
S().addMemory({
  location: '无房间的记忆', source_guess: '', intensity: 5, humidity: 5,
  season: 'summer', smell_type: 'fresh', memory_text: '', color_association: '#7DA08C',
  emotion: 'peaceful', want_again: false, room_id: null,
});
const homelessId = S().memories[0].id;
r = S().createBatch({ memory_ids: [homelessId, 'mock-002'], target_room_id: 'room-west', handover_date: today(), reason: '测试' });
assert(!r.ok && r.errors.some((e) => e.includes('缺少原房间')), '缺原房间被拒绝', r.errors);
assert(S().batches.length === 0, '校验失败整批不建');

console.log('▶ 校验：容量不足（地窖 1/2，迁入 2 条）');
r = S().createBatch({ memory_ids: ['mock-001', 'mock-006'], target_room_id: 'room-cellar', handover_date: today(), reason: '测试' });
assert(!r.ok && r.errors.some((e) => e.includes('容量不足')), '容量不足被拒绝', r.errors);

console.log('▶ 校验：目标已有同类型同季节（厨房已有 焦味·秋）');
S().addMemory({
  location: '另一条焦味秋天', source_guess: '', intensity: 5, humidity: 5,
  season: 'autumn', smell_type: 'burnt', memory_text: '', color_association: '#4A3728',
  emotion: 'joyful', want_again: false, room_id: 'room-east',
});
const burntId = S().memories[0].id;
r = S().createBatch({ memory_ids: [burntId, 'mock-002'], target_room_id: 'room-kitchen', handover_date: today(), reason: '测试' });
assert(!r.ok && r.errors.some((e) => e.includes('同类型同季节')), '同类型同季节冲突被拒绝', r.errors);

console.log('▶ 校验：批次内部同类型同季节重复');
S().addMemory({
  location: '又一条焦味秋天', source_guess: '', intensity: 5, humidity: 5,
  season: 'autumn', smell_type: 'burnt', memory_text: '', color_association: '#4A3728',
  emotion: 'joyful', want_again: false, room_id: 'room-east',
});
const burnt2Id = S().memories[0].id;
r = S().createBatch({ memory_ids: [burntId, burnt2Id], target_room_id: 'room-west', handover_date: today(), reason: '测试' });
assert(!r.ok && r.errors.some((e) => e.includes('批次内部')), '批次内部重复被拒绝', r.errors);

console.log('▶ 校验：交接日早于封存时间');
r = S().createBatch({ memory_ids: ['mock-001', 'mock-006'], target_room_id: 'room-west', handover_date: '2000-01-01', reason: '测试' });
assert(!r.ok && r.errors.some((e) => e.includes('早于')), '交接日早于封存时间被拒绝', r.errors);

console.log('▶ 校验：必填项');
r = S().createBatch({ memory_ids: ['mock-001', 'mock-006'], target_room_id: '', handover_date: '', reason: '  ' });
assert(!r.ok && r.errors.length >= 3, '缺目标房间/交接日/原因被拒绝', r.errors);

console.log('▶ 创建合法批次 → 锁定');
const before = S().memories.map((m) => m.id);
r = S().createBatch({ memory_ids: ['mock-001', 'mock-006'], target_room_id: 'room-west', handover_date: today(), reason: '东厢房翻修' });
assert(r.ok, '合法批次创建成功', r.errors);
const batchId = S().batches[0].id;
assert(S().batches[0].status === 'pending', '批次为待确认');
S().updateMemory('mock-001', { ...mem('mock-001')!, location: '被篡改' });
assert(mem('mock-001')!.location === '外婆家的老衣柜', '锁定记忆不可编辑');
S().deleteMemory('mock-001');
assert(!!mem('mock-001'), '锁定记忆不可删除');
r = S().createBatch({ memory_ids: ['mock-001', 'mock-002'], target_room_id: 'room-west', handover_date: today(), reason: '测试' });
assert(!r.ok && r.errors.some((e) => e.includes('进行中')), '锁定记忆不可重复入批', r.errors);
assert(S().memories.map((m) => m.id).join() === before.join(), '批次创建不改变列表顺序');

console.log('▶ 确认批次 → 换房 + 移到末尾 + 留档');
const idx001 = S().memories.findIndex((m) => m.id === 'mock-001');
const idx006 = S().memories.findIndex((m) => m.id === 'mock-006');
r = S().confirmBatch(batchId);
assert(r.ok, '确认成功', r.errors);
assert(mem('mock-001')!.room_id === 'room-west', 'mock-001 已换房');
assert(mem('mock-006')!.room_id === 'room-west', 'mock-006 已换房');
const ids = S().memories.map((m) => m.id);
assert(ids[ids.length - 2] === 'mock-001' && ids[ids.length - 1] === 'mock-006', '搬迁记忆移到列表末尾');
assert(S().batches[0].status === 'confirmed' && !!S().batches[0].confirmed_at, '批次已确认留档');

console.log('▶ 撤销批次 → 恢复原房间和顺序');
r = S().undoBatch(batchId);
assert(r.ok, '撤销成功', r.errors);
assert(mem('mock-001')!.room_id === 'room-east', 'mock-001 回到东厢房');
assert(mem('mock-006')!.room_id === 'room-east', 'mock-006 回到东厢房');
assert(S().memories.findIndex((m) => m.id === 'mock-001') === idx001, 'mock-001 恢复原位置');
assert(S().memories.findIndex((m) => m.id === 'mock-006') === idx006, 'mock-006 恢复原位置');
assert(S().batches[0].status === 'undone', '批次状态为已撤销');

console.log('▶ 确认后被修改 → 不可撤销');
r = S().createBatch({ memory_ids: ['mock-001', 'mock-006'], target_room_id: 'room-west', handover_date: today(), reason: '再次搬迁' });
assert(r.ok, '再次创建成功', r.errors);
const batch2 = S().batches[0].id;
S().confirmBatch(batch2);
S().updateMemory('mock-001', { ...mem('mock-001')!, location: '确认后改名' });
r = S().undoBatch(batch2);
assert(!r.ok && r.errors.some((e) => e.includes('修改过')), '确认后被修改不可撤销', r.errors);
assert(mem('mock-001')!.room_id === 'room-west', '撤销失败后数据不变');

console.log('▶ 取消批次 → 完整回滚');
r = S().createBatch({ memory_ids: ['mock-002', 'mock-008'], target_room_id: 'room-east', handover_date: today(), reason: '测试取消' });
assert(r.ok, '创建成功', r.errors);
const batch3 = S().batches[0].id;
const snapshot = JSON.stringify(S().memories);
r = S().cancelBatch(batch3);
assert(r.ok && S().batches[0].status === 'cancelled', '取消成功', r.errors);
assert(JSON.stringify(S().memories) === snapshot, '取消后记忆数据完整回滚');
S().updateMemory('mock-002', { ...mem('mock-002')!, source_guess: '解除锁定后可编辑' });
assert(mem('mock-002')!.source_guess === '解除锁定后可编辑', '取消后锁定解除');

console.log('▶ 持久化');
const persisted = JSON.parse(store.get('scent-memory-storage')!);
assert(persisted.version === 1, '持久化版本为 1');
assert(Array.isArray(persisted.state.batches) && persisted.state.batches.length === 3, '批次已持久化');
assert(Array.isArray(persisted.state.rooms) && persisted.state.rooms.length === 5, '房间已持久化');

console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
