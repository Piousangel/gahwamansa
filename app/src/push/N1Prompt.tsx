import React, {useEffect, useRef, useState} from 'react';
import {copy} from '../copy/copy';
import {Dialog, Text, useCover} from '../ui/ds';
import {useBusyLatch} from '../ui/useBusyLatch';
import {acceptParentPrompt, declineParentPrompt, skipParentPromptToday} from './pushClient';
import {openNotifySettings, requestNotifyPermission, type NotifyPermission} from './notifyNative';
import {pushDeps} from './runtime';

const t = copy.push.permission;
/** 덮개 큐 id(하루 하나, A8) */
export const N1_COVER = 'push-n1';

/**
 * N1 어르신 알림 묻기 — ds Dialog 덮개(시안 P6_P7_N1_P2_ds4b N1 보드, A8 ③: P7 '알겠어요' → N1 → P3).
 * PushHost 가 코스 홈에서 '물어야 함'을 확인하면 그린다. 덮개 큐가 거절하면(오늘 다른 덮개가 이미 떴음) 보이지 않고 다음 깨어남에 다시 청한다.
 * 세 출구는 모두 코스 홈에 남는다(P7 은 popTo 로 이미 스택에 없다):
 * - '알려 주세요' = 서버 받기 동의 + 시스템 창. 창이 뜨지 않으면(blocked) 닫지 않고 '휴대폰 설정 열기'(리뷰 L1)
 * - '안 받을게요' = 거절 기록(다시 묻지 않음, 켜기는 P13)
 * - 안드로이드 뒤로 = 오늘은 넘김(거절 아님, PR #72 M1) — 같은 날 다시 묻지 않고 다음 날 다시 묻는다
 */
export function N1Prompt({onClose, onVisible}: {onClose: () => void; /** 실제로 떴는지(PushHost 가 알림 탭을 미룰지 정한다, 리뷰 L6) */ onVisible?: (v: boolean) => void}) {
  const {visible, close} = useCover(N1_COVER, true);
  useEffect(() => {
    onVisible?.(visible);
  }, [visible, onVisible]);
  const {busy, begin, end} = useBusyLatch();
  const [blocked, setBlocked] = useState(false);
  const answered = useRef(false);
  const finish = () => {
    close();
    onClose();
  };
  const yes = async () => {
    const d = pushDeps();
    if (!begin()) {
      return;
    }
    answered.current = true;
    let p: NotifyPermission = 'granted';
    try {
      if (d) {
        p = await acceptParentPrompt(d, requestNotifyPermission);
      }
    } finally {
      end();
    }
    if (p === 'blocked' || p === 'unknown') {
      setBlocked(true);
      return;
    }
    finish();
  };
  const no = async () => {
    if (blocked) {
      finish(); // 이미 답함('알려 주세요'), 설정은 나중에
      return;
    }
    const d = pushDeps();
    if (!begin()) {
      return;
    }
    answered.current = true;
    try {
      if (d) {
        await declineParentPrompt(d);
      }
    } finally {
      end();
      finish();
    }
  };
  // 설정을 열어도 대화상자는 남는다 — 다시 그려 Dialog 의 두 번 누름 막기를 풀어 준다(돌아와 '안 받을게요'를 누를 수 있게)
  const [, setOpened] = useState(0);
  const openSettings = () => {
    openNotifySettings();
    setOpened(n => n + 1);
  };
  const back = () => {
    const d = pushDeps();
    if (!answered.current && d) {
      skipParentPromptToday(d);
    }
    finish();
  };

  return (
    <Dialog
      visible={visible}
      testID="n1"
      title={t.title}
      action={blocked ? {label: copy.push.system_off.open_parent, onPress: openSettings} : {label: t.yes, onPress: yes, loading: busy, loadingLabel: t.yes}}
      dismiss={{decline: t.no}}
      onDismiss={no}
      onBack={back}
      returnFocusRef={null}
      // 창이 뜨지 않음(blocked): 대화상자 안 알림 줄(읽기 알림 polite) — 모달 위 토스트는 보이지 않는다
      error={blocked ? copy.push.system_off.body : null}>
      <Text role="bodyLg">{t.body}</Text>
      <Text role="bodyLg" tone="muted">
        {t.optional}
      </Text>
    </Dialog>
  );
}
