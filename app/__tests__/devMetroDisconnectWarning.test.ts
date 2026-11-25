// 내부 테스트 필수 6번 S4(대기열 14): 개발 빌드 logcat 의 `ReactNativeJS: Error: undefined` 는 앱 코드가 아니라
// RN 개발 도구(Fast Refresh)가 Metro 와의 웹소켓을 잃었을 때 내는 경고의 마지막 줄이다(증거: docs/team/qa/evidence/2026-11-25-stability).
//   1) Android WebSocketModule 실패 → JS WebSocket 이 `new Event('error')` 를 보낸다(message 속성 없음)
//   2) metro-runtime HMRClient 가 그 이벤트를 그대로 'connection-error' 로 넘긴다
//   3) RN HMRClient 가 "Cannot connect to Metro … Error: ${e.message}" 를 만들어 console.warn → 마지막 줄이 'Error: undefined'
//      (처음 연결에 성공한 뒤(didConnect)에만 경고 → LogBox 'Open debugger to view warnings')
// release 번들에는 HMRClient 가 없다(개발 전용). 이 시험은 세 사실을 고정한다 — RN·Metro 를 올려 하나라도 바뀌면 실패하니,
// 그때 S4 판정(무해, 앱 수정 없음)을 다시 본다.
export {};
declare const __dirname: string;
// 웹 표준 Event(Node 전역). 앱 tsconfig 에 DOM 타입이 없어 여기서만 선언
declare const Event: {new (type: string): {type: string}};
const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');

const NM = path.join(__dirname, '../node_modules');
const read = (rel: string) => fs.readFileSync(path.join(NM, 'react-native', rel), 'utf8');
const metroHmr = () => fs.readFileSync(path.join(NM, 'metro-runtime/src/modules/HMRClient.js'), 'utf8');

describe("개발 빌드 'Error: undefined' 출처(S4)", () => {
  it('RN WebSocket 은 실패 때 message 없는 Event 를 보낸다', () => {
    const ws = read('Libraries/WebSocket/WebSocket.js');
    const failed = ws.slice(ws.indexOf("'websocketFailed'"));
    expect(failed).toMatch(/this\.dispatchEvent\(new Event\('error'\)\)/);
  });

  it('metro-runtime HMRClient 는 웹소켓 오류 이벤트를 그대로 connection-error 로 넘긴다', () => {
    expect(metroHmr()).toMatch(/onerror = \(error\) => \{\s*this\.emit\("connection-error", error\)/);
  });

  it("RN HMRClient 는 그 이벤트의 message 로 'Error: …' 줄을 만들고, 한 번 연결된 뒤에만 경고한다", () => {
    const hmr = read('Libraries/Utilities/HMRClient.js');
    expect(hmr).toMatch(/client\.on\('connection-error'[\s\S]*?Error: \$\{e\.message\}/);
    expect(hmr).toMatch(/hmrClient\.isEnabled\(\) && didConnect[\s\S]*?console\.warn\(reason\)/);
  });

  it('message 가 없는 Event 를 넣으면 마지막 줄이 정확히 Error: undefined 다', () => {
    const e: {type: string; message?: string} = new Event('error');
    const last = `\nError: ${e.message}`.split('\n').pop();
    expect(last).toBe('Error: undefined');
  });
});
