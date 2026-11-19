/**
 * @jest-environment node
 */
// 디자인 시스템 v4 위반 수 기준선(SUMMARY 3절 '기준선 테스트 dsBaseline'). lint 는 warn 이라 npm run lint 가 막지 못하므로 여기서 수를 지킨다.
// 늘면 실패: 새 화면 코드는 ui/ds(Text role·Button·Field·Dock)를 쓴다. 줄면 실패: 아래 숫자를 내려 기준선을 갱신한다(화면을 v4 로 옮긴 PR 에서).
// 규칙은 .eslintrc.js DS_SYNTAX·DS_IMPORT_PATHS(features/·app/ 만, ui/ 제외). 메시지 앞머리 [DS:종류] 로 센다.
declare const __dirname: string;
type LintMessage = {ruleId: string | null; message: string};
type LintResult = {filePath: string; messages: LintMessage[]};
const {ESLint}: {ESLint: new (o: {cwd: string}) => {lintFiles(p: string[]): Promise<LintResult[]>}} = require('eslint');
const path: {join(...p: string[]): string; relative(a: string, b: string): string} = require('path');

// 기준선(2026-11-19, ds/v4-lint, main 병합 1e6b7ff 기준). 종류별 위반 수 — 합계 188
const BASELINE: Record<string, number> = {
  fontSize: 9,
  fontWeight: 8,
  lineHeight: 3,
  color: 0,
  height: 12,
  numberOfLines: 0,
  fontScale: 16,
  placeholder: 2,
  text20Size: 107,
  rnImport: 31,
};

jest.setTimeout(180000);

test('DS 위반 수가 기준선과 같다(늘면 ui/ds 로, 줄면 숫자를 내린다)', async () => {
  const root = path.join(__dirname, '..');
  const results = await new ESLint({cwd: root}).lintFiles(['src/**/*.{ts,tsx}']);
  const counts: Record<string, number> = Object.fromEntries(Object.keys(BASELINE).map(k => [k, 0]));
  const inUi: string[] = [];
  for (const r of results) {
    for (const m of r.messages) {
      const kind = /\[DS:(\w+)\]/.exec(m.message)?.[1];
      if (!kind) {
        continue;
      }
      counts[kind] = (counts[kind] ?? 0) + 1;
      const rel = path.relative(root, r.filePath);
      if (rel.startsWith('src/ui/')) {
        inUi.push(rel);
      }
    }
  }
  expect(counts).toEqual(BASELINE);
  // ui/ 는 컴포넌트를 만드는 곳이라 규칙 밖(예외는 컴포넌트 안에서 주석·테스트로 명시)
  expect(inUi).toEqual([]);
});

export {};
