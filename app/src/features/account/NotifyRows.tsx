import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Pressable, StyleSheet, Switch, View} from 'react-native';
import {Text20} from '../../ui/Text20';
import {SmallButton} from '../../ui/SmallButton';
import {color, radius, size} from '../../ui/tokens';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {channelEnabled, openNotifySettings, readNotifyPermission} from '../../push/notifyNative';
import type {AndroidPushChannel} from '../../api/contract/push';
import {parentAskPermissionAgain, parentEnableFromSettings, pushReceive, setPushReceive} from '../../push/runtime';
import {copy} from '../../copy/copy';

const p = copy.push;

// P13 '알림과 소리'의 알림 행(시안 P13_more v2, AU-04 뒤 법률 규칙 ③: 앱 안에서 알림을 끌 수 있어야 함 — Firebase 연결 전 선행).
// 빌드 1 결정(리드 11-18): '알림' 한 행, 켬/끔 = 서버 set_push_enabled(받기 시각 기록·삭제, 0036). 종류별 서버 값은 빌드 2.
// - 권한은 둘로 나눈다(l2-appinfo 리뷰 M1): 'denied'(13+ 묻기 전·한 번 거절 — 앱이 다시 물을 수 있음)면 스위치를 그대로 보이고,
//   켤 때 N1 과 같은 순서(set_push_enabled(true) → 권한 창 → 허용이면 토큰 등록). 'blocked'(다시 묻지 않음·앱 알림 꺼짐)만
//   행 대신 '알림 / 휴대폰 설정에서 꺼져 있어요 / [휴대폰 설정 열기]'. 켰는데 권한 창 결과가 blocked 면 그때 휴대폰 설정을 연다.
// - 켜 둔 상태(서버 true)인데 권한이 denied: 행 아래 '알림이 휴대폰 설정에서 꺼져 있어요' + [알려 주세요](권한 창).
// - 휴대폰에서 채널(오늘의 사진·응원) 하나가 꺼짐: 행 아래에 그 종류 안내 + [휴대폰 설정 열기](그 채널 화면).
// - 연결 전(프로필 없음, enabled null)에는 그리지 않는다. 휴대폰 설정에서 돌아오면(앱 활성) 다시 읽는다.
type Kind = 'daily' | 'cheer';
type State = {enabled: boolean | null; perm: 'ok' | 'denied' | 'blocked'; channels: Record<Kind, boolean>} | null;
const KINDS: {ch: Kind; title: string}[] = [
  {ch: 'daily', title: p.channel.daily},
  {ch: 'cheer', title: p.channel.cheer},
];

export function NotifyRows() {
  const [s, setS] = useState<State>(null);
  const {busy, isBusy, begin, end} = useBusyLatch();
  // 앱 복귀(active) 때 다시 읽는 값이 진행 중인 토글을 덮지 않게(리뷰 L6): 읽기 시작 뒤 토글이 시작·끝났으면 그 결과를 버린다
  const toggles = useRef(0);
  const [failed, setFailed] = useState<string | null>(null); // 켬·끔 실패 한 줄(리뷰 낮음, 어르신은 토스트 대신 행 아래 글)
  const load = useCallback(async () => {
    const at = toggles.current;
    try {
      // 서버 받기 상태는 push/runtime 의 pushReceive(AU-04 리뷰 M1 API): true·false·null(연결 전)·'offline'
      const [receive, perm, daily, cheer] = await Promise.all([
        pushReceive(),
        readNotifyPermission(),
        channelEnabled('daily'),
        channelEnabled('cheer'),
      ]);
      if (receive === 'offline' || isBusy() || at !== toggles.current) {
        return; // 읽기 실패·토글 중·읽는 사이 토글함: 지난 값 유지(처음이면 그리지 않음)
      }
      setS({
        enabled: receive,
        perm: perm === 'blocked' ? 'blocked' : perm === 'denied' ? 'denied' : 'ok',
        channels: {daily: daily !== false, cheer: cheer !== false},
      });
      // 다시 읽기에 성공하면 지난 실패 줄(켬·끔 실패·ask_failed)은 지운다 — 앱 복귀 뒤 이미 켜져 있는데 줄이 남지 않게(PR #9 리뷰 낮음)
      setFailed(null);
    } catch {
      setS(prev => prev); // 읽기 실패: 지난 값 유지(처음이면 그리지 않음)
    }
  }, [isBusy]);
  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        load();
      }
    });
    return () => sub?.remove();
  }, [load]);

  if (!s || s.enabled === null) {
    return null;
  }
  if (s.perm === 'blocked') {
    return <SystemOffRow testID="notify-row-system" title={p.settings_row} onOpen={() => openNotifySettings()} />;
  }
  const toggle = async () => {
    if (!begin()) {
      return;
    }
    toggles.current += 1;
    const next = !s.enabled;
    setS({...s, enabled: next}); // 바로 보이게, 실패하면 되돌림
    setFailed(null);
    try {
      // 켜기: set_push_enabled(true) → 권한 창 → 허용이면 토큰 등록(N1 과 같은 순서, 리뷰 M1). 끄기: N1 기억 'off'(다시 묻지 않음)
      let r;
      if (next) {
        const on = await parentEnableFromSettings();
        r = on.result;
        if (on.permission === 'blocked') {
          openNotifySettings(); // 다시 묻지 못하는 상태: 휴대폰 설정에서만 켤 수 있다
        }
        if (on.permission) {
          const perm = on.permission;
          setS(prev => (prev ? {...prev, perm: perm === 'blocked' ? 'blocked' : perm === 'denied' ? 'denied' : 'ok'} : prev));
        }
      } else {
        r = await setPushReceive(false);
      }
      const done = r;
      setS(prev => (prev ? {...prev, enabled: done.ok ? done.enabled : !next} : prev));
      if (!done.ok) {
        setFailed(done.reason === 'offline' ? copy.errors.offline.title : copy.errors.server.title);
      }
    } catch {
      // 지금은 runtime 이 예외를 값으로 바꾸지만, 던져도 낙관적 값이 남지 않게(리뷰 L5)
      setS(prev => (prev ? {...prev, enabled: !next} : prev));
      setFailed(copy.errors.server.title);
    } finally {
      toggles.current += 1; // 끝날 때도 올린다: 토글 중에 시작한 다시 읽기(옛 값)는 버린다(재확인 N3-② 경쟁)
      end();
    }
  };
  // 켜 둔 상태인데 권한이 denied(다시 물을 수 있음): 권한 창만 다시 띄운다(blocked 가 되면 위 SystemOffRow 로 바뀐다)
  const askAgain = async () => {
    if (!begin()) {
      return;
    }
    toggles.current += 1;
    setFailed(null);
    try {
      // 권한 창 → 결과 기록(push_permission_result) → 허용이면 서버 받기·토큰 등록. 허용 뒤 서버가 실패하면 한 줄(재확인 N2)
      const {permission: perm, result} = await parentAskPermissionAgain();
      setS(prev => (prev ? {...prev, perm: perm === 'blocked' ? 'blocked' : perm === 'denied' ? 'denied' : 'ok'} : prev));
      if (result && !result.ok) {
        setFailed(p.system_off.ask_failed);
      } else if (result?.ok) {
        const on = result.enabled;
        setS(prev => (prev ? {...prev, enabled: on} : prev));
      }
    } catch {
      setFailed(p.system_off.ask_failed);
    } finally {
      toggles.current += 1; // 끝날 때도 올린다: 토글 중에 시작한 다시 읽기(옛 값)는 버린다(재확인 N3-② 경쟁)
      end();
    }
  };
  const offKinds = KINDS.filter(k => !s.channels[k.ch]);
  return (
    <View testID="notify-row" style={styles.section}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={p.settings_row}
        accessibilityHint={p.settings_sub}
        accessibilityState={{checked: !!s.enabled, disabled: busy}}
        onPress={toggle}
        style={({pressed}) => [styles.row, pressed ? styles.pressed : null]}>
        <View style={styles.text}>
          <Text20 size={24} weight="bold">{p.settings_row}</Text20>
          <Text20 style={styles.sub}>{p.settings_sub}</Text20>
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Switch value={!!s.enabled} onValueChange={toggle} trackColor={{false: color.lineSoft, true: color.done}} thumbColor={color.card} />
        </View>
      </Pressable>
      {failed ? (
        <Text20 testID="notify-failed" accessibilityLiveRegion="polite" weight="bold" style={styles.failed}>
          {failed}
        </Text20>
      ) : null}
      {s.enabled && s.perm === 'denied' ? (
        <View testID="notify-perm-denied" style={styles.off}>
          {/* 버튼은 앱 안 권한 창이라 '휴대폰 설정에서 꺼져 있어요'가 아니라 허락을 부탁하는 줄(재확인 N1, 새 키 denied_row) */}
          <Text20 accessibilityLiveRegion="polite" style={styles.sub}>{p.system_off.denied_row}</Text20>
          <SmallButton label={p.permission.yes} onPress={askAgain} />
        </View>
      ) : null}
      {/* 켜 둔 상태에서 휴대폰 채널이 꺼진 종류만 행 아래에 안내(꺼 둔 상태면 어차피 오지 않으므로 생략) */}
      {s.enabled && offKinds.length > 0 ? (
        // 새 키 push.system_off.channel_row(main 11-18): '{채널} 알림은 휴대폰 설정에서 꺼져 있어요', 여럿이면 ', '로 잇는다.
        // 버튼은 한 종류면 그 채널 화면, 둘 이상이면 앱 알림 화면
        <View testID="notify-off" style={styles.off}>
          <Text20 accessibilityLiveRegion="polite" style={styles.sub}>
            {p.system_off.channel_row.split('{채널}').join(offKinds.map(k => k.title).join(', '))}
          </Text20>
          <SmallButton
            label={p.system_off.open_parent}
            onPress={() => (offKinds.length === 1 ? openNotifySettings(offKinds[0].ch as AndroidPushChannel) : openNotifySettings())}
          />
        </View>
      ) : null}
    </View>
  );
}

function SystemOffRow({title, onOpen, testID}: {title: string; onOpen: () => void; testID: string}) {
  return (
    <View testID={testID} style={styles.section}>
      <View accessible accessibilityLabel={`${title}, ${p.system_off.row}`} style={styles.text}>
        <Text20 size={24} weight="bold">{title}</Text20>
        <Text20 style={styles.sub}>{p.system_off.row}</Text20>
      </View>
      <SmallButton label={p.system_off.open_parent} onPress={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 16, gap: 12},
  row: {flexDirection: 'row', alignItems: 'center', minHeight: size.touchMin},
  pressed: {backgroundColor: color.actionSoft},
  off: {gap: 8},
  failed: {color: color.dangerInk},
  text: {flex: 1, gap: 4},
  sub: {color: color.inkSub},
});
