import React, {useCallback, useEffect, useState} from 'react';
import {AppState, Pressable, StyleSheet, Switch, View} from 'react-native';
import {Text20} from '../../ui/Text20';
import {SmallButton} from '../../ui/SmallButton';
import {color, radius, size} from '../../ui/tokens';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {channelEnabled, openNotifySettings, readNotifyPermission} from '../../push/notifyNative';
import type {AndroidPushChannel} from '../../api/contract/push';
import {pushReceive, setPushReceive} from '../../push/runtime';
import {copy} from '../../copy/copy';

const p = copy.push;

// P13 '알림과 소리'의 알림 행(시안 P13_more v2, AU-04 뒤 법률 규칙 ③: 앱 안에서 알림을 끌 수 있어야 함 — Firebase 연결 전 선행).
// 빌드 1 결정(리드 11-18): '알림' 한 행, 켬/끔 = 서버 set_push_enabled(받기 시각 기록·삭제, 0036). 종류별 서버 값은 빌드 2.
// - 휴대폰에서 앱 알림 전체가 꺼짐(권한 거절·차단): 행 대신 '알림 / 휴대폰 설정에서 꺼져 있어요 / [휴대폰 설정 열기]'.
// - 휴대폰에서 채널(오늘의 사진·응원) 하나가 꺼짐: 행 아래에 그 종류 안내 + [휴대폰 설정 열기](그 채널 화면).
// - 연결 전(프로필 없음, enabled null)에는 그리지 않는다. 휴대폰 설정에서 돌아오면(앱 활성) 다시 읽는다.
type Kind = 'daily' | 'cheer';
type State = {enabled: boolean | null; system: 'on' | 'off'; channels: Record<Kind, boolean>} | null;
const KINDS: {ch: Kind; title: string}[] = [
  {ch: 'daily', title: p.channel.daily},
  {ch: 'cheer', title: p.channel.cheer},
];

export function NotifyRows() {
  const [s, setS] = useState<State>(null);
  const {busy, begin, end} = useBusyLatch();
  const [failed, setFailed] = useState<string | null>(null); // 켬·끔 실패 한 줄(리뷰 낮음, 어르신은 토스트 대신 행 아래 글)
  const load = useCallback(async () => {
    try {
      // 서버 받기 상태는 push/runtime 의 pushReceive(AU-04 리뷰 M1 API): true·false·null(연결 전)·'offline'
      const [receive, perm, daily, cheer] = await Promise.all([
        pushReceive(),
        readNotifyPermission(),
        channelEnabled('daily'),
        channelEnabled('cheer'),
      ]);
      if (receive === 'offline') {
        return; // 읽기 실패: 지난 값 유지(처음이면 그리지 않음)
      }
      setS({
        enabled: receive,
        system: perm === 'denied' || perm === 'blocked' ? 'off' : 'on',
        channels: {daily: daily !== false, cheer: cheer !== false},
      });
    } catch {
      setS(prev => prev); // 읽기 실패: 지난 값 유지(처음이면 그리지 않음)
    }
  }, []);
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
  if (s.system === 'off') {
    return <SystemOffRow testID="notify-row-system" title={p.settings_row} onOpen={() => openNotifySettings()} />;
  }
  const toggle = async () => {
    if (!begin()) {
      return;
    }
    const next = !s.enabled;
    setS({...s, enabled: next}); // 바로 보이게, 실패하면 되돌림
    setFailed(null);
    try {
      // setPushReceive: set_push_enabled + 이 계정 N1 기억('off'면 다시 묻지 않음) + 켜면 권한이 있을 때 토큰 등록(AU-04 M1)
      const r = await setPushReceive(next);
      setS(prev => (prev ? {...prev, enabled: r.ok ? r.enabled : !next} : prev));
      if (!r.ok) {
        setFailed(r.reason === 'offline' ? copy.errors.offline.title : copy.errors.server.title);
      }
    } finally {
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
