import {Image} from 'react-native';

// 사진 미리 받기. 실제 저장은 플랫폼 캐시가 한다(Android Fresco 디스크·메모리, iOS NSURLCache/RCTImageCache).
// 여기서는 ① 같은 주소 중복 요청 막기 ② "이미 받아 둠" 기록(페이드 없이 바로 보이기)만 한다.
// 새 의존성(react-native-fast-image 등)은 쓰지 않는다: 하루 사진 몇 장이라 코어로 충분(가정, 실기기 확인 필요).

const ready = new Set<string>();
const inflight = new Map<string, Promise<boolean>>();

function prefetchOne(uri: string): Promise<boolean> {
  if (ready.has(uri)) {
    return Promise.resolve(true);
  }
  const running = inflight.get(uri);
  if (running) {
    return running;
  }
  const p = Promise.resolve()
    .then(() => Image.prefetch(uri))
    .then(ok => {
      if (ok) ready.add(uri);
      return !!ok;
    })
    .catch(() => false) // 실패는 기록하지 않아 다음에 다시 시도한다
    .finally(() => inflight.delete(uri));
  inflight.set(uri, p);
  return p;
}

/** 다음에 볼 사진들을 미리 받는다(예: 코스 홈에서 오늘 사진). 주소마다 성공 여부. */
export function prefetchImages(uris: string[]): Promise<boolean[]> {
  return Promise.all(uris.map(prefetchOne));
}

/** 이 실행 중에 미리 받아 둔 주소인지. */
export function isPrefetched(uri: string | undefined): boolean {
  return !!uri && ready.has(uri);
}

/** 테스트 전용 */
export function __resetImageCache() {
  ready.clear();
  inflight.clear();
}
