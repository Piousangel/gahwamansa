import React, {useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {copy} from '../copy/copy';
import {Banner, Dialog, Text} from '../ui/ds';
import {announce} from '../ui/a11y';
import {focusTopScreenTitle} from '../ui/screenTitle';
import {useBusyLatch} from '../ui/useBusyLatch';
import {acceptParentPrompt, declineParentPrompt, skipParentPromptToday} from './pushClient';
import {openNotifySettings, readNotifyPermission, requestNotifyPermission, type NotifyPermission} from './notifyNative';
import {pushDeps} from './runtime';

const t = copy.push.permission;

/**
 * N1 어르신 알림 묻기 — ds Dialog(시안 P6_P7_N1_P2_ds4b N1 보드). 사용자가 방금 끝낸 행동의 연속일 때만 PushHost 가 그린다:
 * ① 연결(P1c)·답 보여 주기(P2)를 마치고 코스 홈에 처음 왔을 때(H1, 오너 11-25) ② P7 '알겠어요'로 코스 홈에 돌아왔을 때(리드 결정 ⓐ, #168).
 * 앱을 열 때·깨어날 때는 묻지 않는다(맥락 없는 진입 즉시 권한 묻기 금지 — 11-20 결정의 취지).
 * 덮개 큐(useCover)는 쓰지 않는다: 사용자의 '알겠어요'에 이어지는 질문이라 다른 덮개와 하루 몫을 나누지 않는다.
 * - '알려 주세요' = 서버 받기 동의 + 시스템 창(아래 '휴대폰이 한 번 더 물어봐요' 미리 알림, 접근성 M3).
 *   창이 뜨지 않으면(blocked) 본문을 안내 한 줄(notice 톤 — 잘못이 아님)로 바꾸고 주 버튼은 '휴대폰 설정 열기'(디자인 #168).
 *   설정에서 켜고 돌아오면 권한을 다시 읽어 '알림이 켜졌어요'를 알리고 닫는다(접근성 M1).
 * - '안 받을게요' = 거절 기록(다시 묻지 않음, 켜기는 P13). blocked 에서는 이미 서버 동의가 남아 있고 다시 묻지 않으므로 닫는 말이 '닫기'(ds A5 close — later 는 '나중에 다시 묻는다', #168 접근성 재확인 L).
 * - 안드로이드 뒤로 = 오늘은 넘김(거절 아님, PR #72 M1) — 다음 날 P7 뒤에 다시 묻는다.
 * 닫히면 연 버튼이 없으므로 코스 홈 제목으로 초점(접근성 L2).
 */
export function N1Prompt({onClose}: {onClose: () => void}) {
  const {busy, begin, end} = useBusyLatch();
  const [blocked, setBlocked] = useState(false);
  const [visible, setVisible] = useState(true);
  const answered = useRef(false);
  // TODO(E5, 서버 레인): 보인 순간 push_prompt_shown {is_first} — N1 허용률 분모. 서버 이벤트 허용 목록(0034 계열)에 넣은 뒤 여기서 보낸다.
  //   '안 받을게요'는 push_permission_result denied 에 섞어 보내지 않는다(denied 는 시스템 창 결과만).
  const finish = () => {
    setVisible(false);
    focusTopScreenTitle();
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
  const back = () => {
    const d = pushDeps();
    if (!answered.current && d) {
      skipParentPromptToday(d);
    }
    finish();
  };
  // 설정을 열어도 대화상자는 남는다 — 다시 그려 Dialog 의 두 번 누름 막기를 풀어 준다(돌아와 다시 누를 수 있게)
  const [, setOpened] = useState(0);
  const openSettings = () => {
    openNotifySettings();
    setOpened(n => n + 1);
  };
  // 설정에서 돌아오면 권한을 다시 읽는다(접근성 M1): 켜졌으면 알리고 닫는다
  const closeRef = useRef(finish);
  closeRef.current = finish;
  useEffect(() => {
    if (!blocked) {
      return;
    }
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') {
        return;
      }
      readNotifyPermission()
        .then(p => {
          if (p === 'granted') {
            announce(t.turned_on);
            closeRef.current();
          }
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, [blocked]);

  return (
    <Dialog
      visible={visible}
      testID="n1"
      title={t.title}
      action={blocked ? {label: copy.push.system_off.open_parent, onPress: openSettings} : {label: t.yes, onPress: yes, loading: busy, loadingLabel: t.yes}}
      actionHint={blocked ? undefined : t.system_hint}
      dismiss={blocked ? 'close' : {decline: t.no}}
      onDismiss={no}
      onBack={back}
      returnFocusRef={null}>
      {blocked ? (
        // 막힘(접근성 M2·디자인): 본문을 안내 한 줄로 바꿔 끼운다(스크롤 안, 읽기 polite — Banner 가 알린다)
        <Banner tone="notice" text={copy.push.system_off.body} testID="n1-system-off" />
      ) : (
        <>
          <Text role="bodyLg">{t.body}</Text>
          <Text role="bodyLg" tone="muted">
            {t.optional}
          </Text>
        </>
      )}
    </Dialog>
  );
}
