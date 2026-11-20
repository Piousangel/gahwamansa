/**
 * @jest-environment node
 */
// 디자인 시스템 v4 위반 수 기준선(SUMMARY 3절 '기준선 테스트 dsBaseline'). lint 는 warn 이라 npm run lint 가 막지 못하므로 여기서 수를 지킨다.
// 늘면 실패: 새 화면 코드는 ui/ds(Text role·Button·Field·Dock)를 쓴다. 줄면 실패: 아래 숫자를 내려 기준선을 갱신한다(화면을 v4 로 옮긴 PR 에서).
// 규칙은 .eslintrc.js DS_SYNTAX·DS_IMPORT_PATHS(features/·app/·push/ 화면, ui/ 제외). 메시지 앞머리 [DS:종류] 로 센다.
declare const __dirname: string;
declare const process: {pid: number};
type LintMessage = {ruleId: string | null; message: string};
type LintResult = {filePath: string; messages: LintMessage[]};
const {ESLint}: {
  ESLint: new (o: {cwd: string}) => {lintFiles(p: string[]): Promise<LintResult[]>; lintText(code: string, o: {filePath: string}): Promise<LintResult[]>};
} = require('eslint');
const path: {join(...p: string[]): string; relative(a: string, b: string): string} = require('path');

// P3 코스 홈 v4(ui/ds, 11-20): text20Size −6·rnImport −1·fontScale −1
// 기준선(2026-11-19, ds/v4-lint, main #35 병합 + push/ 화면 포함). 종류별 위반 수 — 합계 193(height 12건은 모두 width 와 함께라 fixedBox 로 옮김)
// v3Color 새 종류(디자인 시스템 패널 r1, 11-20): color.ink·color.inkSub 참조 28(features·app·push). 값은 v4 로 옮겼고(inkSub 7.70) 이름은 화면 이행 때 tone 으로
// C2 재연결 번호(CodeShow)·C6 곧 유료 시트(ui/ds, 11-20): text20Size −2
// 계정 지우기·지운 뒤(어르신·자녀 공용 ui/ds, 11-20): text20Size −8·rnImport −1·fontScale −1·fontSize −1
// CG 자녀 시작 결정(ds DsScreen·StateView, 11-20): text20Size −2
// C1 호칭(ds Choice 2열·C2 건너뜀) + C4 호칭 겹침 안내(ds Sheet·Choice), 11-20: text20Size −1
// P7 완료 앨범(ui/ds, 11-20): 165 → 162 (text20Size −2·rnImport −1)
// C4 홈 나머지(부품 ui/ds, 11-20): 164 → 159 (text20Size −5)
// C8 앱 정보(부품 ui/ds, 11-20): 165 → 164 (text20Size −1)
// C7 설정(부품 ui/ds, 11-20): 166 → 165 (text20Size −1)
// C5 지난 답(부품 ui/ds, 11-20): 168 → 166 (text20Size −2)
// 응원 시트 v4(ds Sheet + Choice, 11-19): 170 → 168 (text20Size −1·rnImport −1)
// C3 v4(연결 기다리는 중, 11-19): 177 → 170 (fixedBox −1·text20Size −6)
// C0 v4(로그인 3화면 ui/ds, 11-19): 193 → 177 (fontSize −2·fontWeight −2·lineHeight −1·fixedBox −1·fontScale −1·placeholder −1·text20Size −4·rnImport −4)
// L2-v4 P4·P5(ui/ds, 11-19, #87·#93 병합 뒤): 168 → 154 (text20Size −11·rnImport −2·fontScale −1)
const BASELINE: Record<string, number> = {
  fontSize: 6,
  fontWeight: 6,
  lineHeight: 2,
  color: 0,
  height: 0, // 글자 상자 후보(가로는 늘고 높이만 고정). AU-10 에 error
  fixedBox: 10, // 가로·세로 고정(아이콘·이미지·원·도장·테이프). warn 유지(PR #31 리뷰 L1)
  numberOfLines: 0,
  fontScale: 12,
  placeholder: 0,
  text20Size: 61,
  rnImport: 21,
  ellipsis: 0,
  v3Color: 27, // #146 C6 PaidSheet −1
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

// D-14(전문가 리뷰 r2, 2026-11-20): 단일화 완료 판정. 위 lint 기준선은 ui/ 안과 v3 토큰 참조를 세지 않아 '이행 끝'을 판정하지 못한다.
// src/ 전체(ui/ 포함)에서 v3 토큰(ui/tokens)과 옛 컴포넌트 5종을 import·re-export 하는 문장 수를 센다. **완료 = 모두 0.**
// 늘면 실패(새 코드는 ui/ds·tokensV4), 줄면 실패(숫자를 내린다). ui/ds/Screen 이 ui/Screen 을 감싸는 것도 센다(완료 전에 풀어야 할 의존).
const LEGACY_BASELINE: Record<string, number> = {
  v3Tokens: 54, // ui/tokens (P3 코스 홈 −1. #146 C2·C6 −2. 11-20: 화면 이행으로 56, ds Dialog +1: scrim 이 tokensV4 생성물에 아직 없다 — Sheet 와 같이 v3 color.scrim, 생성기가 shadow·scrim 을 내보내면 둘 다 뺀다)
  Screen: 16, // ui/Screen (P3 −1)
  BigButton: 12, // ui/BigButton (P3 −1)
  ChoiceGrid: 0, // ui/ChoiceGrid
  BottomSheet: 1, // ui/BottomSheet
  Text20: 34, // ui/Text20 (P3 −1)
};
const LEGACY_MODULE: Record<string, string> = {v3Tokens: 'ui/tokens', Screen: 'ui/Screen', BigButton: 'ui/BigButton', ChoiceGrid: 'ui/ChoiceGrid', BottomSheet: 'ui/BottomSheet', Text20: 'ui/Text20'};

const fsx: {readdirSync(p: string, o: {withFileTypes: true}): {name: string; isDirectory(): boolean}[]; readFileSync(p: string, e: string): string} = require('fs');
const pathx: {join(...p: string[]): string; dirname(p: string): string; resolve(...p: string[]): string; relative(a: string, b: string): string} = require('path');

/** src 아래 .ts/.tsx 에서 모듈별 import·export-from 수와 쓰는 파일 */
export function countLegacyImports(srcDir: string): {counts: Record<string, number>; files: Record<string, string[]>} {
  const counts: Record<string, number> = Object.fromEntries(Object.keys(LEGACY_MODULE).map(k => [k, 0]));
  const files: Record<string, string[]> = Object.fromEntries(Object.keys(LEGACY_MODULE).map(k => [k, [] as string[]]));
  const walk = (dir: string): string[] =>
    fsx.readdirSync(dir, {withFileTypes: true}).flatMap(e => (e.isDirectory() ? walk(pathx.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [pathx.join(dir, e.name)] : []));
  const re = /(?:import|export)[^'"]*?from\s+['"](\.[^'"]+)['"]/g;
  for (const file of walk(srcDir)) {
    const self = pathx.relative(srcDir, file).replace(/\.tsx?$/, '');
    for (const m of fsx.readFileSync(file, 'utf8').matchAll(re)) {
      const target = pathx.relative(srcDir, pathx.resolve(pathx.dirname(file), m[1]));
      for (const [k, mod] of Object.entries(LEGACY_MODULE)) {
        if (target === mod && self !== mod) {
          counts[k] += 1;
          files[k].push(self);
        }
      }
    }
  }
  return {counts, files};
}

test('D-14 단일화 기준선: v3 토큰·옛 컴포넌트 import 수(완료 = 모두 0)', () => {
  const {counts, files} = countLegacyImports(pathx.join(__dirname, '../src'));
  if (JSON.stringify(counts) !== JSON.stringify(LEGACY_BASELINE)) {
    // 어긋날 때 어느 파일인지 보이게
    console.log(JSON.stringify(files, null, 1));
  }
  expect(counts).toEqual(LEGACY_BASELINE);
});

test('D-14 세는 방식: 상대 경로·re-export 를 세고, 모듈 자신과 다른 이름은 세지 않는다', () => {
  const tmp: string = require('os').tmpdir();
  const root = pathx.join(tmp, `legacy-${process.pid}-${Date.now()}`);
  const fsw: {mkdirSync(p: string, o: object): void; writeFileSync(p: string, d: string): void; rmSync(p: string, o: object): void} = require('fs');
  fsw.mkdirSync(pathx.join(root, 'ui/ds'), {recursive: true});
  fsw.mkdirSync(pathx.join(root, 'features/a'), {recursive: true});
  fsw.writeFileSync(pathx.join(root, 'ui/Screen.tsx'), "import {color} from './tokens';\n");
  fsw.writeFileSync(pathx.join(root, 'ui/ds/Screen.tsx'), "import {Screen} from '../Screen';\nexport {Text20} from '../Text20';\n");
  fsw.writeFileSync(pathx.join(root, 'features/a/X.tsx'), "import {BigButton} from '../../ui/BigButton';\nimport {tokensV4} from '../../ui/tokensV4';\nimport {Text20,\n  other} from '../../ui/Text20';\n");
  try {
    expect(countLegacyImports(root).counts).toEqual({v3Tokens: 1, Screen: 1, BigButton: 1, ChoiceGrid: 0, BottomSheet: 0, Text20: 2});
  } finally {
    fsw.rmSync(root, {recursive: true, force: true});
  }
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
