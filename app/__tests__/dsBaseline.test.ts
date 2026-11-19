/**
 * @jest-environment node
 */
// 디자인 시스템 v4 위반 수 기준선(SUMMARY 3절 '기준선 테스트 dsBaseline'). lint 는 warn 이라 npm run lint 가 막지 못하므로 여기서 수를 지킨다.
// 늘면 실패: 새 화면 코드는 ui/ds(Text role·Button·Field·Dock)를 쓴다. 줄면 실패: 아래 숫자를 내려 기준선을 갱신한다(화면을 v4 로 옮긴 PR 에서).
// 규칙은 .eslintrc.js DS_SYNTAX·DS_IMPORT_PATHS(features/·app/·push/ 화면, ui/ 제외). 메시지 앞머리 [DS:종류] 로 센다.
declare const __dirname: string;
type LintMessage = {ruleId: string | null; message: string};
type LintResult = {filePath: string; messages: LintMessage[]};
const {ESLint}: {
  ESLint: new (o: {cwd: string}) => {lintFiles(p: string[]): Promise<LintResult[]>; lintText(code: string, o: {filePath: string}): Promise<LintResult[]>};
} = require('eslint');
const path: {join(...p: string[]): string; relative(a: string, b: string): string} = require('path');

// 기준선(2026-11-19, ds/v4-lint, main #35 병합 + push/ 화면 포함). 종류별 위반 수 — 합계 193(height 12건은 모두 width 와 함께라 fixedBox 로 옮김)
// C7 설정(부품 ui/ds, 11-20): 166 → 165 (text20Size −1)
// C5 지난 답(부품 ui/ds, 11-20): 168 → 166 (text20Size −2)
// 응원 시트 v4(ds Sheet + Choice, 11-19): 170 → 168 (text20Size −1·rnImport −1)
// C3 v4(연결 기다리는 중, 11-19): 177 → 170 (fixedBox −1·text20Size −6)
// C0 v4(로그인 3화면 ui/ds, 11-19): 193 → 177 (fontSize −2·fontWeight −2·lineHeight −1·fixedBox −1·fontScale −1·placeholder −1·text20Size −4·rnImport −4)
const BASELINE: Record<string, number> = {
  fontSize: 7,
  fontWeight: 6,
  lineHeight: 2,
  color: 0,
  height: 0, // 글자 상자 후보(가로는 늘고 높이만 고정). AU-10 에 error
  fixedBox: 10, // 가로·세로 고정(아이콘·이미지·원·도장·테이프). warn 유지(PR #31 리뷰 L1)
  numberOfLines: 0,
  fontScale: 15,
  placeholder: 0,
  text20Size: 99,
  rnImport: 26,
  ellipsis: 0,
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

const KINDS_OF = (r: LintResult[]) => r.flatMap(x => x.messages.map(m => /\[DS:(\w+)\]/.exec(m.message)?.[1]).filter(Boolean));

// 규칙이 실제로 잡는지(우회 경로 포함, PR #31 리뷰 M2·M3·L4). 화면 경로에 놓인 코드 조각을 lint 한다
test.each([
  ['ellipsisException', "import {Text} from '../../ui/ds';\nexport const A = () => <Text role=\"body\" ellipsisException={{lines: 1, reason: 'wordCell'}}>a</Text>;\n", 'ellipsis'],
  ['ellipsizeMode', "import {Text} from '../../ui/ds';\nexport const A = () => <Text role=\"body\" ellipsizeMode=\"tail\">a</Text>;\n", 'ellipsis'],
  ['TouchableOpacity', "import {TouchableOpacity} from 'react-native';\nexport const A = TouchableOpacity;\n", 'rnImport'],
  ['Animated.Text', "import {Animated} from 'react-native';\nexport const A = () => <Animated.Text>a</Animated.Text>;\n", 'rnImport'],
  ['import * as RN', "import * as RN from 'react-native';\nexport const A = () => <RN.View />;\n", 'rnImport'],
  ['JSX 색 리터럴', "import {Icon} from '../../ui/assets/icons';\nexport const A = () => <Icon name=\"icon-check\" color=\"#ff0000\" />;\n", 'color'],
  ['Text20 size', "import {Text20} from '../../ui/Text20';\nexport const A = () => <Text20 size={28}>a</Text20>;\n", 'text20Size'],
  ['height 만 고정(글자 상자 후보)', "import {StyleSheet} from 'react-native';\nexport const s = StyleSheet.create({row: {height: 56, padding: 8}});\n", 'height'],
  ['가로·세로 고정 상자', "import {StyleSheet} from 'react-native';\nexport const s = StyleSheet.create({dot: {width: 36, height: 36}});\n", 'fixedBox'],
])('규칙이 잡는다: %s', async (_n, code, kind) => {
  const eslint = new ESLint({cwd: path.join(__dirname, '..')});
  for (const filePath of ['src/features/course/__dsProbe.tsx', 'src/app/__dsProbe.tsx', 'src/push/__dsProbe.tsx']) {
    const r = await eslint.lintText(code, {filePath: path.join(__dirname, '..', filePath)});
    expect([filePath, KINDS_OF(r)]).toEqual([filePath, expect.arrayContaining([kind])]);
  }
  // ui/ 는 잡지 않는다(컴포넌트 안 예외)
  const ui = await eslint.lintText(code, {filePath: path.join(__dirname, '..', 'src/ui/ds/__dsProbe.tsx')});
  expect(KINDS_OF(ui)).toEqual([]);
});

test('가로·세로 고정 상자는 height 로 세지 않는다(오탐 제외, 리뷰 L1)', async () => {
  const eslint = new ESLint({cwd: path.join(__dirname, '..')});
  const code = "import {StyleSheet} from 'react-native';\nexport const s = StyleSheet.create({dot: {width: 36, height: 36}, img: {width: 96, maxHeight: 84}});\n";
  const r = await eslint.lintText(code, {filePath: path.join(__dirname, '..', 'src/features/course/__dsProbe.tsx')});
  expect(KINDS_OF(r)).toEqual(['fixedBox', 'fixedBox']);
});

export {};
