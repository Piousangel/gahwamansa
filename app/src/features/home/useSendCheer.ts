import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, PixelRatio} from 'react-native';
import {copy, withTitle} from '../../copy/copy';
import {useToast} from '../../ui/Toast';
import {useScreenReader} from '../../ui/a11y';
import {CheerKey, ChildParent, isOffline} from '../types';
import type {Api} from '../types';
import {CheerResultRow, summarizeCheer} from './cheerLogic';
import {track} from '../track';

const c = copy.child.cheer;

// 리드 결정(11-18 U10): '되돌리기'할 수 있는 시간 = 이 토스트 표시 시간. 4초, 글자 200% 이상이면 6초.
// 전문가 리뷰 D-17a(7:90, WCAG 2.2.1): 화면 읽기가 켜졌으면 10초 + 초점을 '되돌리기'로(Toast focusAction)
export function cheerUndoMs(screenReader: boolean, fontScale: number): number {
  return screenReader ? 10000 : fontScale >= 2 ? 6000 : 4000;
}

// 응원 보내기(리뷰 M3 + UX U10): 문장을 누르면 확인 없이 "{호칭}께 보냈어요 · 취소" 토스트를 띄우고, 토스트가 떠 있는 동안
// 기다렸다가 실제로 보낸다(그동안 send_cheer 를 부르지 않아 취소한 응원은 하루 한도에 안 셈). '취소'를 누르면 보내지 않는다.
// 화면을 떠나거나 앱이 백그라운드로 가면 기다리던 응원은 그때 바로 보낸다(사용자가 고른 것을 잃지 않게).
// 리뷰 M2: 보내는 시점 = 토스트가 끝나는 시점(Toast onExpire) 하나로 묶는다. 끝나기 시작하면 '취소'는 비활성이라 보낸 뒤 취소할 틈이 없다.
// 리뷰 L1(수용): 대기 중 앱을 강제 종료하면 백그라운드 전환에서 보내기를 시작하지만, 응답 전에 프로세스가 죽으면 그 응원은 사라질 수 있다.
// 보낼 때는 연결된 어르신 한 분씩, 분마다 결과를 따로 받는다(한 분 실패가 다른 분 성공을 지우지 않음).
// "다시 하기"는 이번에 이미 받은 분을 건너뛴다(하루 한도를 중복으로 쓰지 않게). 기다리는 중·보내는 중에는 다시 누르기 무시.
export function useSendCheer(api: Api, onReload: () => void) {
  const {show, hide} = useToast();
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const pending = useRef<{fire: () => void; toastId: number} | null>(null);
  const screenReader = useScreenReader();
  const hideRef = useRef(hide);
  hideRef.current = hide;

  const deliver = useCallback(
    async (key: CheerKey, targets: ChildParent[], already: CheerResultRow[] = [], announced = false) => {
      busy.current = true;
      setSending(true);
      const rows: CheerResultRow[] = [...already];
      const skip = new Set(already.map(r => r.parentId));
      for (const p of targets.filter(x => !skip.has(x.parentId))) {
        try {
          const r = await api.sendCheer(p.parentId, key);
          rows.push({parentId: p.parentId, title: p.title, outcome: r.ok ? 'ok' : r.reason});
        } catch (e) {
          rows.push({parentId: p.parentId, title: p.title, outcome: isOffline(e) ? 'offline' : 'server'});
        }
      }
      busy.current = false;
      setSending(false);
      if (rows.length > already.length && rows.slice(already.length).some(r => r.outcome === 'ok')) {
        track(api, 'cheer_sent', {message_key: key}); // AC-05: 이번에 한 분이라도 받았을 때 한 번(받는 분·수는 싣지 않음)
      }

      const s = summarizeCheer(rows);
      // 다시 하기: 이번에 받은 분(ok)은 결과를 들고 가서 건너뛴다
      const again = {label: copy.errors.offline.button, onPress: () => deliver(key, targets, rows.filter(r => r.outcome === 'ok'))};
      if (s.kind === 'sent') {
        if (!announced) {
          show({text: withTitle(c.sent, s.titles.join('·'))}); // 취소 토스트로 이미 알렸으면 다시 띄우지 않는다
        }
      } else if (s.kind === 'partial') {
        show({text: withTitle(c.partial, s.titles.join('·')), action: s.retry ? again : undefined});
      } else if (s.kind === 'daily_limit') {
        show({text: c.daily_limit});
      } else {
        show({text: s.kind === 'offline' ? copy.errors.offline.title : copy.errors.server.title, kind: 'error', action: again});
      }
      if (s.reload) {
        onReload(); // 연결 상태가 바뀌었다 → 배너·버튼을 서버 기준으로
      }
    },
    [api, onReload, show],
  );

  const send = useCallback(
    (key: CheerKey, targets: ChildParent[]) => {
      if (busy.current || pending.current || targets.length === 0) {
        return;
      }
      let done = false;
      const fire = () => {
        if (done) {
          return;
        }
        done = true;
        pending.current = null;
        setSending(false);
        deliver(key, targets, [], true);
      };
      const ms = cheerUndoMs(screenReader, PixelRatio.getFontScale());
      setSending(true);
      const toastId = show({
        durationMs: ms,
        focusAction: screenReader, // D-17a: 화면 읽기 사용자는 토스트를 찾아갈 틈이 없다 → 초점을 '되돌리기'로
        onExpire: fire, // 시간 끝·다른 토스트로 바뀜·닫힘 → 보낸다
        text: withTitle(c.sent, targets.map(p => p.title).join('·')),
        action: {
          label: c.undo,
          onPress: () => {
            if (done) {
              return;
            }
            done = true;
            pending.current = null;
            setSending(false);
            show({text: c.undone});
          },
        },
      });
      pending.current = {fire, toastId};
    },
    [deliver, show, screenReader],
  );

  // 앱이 백그라운드로 가면 기다리던 응원을 바로 보낸다(리드 결정 11-18)
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      const p = pending.current;
      if (st !== 'active' && p) {
        p.fire();
        hide(p.toastId); // 보낸 뒤라 '취소' 토스트를 거둔다
      }
    });
    return () => sub.remove();
  }, [hide]);

  // 화면을 떠나면 기다리던 응원은 바로 보내고, 남은 '취소' 토스트를 거둔다(재검토 R1: 보낸 뒤 취소가 보이지 않게)
  useEffect(
    () => () => {
      const p = pending.current;
      if (p) {
        p.fire();
        hideRef.current(p.toastId);
      }
    },
    [], // 언마운트 때만(hide 가 바뀌어도 기다리던 응원을 일찍 보내지 않게)
  );

  return {send, sending};
}
