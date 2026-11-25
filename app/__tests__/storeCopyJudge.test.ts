// 대기열 64(11-26): 기획 v2.1 Q1 — 앱의 판단어는 화면·동의뿐 아니라 스토어에서도 뺀다(writer.md).
// 앱 문구는 monthContract.test.ts 판단어 검사가 붙잡는다. 이 시험은 저장소 밖으로 나가는 스토어·홍보 문안만 본다.
// 팀 메모(왜 바꿨는지 적은 줄)는 검사하지 않는다 — 콘솔·그래픽·인쇄물에 그대로 들어가는 칸만 잘라 본다.
// fs·path 는 require(앱 tsconfig 에 node 타입이 없다 — audioEngines.test.ts 와 같은 꼴)
// export {} 로 모듈 범위(이름이 다른 시험 파일 전역과 부딪히지 않게)
export {};
const fs = require('fs');
const path = require('path');

const JUDGE = /취향|좋아하시|알아서|마음 ?가는/; // monthContract.test.ts 와 같은 식
const docs = (p: string): string => fs.readFileSync(path.join(__dirname, '../../docs', p), 'utf8');

// play-console-draft: §2(짧은 설명 인용줄)~§3.2(출시 노트)의 ``` 블록·인용줄·3.1 캡션 표 행
function playConsoleShipped(md: string): string[] {
  const part = md.slice(md.indexOf('## 2. 짧은 설명'), md.indexOf('## 4. 앱 콘텐츠'));
  const blocks = [...part.matchAll(/```\n([\s\S]*?)```/g)].map(m => m[1]);
  const lines = part.split('\n').filter(l => l.startsWith('> ') || /^\| (feature_|s\d_)/.test(l));
  return [...blocks, ...lines];
}
// store-number-one: <!-- store-copy:start --> ~ end 칸(이름·짧은 설명·긴 설명 2안·스크린샷 문구)
function between(md: string, a: string, b: string): string {
  const i = md.indexOf(a);
  const j = md.indexOf(b);
  if (i < 0 || j < i) throw new Error(`표지 없음: ${a}`);
  return md.slice(i, j);
}
const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '\n');
const hits = (label: string, parts: string[]) => parts.flatMap(t => t.split('\n')).filter(l => JUDGE.test(l)).map(l => `${label}: ${l.trim()}`);

test('스토어·그래픽·인쇄물 문안에 판단어가 없다', () => {
  const pc = playConsoleShipped(docs('team/store/play-console-draft.md'));
  expect(pc.length).toBeGreaterThan(5); // 칸을 실제로 잘라 냈다(제목이 바뀌어 빈 검사가 되지 않게)
  expect([
    ...hits('play-console-draft', pc),
    ...hits('store-number-one', [between(docs('team/marketing/2026-11-24-store-number-one.md'), '<!-- store-copy:start -->', '<!-- store-copy:end -->')]),
    ...hits('STORE_graphics', [text(docs('design/v3/store/STORE_graphics.dc.html'))]),
    ...hits('facility-handout', [text(docs('team/marketing/2026-11-25-facility-handout.html'))]),
  ]).toEqual([]);
});

test('검사가 실제로 붙잡는다(예전 캡션 꼴)', () => {
  const old = '## 2. 짧은 설명\n> 하루 한 장\n### 3.1\n| s3_choose | 마음 가는 쪽을 / 하나 골라요 | — |\n| s5_album | 고른 답으로 / 부모님 취향을 알아 가요 | — |\n- 메모: 취향은 뺐다\n## 4. 앱 콘텐츠';
  expect(hits('x', playConsoleShipped(old))).toHaveLength(2); // 메모 줄은 세지 않는다
  expect(hits('h', [text('<div>마음가는 쪽을<br>하나 골라요</div>')])).toHaveLength(1);
});
