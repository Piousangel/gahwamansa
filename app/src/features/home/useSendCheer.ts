import {useCallback, useRef, useState} from 'react';
import {copy, withTitle} from '../../copy/copy';
import {useToast} from '../../ui/Toast';
import {CheerKey, ChildParent, isOffline} from '../types';
import type {Api} from '../types';
import {CheerResultRow, summarizeCheer} from './cheerLogic';

const c = copy.child.cheer;

// 응원 보내기(리뷰 M3): 연결된 어르신 한 분씩 보내고 분마다 결과를 따로 받는다(한 분 실패가 다른 분 성공을 지우지 않음).
// "다시 하기"는 이번에 이미 받은 분을 건너뛴다(하루 한도를 중복으로 쓰지 않게). 보내는 중에는 다시 누르기 무시.
export function useSendCheer(api: Api, onReload: () => void) {
  const {show} = useToast();
  const [sending, setSending] = useState(false);
  const busy = useRef(false);

  const send = useCallback(
    async (key: CheerKey, targets: ChildParent[], already: CheerResultRow[] = []) => {
      if (busy.current) {
        return;
      }
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
      const again = {label: copy.errors.offline.button, onPress: () => send(key, targets, rows.filter(r => r.outcome === 'ok'))};
      if (s.kind === 'sent') {
        show({text: withTitle(c.sent, s.titles.join('·'))});
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

  return {send, sending};
}
