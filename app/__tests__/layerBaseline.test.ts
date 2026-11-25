/**
 * @jest-environment node
 */
// 레이어 규칙 기준선(ARCHITECTURE 2절, 계획 12 1-3). lint 는 warn 이라 npm run lint 가 막지 못하므로 여기서 수를 지킨다.
// 늘면 실패: 새 import 를 shared/·ui/·state/ 쪽으로 옮긴다. 줄면 실패: 아래 숫자를 내려 기준선을 갱신한다(.eslintrc.js 주석도).
declare const __dirname: string;
type LintMessage = {ruleId: string | null; message: string};
type LintResult = {messages: LintMessage[]};
const {ESLint}: {ESLint: new (o: {cwd: string}) => {lintFiles(p: string[]): Promise<LintResult[]>}} = require('eslint');
const path: {join(...p: string[]): string} = require('path');

const BASELINE = {app: 61, crossFeature: 5, uiDeps: 1}; // app 59→61: 5단계 ②·⑤ RecallStep·PassOnStep 의 app/session(다른 단계 화면과 같은 세션 읽기 — 내비·뒤로는 app/ 없이, AU-10 에서 함께 옮길 대상); // app 58→59: D-3 TodayReviewScreen 의 app/session(다른 단계 화면과 같은 콘텐츠 읽기, AU-10 에서 함께 옮길 대상); // crossFeature 6→5: P3 v4 가 link/TextLink 대신 ui/ds Button; // app 59→58: CG v4 가 app/BackBar 대신 DsScreen back; // app 61→59: C1 v4 가 app/ChildStack 타입·app/BackBar 대신 CommonActions·DsScreen back; // crossFeature 7→6: C0 v4 가 link/TextLink 대신 ui/ds Button; // app 59→61: features/account/FamilyPreview 의 session·BackBar(PR #11 리뷰 L1 권고, AU-10 에서 ui/shared 로 옮길 대상)

jest.setTimeout(120000);

test('레이어 위반 수가 기준선과 같다', async () => {
  const eslint = new ESLint({cwd: path.join(__dirname, '..')});
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
  // 같은 규칙에 얹은 디자인 시스템 경고([DS:rnImport])는 dsBaseline.test.ts 가 센다
  const msgs = results.flatMap(r =>
    r.messages.filter(m => m.ruleId === 'no-restricted-imports' && !m.message.includes('[DS:')).map(m => m.message),
  );
  const count = (needle: string) => msgs.filter(m => m.includes(needle)).length;
  expect({
    app: count('조립 계층'),
    crossFeature: count('기능 간'),
    uiDeps: count('ui/ 는'),
  }).toEqual(BASELINE);
  // 위 세 갈래 밖의 레이어 위반(아래 계층→features, contract 의 React·copy)은 0
  expect(msgs.length).toBe(BASELINE.app + BASELINE.crossFeature + BASELINE.uiDeps);
});

export {};
