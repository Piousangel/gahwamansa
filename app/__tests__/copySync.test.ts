// 문구 원본(docs/team/copy.ko.json)과 앱 사본(src/copy/copy.ko.json)이 바이트까지 같아야 한다(ARCHITECTURE 6절, 계획 12 1-1).
// 실패하면 원본만 고친 상태 → 저장소 루트에서 scripts/sync-copy.sh 실행. 사본을 손으로 고치지 않는다.
declare const __dirname: string;
type Buf = {equals(o: Buf): boolean};
const fs: {readFileSync(f: string): Buf; readFileSync(f: string, e: 'utf8'): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');

const SRC = path.join(__dirname, '../../docs/team/copy.ko.json');
const DST = path.join(__dirname, '../src/copy/copy.ko.json');

test('문구 사본이 원본과 바이트까지 같다(scripts/sync-copy.sh)', () => {
  expect(fs.readFileSync(DST).equals(fs.readFileSync(SRC))).toBe(true);
});

test('동기화 스크립트가 있고 --check 를 지원한다', () => {
  const script = fs.readFileSync(path.join(__dirname, '../../scripts/sync-copy.sh'), 'utf8');
  expect(script).toContain('--check');
  expect(script).toContain('docs/team/copy.ko.json');
  expect(script).toContain('app/src/copy/copy.ko.json');
});

export {};
