// 요청 하나를 가리키는 uuid v4(RFC 4122). 재시도 때 같은 값을 다시 보내 서버가 같은 요청으로 알아보게 한다(send_cheer p_request_id, 서버 0059).
// 비밀 값이 아니라 '같은 요청인가' 표지라, 암호학적 난수(crypto.getRandomValues, index.js 폴리필)가 없으면 Math.random 으로 대신한다
// — 응원 보내기가 난수 문제로 막히면 안 된다(충돌 확률은 같은 자녀 안에서만 의미가 있어 무시할 만하다).
export function uuidV4(rand: (n: number) => Uint8Array = randomBytes): string {
  const b = rand(16);
  b[6] = (b[6] & 0x0f) | 0x40; // 버전 4
  b[8] = (b[8] & 0x3f) | 0x80; // 변형 10xx
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const g = (globalThis as {crypto?: {getRandomValues?: (a: Uint8Array) => Uint8Array}}).crypto;
  if (g?.getRandomValues) {
    g.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}
