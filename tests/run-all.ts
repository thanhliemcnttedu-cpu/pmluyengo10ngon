// Chạy toàn bộ test: npx tsx tests/run-all.ts — thoát mã khác 0 khi có test lỗi để dùng được trong CI.
import { runRegistered } from './harness';
import './engine.test';
import './symbols.test';
import './lessons.test';
import './hands.test';
import './guidance.test';
import './scoring.test';
import './anatomy.test';
import './games.test';
import './geminiOcr.test';
import './numbering.test';

const results = runRegistered();
let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ok   ${r.name}`);
  } else {
    failed++;
    const msg = r.error instanceof Error ? r.error.message : String(r.error);
    console.log(`  FAIL ${r.name}\n       ${msg.split('\n').join('\n       ')}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
