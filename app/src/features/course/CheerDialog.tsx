import React, {useEffect, useRef, useState, type RefObject} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {Dialog} from '../../ui/Dialog';
import {audio} from '../../audio';
import {ReadAloud, ttsText} from './ReadAloud';
import {copy} from '../../copy/copy';
import {isCheerKey, type MyCheers} from '../../api/contract/cheers';
import type {Api} from '../types';

// P8 응원 도착(시안 P8_cheer): 코스 홈을 열면 안 읽은 응원(get_my_cheers)을 대화상자(U0 Dialog)로 한 번 보여 준다.
// - 아는 키(api/contract/cheers.ts)는 그 문장, 모르는 키(빈 키 포함)는 기본 줄 하나로 보여 준다.
//   서버가 이 앱보다 먼저 새 키를 열어도 한마디를 놓치지 않게(DECISIONS 11-24 키 확대 배포 순서 ①). 모르는 키의 원래 문장은 보이지 않는다.
//   모르는 키만: copy.cheer.unknown(제목과 겹치지 않는 말, 개수는 제목이 말함). 아는 키와 섞임: copy.cheer.unknown_more('그 밖에 {n}개 더').
//   제목 개수는 받은 한마디 전체.
// - 바깥을 눌러도 닫히지 않고 "알겠어요"(·안드로이드 뒤로)로만 닫힌다 = 읽음 처리.
// - 닫히면 포커스를 코스 홈 제목으로 돌려준다(R12, returnFocusRef). 그러려면 닫힌 뒤에도 Dialog 를 visible=false 로 남겨 둔다.
// - 받아 오지 못하면 조용히 아무것도 하지 않는다(장식이라 코스를 막지 않음).
// - 해님은 그리지 않는다(U0 Dialog 표준, 해님 말은 첫 만남·완료·오류만 — 리뷰 10).
// TODO(읽어주기): 오디오 스파이크 결론 뒤 응원 문장 아래 '읽어 주세요'(화면 읽기 켜짐이면 숨김 R16).
export function CheerDialog({api, enabled, returnFocusRef}: {api: Api; enabled: boolean; returnFocusRef?: RefObject<unknown>}) {
  const focused = useIsFocused();
  const [batch, setBatch] = useState<MyCheers['cheers']>([]);
  const [open, setOpen] = useState(false);
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
        setBatch(r.cheers);
        setOpen(r.cheers.length > 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [api, enabled]);

  const known = batch.flatMap(c => (isCheerKey(c.message_key) ? [copy.cheers[c.message_key]] : []));
  const unknown = batch.length - known.length;
  const extra = unknown === 0 ? [] : known.length === 0 ? [copy.cheer.unknown] : [copy.cheer.unknown_more.split('{n}').join(String(unknown))];
  const lines = [...known, ...extra];
  const close = () => {
    setOpen(false);
    if (audio().isSpeaking()) {
      audio().stopSpeaking(); // 대화상자를 닫으면 읽기도 멈춘다
    }
    // 본 뒤에만 읽음 처리: 확인한 묶음 전체(모르는 키 포함). 그 사이 새로 온 응원은 다음에 보인다. 실패하면 다음에 다시 보인다
    api.markCheersRead(batch.map(c => c.id)).catch(() => {});
  };
  if (batch.length === 0) {
    return null;
  }
  const title = batch.length === 1 ? copy.cheer.title : copy.cheer.title_many.split('{n}').join(String(batch.length));
  return (
    <Dialog
      visible={open && focused}
      title={title}
      body={lines.join('\n')}
      actions={[{label: copy.cheer.button, onPress: close}]}
      returnFocusRef={returnFocusRef}
      testID="cheer-dialog">
      {/* AP-03 읽어 주기: 응원 문장 바로 아래 */}
      <ReadAloud text={ttsText.cheer(lines)} />
    </Dialog>
  );
}
