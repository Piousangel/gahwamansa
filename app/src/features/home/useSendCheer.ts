import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, PixelRatio} from 'react-native';
import {copy, withTitle} from '../../copy/copy';
import {useToast} from '../../ui/Toast';
import {useScreenReader} from '../../ui/a11y';
import {CheerKey, ChildParent, isOffline} from '../types';
import type {Api} from '../types';
import {CheerResultRow, summarizeCheer} from './cheerLogic';

const c = copy.child.cheer;

// 리드 결정(11-18 U10): '취소'할 수 있는 시간 = 이 토스트 표시 시간. 4초, 화면 읽기가 켜졌거나 글자 200% 이상이면 6초
export function cheerUndoMs(screenReader: boolean, fontScale: number): number {
  return screenReader || fontScale >= 2 ? 6000 : 4000;
}

// 응원 보내기(리뷰 M3 + UX U10): 문장을 누르면 확인 없이 "{호칭}께 보냈어요 · 취소" 토스트를 띄우고, 토스트가 떠 있는 동안
// 기다렸다가 실제로 보낸다(그동안 send_cheer 를 부르지 않아 취소한 응원은 하루 한도에 안 셈). '취소'를 누르면 보내지 않는다.
// 화면을 떠나거나 앱이 백그라운드로 가면 기다리던 응원은 그때 바로 보낸다(사용자가 고른 것을 잃지 않게).
// 보낼 때는 연결된 어르신 한 분씩, 분마다 결과를 따로 받는다(한 분 실패가 다른 분 성공을 지우지 않음).
// "다시 하기"는 이번에 이미 받은 분을 건너뛴다(하루 한도를 중복으로 쓰지 않게). 기다리는 중·보내는 중에는 다시 누르기 무시.
export function useSendCheer(api: Api, onReload: () => void) {
  const {show} = useToast();
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const pending = useRef<{timer: ReturnType<typeof setTimeout>; fire: () => void} | null>(null);
  const screenReader = useScreenReader();

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
      const fire = () => {
        if (pending.current) {
          clearTimeout(pending.current.timer);
        }
        pending.current = null;
        setSending(false);
        deliver(key, targets, [], true);
      };
      const ms = cheerUndoMs(screenReader, PixelRatio.getFontScale());
      pending.current = {timer: setTimeout(fire, ms), fire};
      setSending(true);
      show({
        durationMs: ms,
        text: withTitle(c.sent, targets.map(p => p.title).join('·')),
        action: {
          label: c.undo,
          onPress: () => {
            if (pending.current) {
              clearTimeout(pending.current.timer);
              pending.current = null;
              setSending(false);
              show({text: c.undone});
            }
          },
        },
      });
    },
    [deliver, show, screenReader],
  );

  // 앱이 백그라운드로 가면 기다리던 응원을 바로 보낸다(리드 결정 11-18)
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st !== 'active') {
        pending.current?.fire();
      }
    });
    return () => sub.remove();
  }, []);

  // 화면을 떠나면 기다리던 응원은 바로 보낸다
  useEffect(
    () => () => {
      pending.current?.fire();
    },
    [],
  );

  return {send, sending};
}
