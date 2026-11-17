// Bộ chạy test tối giản (chỉ dùng node:assert) để không phải thêm thư viện test vào dự án.
export interface TestResult {
  name: string;
  ok: boolean;
  error?: unknown;
}

const registered: { name: string; fn: () => void }[] = [];

export function test(name: string, fn: () => void): void {
  registered.push({ name, fn });
}

export function runRegistered(): TestResult[] {
  return registered.map(({ name, fn }) => {
    try {
      fn();
      return { name, ok: true };
    } catch (error) {
      return { name, ok: false, error };
    }
  });
}
