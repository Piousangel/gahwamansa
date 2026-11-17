import {sha256Hex, makeNonce, NoSecureRandomError} from '../src/lib/sha256';

test('SHA-256 알려진 값', () => {
  expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  expect(sha256Hex('가화만사성')).toBe(require('crypto').createHash('sha256').update('가화만사성', 'utf8').digest('hex'));
  expect(sha256Hex('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
});

test('nonce 는 매번 다른 64자 hex(32바이트)', () => {
  const a = makeNonce();
  const b = makeNonce();
  expect(a).not.toBe(b);
  expect(a.length).toBeGreaterThanOrEqual(32);
});

test('암호학적 난수가 없으면 Math.random 으로 대체하지 않고 실패한다', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {value: undefined, configurable: true, writable: true});
  const rnd = jest.spyOn(Math, 'random');
  try {
    rnd.mockClear();
    let err: unknown = null;
    try {
      makeNonce();
    } catch (e) {
      err = e;
    }
    const calls = rnd.mock.calls.length; // makeNonce 호출 구간만 센다(jest 내부 호출 제외)
    expect(err).toBeInstanceOf(NoSecureRandomError);
    expect(calls).toBe(0);
  } finally {
    rnd.mockRestore();
    if (saved) {
      Object.defineProperty(globalThis, 'crypto', saved);
    }
  }
});
