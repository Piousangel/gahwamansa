import React, {useEffect, useRef, useState} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {Dialog} from '../../ui/Dialog';
import {copy} from '../../copy/copy';
import {isCheerKey, type MyCheers} from '../../api/contract/cheers';
import type {Api} from '../types';

// P8 응원 도착(시안 P8_cheer): 코스 홈을 열면 안 읽은 응원(get_my_cheers)을 대화상자(U0 Dialog)로 한 번 보여 준다.
// - 서버 확정 키(api/contract/cheers.ts) 4개만 보여 준다. 모르는 키만 온 묶음은 조용히 읽음 처리.
// - 바깥을 눌러도 닫히지 않고 "알겠어요"(·안드로이드 뒤로)로만 닫힌다 = 읽음 처리.
// - 받아 오지 못하면 조용히 아무것도 하지 않는다(장식이라 코스를 막지 않음).
// - 해님은 그리지 않는다(U0 Dialog 표준, 해님 말은 첫 만남·완료·오류만 — 리뷰 10).
// TODO(읽어주기): 오디오 스파이크 결론 뒤 응원 문장 아래 '읽어 주세요'(화면 읽기 켜짐이면 숨김 R16).
export function CheerDialog({api, enabled}: {api: Api; enabled: boolean}) {
  const focused = useIsFocused();
  const [batch, setBatch] = useState<MyCheers['cheers']>([]);
  const asked = useRef(false);
  useEffect(() => {
    if (!enabled || asked.current) {
      return;
    }
    asked.current = true; // 앱을 연 뒤 한 번만 묻는다
    let alive = true;
    api
      .getMyCheers()
      .then(r => {
        if (!alive) {
          return;
        }
        if (r.cheers.length > 0 && !r.cheers.some(c => isCheerKey(c.message_key))) {
          // 보여 줄 수 없는 키만 왔으면 조용히 읽음 처리(매번 다시 받지 않게)
          api.markCheersRead(r.cheers.map(c => c.id)).catch(() => {});
          return;
        }
        setBatch(r.cheers);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [api, enabled]);

  const lines = batch.flatMap(c => (isCheerKey(c.message_key) ? [copy.cheers[c.message_key]] : []));
  const close = () => {
    const ids = batch.map(c => c.id); // 확인한 묶음 전체(모르는 키 포함). 그 사이 새로 온 응원은 다음에 보인다
    setBatch([]);
    api.markCheersRead(ids).catch(() => {}); // 실패하면 다음에 다시 보인다
  };
  if (lines.length === 0) {
    return null;
  }
  const title = lines.length === 1 ? copy.cheer.title : copy.cheer.title_many.split('{n}').join(String(lines.length));
  return (
    <Dialog
      visible={focused}
      title={title}
      body={lines.join('\n')}
      actions={[{label: copy.cheer.button, onPress: close}]}
      testID="cheer-dialog"
    />
  );
}
