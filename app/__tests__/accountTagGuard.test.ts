// 재검토 R3: accountTag 는 솔트 없는 해시(user id 로 되짚을 수 있음) → 기기 안 저장 키에만. 서버·이벤트·로그로 보내지 않는다.
// 쓰는 파일을 고정하고, 그 파일에서 가명값이 logEvent·rpc·console 로 가지 않는지 본다.
declare const __dirname: string;
type Dirent = {name: string; isDirectory(): boolean};
const fs: {readFileSync(f: string, e: 'utf8'): string; readdirSync(d: string, o: {withFileTypes: true}): Dirent[]} = require('fs');
const path: {join(...p: string[]): string; relative(a: string, b: string): string; sep: string} = require('path');
import {createRealApi} from '../src/features/realApi';

const SRC = path.join(__dirname, '../src');
const ALLOWED = [
  'features/types.ts', 'features/realApi.ts', 'features/fakeApi.ts',
  'features/home/NewConnectionBanner.tsx', 'features/home/PaidSheet.tsx',
  'features/account/DeleteAccountScreen.tsx', 'features/child/ChildSettings.tsx',
  'lib/accountStore.ts', // 주석만
  'push/pushClient.ts', // AU-04 N1 답 기억 키(accountStore)
  'app/PushHost.tsx', // AU-04 리뷰 L5: 알림 탭을 받은 계정과 처리하는 계정 비교(기기 안에서만)
  'shared/childTerms.ts', // PR1 리뷰 M1: 약관 동의 기록 재시도 표시 키(accountStore)
].sort();

function walk(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

test('accountTag() 를 부르는 파일은 정해진 곳뿐', () => {
  const users = walk(SRC)
    .filter(f => /accountTag\s*[(:]/.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(SRC, f).split(path.sep).join('/'))
    .sort();
  expect(users).toEqual(ALLOWED);
});

test('그 파일들에서 가명값(tag)이 logEvent·rpc·console 로 가지 않는다', () => {
  for (const f of ALLOWED) {
    const src = fs.readFileSync(path.join(SRC, f), 'utf8');
    for (const line of src.split('\n')) {
      if (/\b(logEvent|rpc|console\.\w+|track)\s*\(/.test(line)) {
        expect(`${f}: ${line}`).not.toMatch(/\btag\b|accountTag/);
      }
    }
  }
});

test('realApi.accountTag: user id 원문이 아니라 sha256 앞 16자', async () => {
  const id = '11111111-2222-3333-4444-555555555555';
  const sb = {auth: {getSession: jest.fn(() => Promise.resolve({data: {session: {user: {id}}}, error: null}))}};
  const tag = await createRealApi(sb as never).accountTag();
  expect(tag).toMatch(/^[0-9a-f]{16}$/);
  expect(tag).not.toContain('1111');
});
