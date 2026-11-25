import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Platform} from 'react-native';
import {copy, withTitle} from '../../copy/copy';
import {announce} from '../../ui/a11y';
import {Dialog, Text} from '../../ui/ds';
import {focusTopScreenTitle} from '../../ui/screenTitle';
import {childPromptState, declineChildPrompt, skipChildPromptToday} from '../../push/pushClient';
import {pushDeps} from '../../push/runtime';
import type {NotifyState} from './useNotifyPermission';

const p = copy.child.notify_prompt;

/** 묻는 자리: wait = 번호를 보낸 직후(공유 창에서 돌아옴 · 복사하고 앱을 떠났다 돌아옴), done = 연결 직후 화면 */
export type ChildAskMoment = 'wait' | 'done';

/**
 * 자녀 시작 단계 '우리 말 한 장 → 시스템 창'(알림 권한 앞당김, 기획 v2.1 0.4 · 성장 리뷰 2.3). 어르신 N1 의 자녀판.
 * - 띄우는 때: 사용자가 방금 끝낸 행동의 연속일 때만 — 번호를 보낸 직후(부모님 연결 알림이 그 뒤에 오므로) 또는 연결 직후 화면
 *   (첫 답 알림은 연결 뒤 한 번뿐, 0052). 화면에 들어오자마자·앱을 열 때는 묻지 않는다. 한 화면에서 한 번.
 * - 묻지 않는 경우: Android 가 아님(자녀 iOS 는 1.1 — APNs 전), 이미 답함·오늘 넘김·받는 중·프로필 없음(childPromptState, 어르신 N1 과 같은 키),
 *   확인 못 함(오프라인 — 이번 자리는 넘기고 다음 자리에서 다시).
 * - [알림 켜기] = C3 줄과 같은 동작(useNotifyPermission.open): 13+ 묻기 전이면 시스템 창, 이미 허용(12 이하 기본 허용)이면 창 없이,
 *   다시 묻지 않음이면 휴대폰 설정 → 서버 받기 동의 → 허용이면 토큰. 받기 동의 전에는 getToken 0회(대기열 38) — 이 한 장은 토큰을 건드리지 않는다.
 * - [안 받을게요] = 다시 묻지 않음(켜는 길은 C3 줄·C7 토글), 안드로이드 뒤로 = 오늘은 넘김.
 */
export function useChildNotifyAsk(
  notify: {state: NotifyState; open: () => void},
  title: string,
  /** 지금 이 화면이 보이는지(판정이 끝난 때 다시 본다). 없으면 늘 보이는 것으로 */
  visibleNow?: {readonly current: boolean},
) {
  const [moment, setMoment] = useState<ChildAskMoment | null>(null);
  const asked = useRef(false);
  // 띄울(띄운) 자리. 판정을 기다리는 사이에 연결돼도 연결 직후 제목으로 뜨게 ref 로 둔다
  const want = useRef<ChildAskMoment | null>(null);

  const offer = useCallback((m: ChildAskMoment) => {
    const d = pushDeps();
    if (Platform.OS !== 'android' || !d) {
      return;
    }
    if (asked.current) {
      // #293 QA-2 L3: 'wait' 한 장이 열린(또는 뜨려는) 채 연결되면 새로 묻지 않고 제목만 연결 직후 것으로 바꾼다.
      //   닫았다가 다시 띄우면 한 화면에서 두 번 묻는 셈이고, 몸말('연결될 때와 첫 답이 보일 때만')은 두 자리가 같다
      if (m === 'done' && want.current === 'wait') {
        want.current = 'done';
        setMoment(cur => (cur === 'wait' ? 'done' : cur));
      }
      return;
    }
    asked.current = true;
    want.current = m;
    childPromptState(d)
      .then(s => {
        if (s === 'ask') {
          // #296 QA-3 L2: 판정을 읽는 사이 다른 화면(설정 등)으로 갔으면 그 위에 띄우지 않는다. 이번 자리는 넘기고(asked 되돌림)
          //   이 화면에 다시 들어와 묻는 자리(포커스 effect·복귀)에서 다시 판정한다
          if (visibleNow && !visibleNow.current) {
            asked.current = false;
            want.current = null;
            return;
          }
          setMoment(want.current);
        } else if (s === 'retry') {
          asked.current = false; // 확인 못 함: 다음 자리(연결 직후 등)에서 다시
        }
      })
      .catch(() => {
        asked.current = false;
      });
  }, [visibleNow]);

  // 열린 채 제목이 바뀌면(L3) 화면 읽기 사용자는 초점이 그대로라 모른다 → 바뀐 제목을 한 번 읽어 준다(처음 열릴 때는 제목 초점이 읽음)
  const shown = useRef<ChildAskMoment | null>(null);
  const doneTitle = withTitle(p.title_done, title);
  useEffect(() => {
    if (shown.current === 'wait' && moment === 'done') {
      announce(doneTitle);
    }
    shown.current = moment;
  }, [moment, doneTitle]);

  const close = () => {
    setMoment(null);
    focusTopScreenTitle();
  };
  const yes = () => {
    close();
    notify.open();
  };
  const no = () => {
    const d = pushDeps();
    close();
    if (d) {
      declineChildPrompt(d).catch(() => {});
    }
  };
  const back = () => {
    const d = pushDeps();
    close();
    if (d) {
      skipChildPromptToday(d).catch(() => {});
    }
  };

  // 13+ 이고 아직 허용 전이면 누른 뒤 휴대폰이 한 번 더 묻는다(12 이하·이미 허용이면 창이 없으므로 미리 알림도 없음)
  const systemAsks = Number(Platform.Version) >= 33 && notify.state !== 'granted';
  const node = moment ? (
    <Dialog
      visible
      testID="child-notify"
      title={withTitle(moment === 'wait' ? p.title_wait : p.title_done, title)}
      action={{label: copy.child.wait.notify_button, onPress: yes}}
      actionHint={systemAsks ? copy.push.permission.system_hint : undefined}
      dismiss={{decline: copy.push.permission.no}}
      onDismiss={no}
      onBack={back}
      returnFocusRef={null}>
      <Text role="body">{p.body}</Text>
      <Text role="body" tone="muted">
        {p.optional}
      </Text>
    </Dialog>
  ) : null;
  return {offer, node};
}
