// 旧版本（v0）本地数据迁移测试
const store = new Map<string, string>();
Object.assign(globalThis, { localStorage: {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  get length() { return store.size; },
} });

// 模拟旧版本数据：无 room_id / rooms / batches，version 0
const { mockMemories } = await import('../src/data/mockData');
const oldMemories = mockMemories.map((m) => {
  const copy: Partial<typeof m> = { ...m };
  delete copy.room_id;
  return copy;
});
store.set('scent-memory-storage', JSON.stringify({
  state: { memories: oldMemories },
  version: 0,
}));

const { useMemoryStore } = await import('../src/store/memoryStore');

let passed = 0;
let failed = 0;
function assert(cond: boolean, name: string, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`, extra ?? ''); }
}

const S = useMemoryStore.getState();
assert(S.rooms.length === 5, '迁移后房间已补齐');
assert(Array.isArray(S.batches) && S.batches.length === 0, '迁移后批次档案为空数组');
assert(S.memories.every((m) => m.room_id !== undefined), '每条记忆都有 room_id 字段');
assert(S.memories.find((m) => m.id === 'mock-001')?.room_id === 'room-east', 'mock 记忆按 id 回填归属');
assert(S.memories.length === 8, '记忆数量不变');

console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
