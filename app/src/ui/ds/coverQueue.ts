import {useCallback, useEffect, useState} from 'react';

/**
 * 덮개(cover) 큐 — 하루 하나(전문가 리뷰 A8 7/8, P-07).
 * 덮개 = 사용자가 누르지 않았는데 화면 위에 뜨는 대화상자·시트(알림 안내 N1, 새 연결 안내, 권유 등).
 * 사용자가 버튼을 눌러 연 대화상자(지우기 확인 등)는 덮개가 아니다 — 큐를 거치지 않는다.
 * 규칙: 같은 날(KST) 덮개는 하나만. 오늘 이미 하나를 보였으면 다른 덮개는 거절되고(호출부가 다음 날 다시 청한다),
 *       지금 떠 있는 덮개가 있으면 그 덮개가 닫힐 때까지 기다리지 않고 거절한다(겹쳐 뜨지 않음).
 * 저장: 마지막으로 보인 날만. 앱 조립(app/)이 prefs 로 configureCoverQueue 를 부른다. ui 는 저장소를 모른다(ARCHITECTURE 2절).
 */
export type CoverStore = {load(): Promise<string | null>; save(day: string): Promise<void>};

const kstDay = (now: Date) => new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

export function createCoverQueue(opts: {store?: CoverStore; now?: () => Date} = {}) {
  let store: CoverStore | undefined = opts.store;
  const now = opts.now ?? (() => new Date());
  let shownDay: string | null | undefined; // undefined = 아직 읽지 않음
  let active: string | null = null;
  // 요청을 한 줄로 세운다(PR #148 리뷰 M1): 첫 읽기(load) 전에 둘이 동시에 오면 둘 다 null 을 보고 둘 다 허락되던 경합
  let tail: Promise<unknown> = Promise.resolve();

  const day = async () => {
    if (shownDay === undefined) {
      shownDay = store ? await store.load().catch(() => null) : null;
    }
    return shownDay;
  };

  return {
    /** 덮개 id 를 지금 보여도 되면 true(오늘 몫을 쓴다). 이미 보인 날이거나 다른 덮개가 떠 있으면 false */
    request(id: string): Promise<boolean> {
      const run = async () => {
        if (active === id) {
          return true;
        }
        const today = kstDay(now());
        if (active !== null || (await day()) === today) {
          return false;
        }
        active = id;
        shownDay = today;
        // 저장 실패(리뷰 L2): 이 실행 동안은 메모리(shownDay)로 하루 하나를 지킨다. 저장소가 계속 고장이면 앱을 켤 때마다 하나가 뜰 수 있다 —
        // 덮개(알림 안내 등)를 영영 막는 쪽보다 낫다고 보고 보임 쪽(fail-open)으로 둔다
        await store?.save(today).catch(() => {});
        return true;
      };
      const p = tail.then(run, run);
      tail = p.catch(() => {});
      return p;
    },
    /** 덮개가 닫혔다(오늘 몫은 그대로 쓴 것으로 남는다) */
    release(id: string) {
      if (active === id) {
        active = null;
      }
    },
    /** 앱 조립에서 저장소를 붙인다(처음 한 번) */
    configure(next: CoverStore) {
      store = next;
      shownDay = undefined;
    },
    /** 테스트용 */
    reset() {
      shownDay = undefined;
      active = null;
    },
  };
}

export const coverQueue = createCoverQueue();
export const configureCoverQueue = (s: CoverStore) => coverQueue.configure(s);

/**
 * 덮개를 보이고 싶을 때(want) 큐에 청하고, 허락되면 visible. close() 로 닫는다.
 * 거절되면 이번 실행에서는 보이지 않는다(다음 날 화면이 다시 청한다).
 */
export function useCover(id: string, want: boolean, queue = coverQueue) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!want) {
      return;
    }
    // 리뷰 L3: 다시 실행돼도(StrictMode 이중 effect 등) 다시 청한다 — 같은 id 가 이미 떠 있으면 큐가 그대로 허락한다
    let alive = true;
    queue.request(id).then(ok => {
      if (!ok) {
        return;
      }
      if (alive) {
        setVisible(true);
      } else {
        // 리뷰 #150 L2: 허락이 오기 전에 화면이 내려갔으면 바로 놓는다(언마운트된 화면이 active 를 붙잡아 다른 덮개를 막지 않게)
        queue.release(id);
      }
    });
    return () => {
      alive = false;
    };
  }, [want, id, queue]);
  useEffect(() => () => queue.release(id), [id, queue]);
  const close = useCallback(() => {
    setVisible(false);
    queue.release(id);
  }, [id, queue]);
  return {visible, close};
}
