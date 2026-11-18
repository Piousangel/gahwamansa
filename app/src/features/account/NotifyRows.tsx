import React, {useCallback, useEffect, useState} from 'react';
import {AppState, Pressable, StyleSheet, Switch, View} from 'react-native';
import {Text20} from '../../ui/Text20';
import {SmallButton} from '../../ui/SmallButton';
import {color, radius, size} from '../../ui/tokens';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {channelEnabled, openNotifySettings, readNotifyPermission} from '../../push/notifyNative';
import type {AndroidPushChannel} from '../../api/contract/push';
import type {Api} from '../types';
import {copy} from '../../copy/copy';

const p = copy.push;

// P13 '알림과 소리'의 알림 행(시안 P13_more v2, AU-04 뒤 법률 규칙 ③: 앱 안에서 알림을 끌 수 있어야 함 — Firebase 연결 전 선행).
// - 행: '오늘의 사진'(daily)·'응원'(cheer). 켬/끔 = 서버 set_push_enabled(받기 시각 기록·삭제, 0036). 서버 값은 하나라 두 행이 함께 바뀐다.
// - 휴대폰에서 앱 알림 전체가 꺼짐(권한 거절·차단): 행 하나 '알림 / 휴대폰 설정에서 꺼져 있어요 / [휴대폰 설정 열기]'.
// - 채널 하나만 휴대폰에서 꺼짐: 그 행만 '휴대폰 설정에서 꺼져 있어요 / [휴대폰 설정 열기]'(그 채널 화면으로).
// - 연결 전(프로필 없음, enabled null)에는 그리지 않는다. 휴대폰 설정에서 돌아오면(앱 활성) 다시 읽는다.
type State = {enabled: boolean | null; system: 'on' | 'off'; channels: Record<'daily' | 'cheer', boolean>} | null;
const ROWS: {ch: 'daily' | 'cheer'; title: string; sub: string}[] = [
  {ch: 'daily', title: p.channel.daily, sub: p.channel.daily_desc},
  {ch: 'cheer', title: p.channel.cheer, sub: p.channel.cheer_desc},
];

export function NotifyRows({api}: {api: Api}) {
  const [s, setS] = useState<State>(null);
  const {busy, begin, end} = useBusyLatch();
  const load = useCallback(async () => {
    try {
      const [settings, perm, daily, cheer] = await Promise.all([
        api.myPushSettings(),
        readNotifyPermission(),
        channelEnabled('daily'),
        channelEnabled('cheer'),
      ]);
      setS({
        enabled: settings.enabled,
        system: perm === 'denied' || perm === 'blocked' ? 'off' : 'on',
        channels: {daily: daily !== false, cheer: cheer !== false},
      });
    } catch {
      setS(prev => prev); // 읽기 실패: 지난 값 유지(처음이면 그리지 않음)
    }
  }, [api]);
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
    try {
      const r = await api.setPushEnabled(next);
      setS(prev => (prev ? {...prev, enabled: r.ok ? r.enabled : !next} : prev));
    } catch {
      setS(prev => (prev ? {...prev, enabled: !next} : prev));
    } finally {
      end();
    }
  };
  return (
    <>
      {ROWS.map(r =>
        s.channels[r.ch] ? (
          <Pressable
            key={r.ch}
            testID={`notify-row-${r.ch}`}
            accessibilityRole="switch"
            accessibilityLabel={r.title}
            accessibilityHint={r.sub}
            accessibilityState={{checked: !!s.enabled, disabled: busy}}
            onPress={toggle}
            style={({pressed}) => [styles.section, styles.row, pressed ? styles.pressed : null]}>
            <View style={styles.text}>
              <Text20 size={24} weight="bold">{r.title}</Text20>
              <Text20 style={styles.sub}>{r.sub}</Text20>
            </View>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Switch value={!!s.enabled} onValueChange={toggle} trackColor={{false: color.lineSoft, true: color.done}} thumbColor={color.card} />
            </View>
          </Pressable>
        ) : (
          <SystemOffRow key={r.ch} testID={`notify-row-${r.ch}`} title={r.title} onOpen={() => openNotifySettings(r.ch as AndroidPushChannel)} />
        ),
      )}
    </>
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
  text: {flex: 1, gap: 4},
  sub: {color: color.inkSub},
});
