import React, {useCallback, useEffect, useState} from 'react';
import {AppState, Pressable, StyleSheet, Switch, View} from 'react-native';
import {SWITCH_COLORS, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {useToast} from '../../ui/Toast';
import {copy} from '../../copy/copy';
import {channelEnabled, openNotifySettings} from '../../push/notifyNative';
import {registerToken} from '../../push/pushClient';
import {pushDeps} from '../../push/runtime';
import {isOffline, type Api} from '../types';
import {useNotifyPermission} from './useNotifyPermission';

const p = copy.push;

// C7 '가족 연결' 알림(자녀가 받는 알림은 연결·재연결뿐, DECISIONS U11). 리드 결정 11-18(법률 규칙 ③, 리뷰 M1·L2):
// - 켬 = set_push_enabled(true): 앱 안에서 직접 켤 때만 받기 동의를 남긴다(권한 허용만으로는 기록하지 않음). 켜면 토큰도 등록
// - 끔 = set_push_enabled(false): 앱 안에서 알림을 끌 수 있어야 한다
// - 상태 = my_push_settings(서버 받기 상태) + 휴대폰의 'family' 채널 꺼짐 표시. 휴대폰 권한이 꺼져 있으면 켜는 길(시스템 창·설정)
export function FamilyPushRow({api}: {api: Api}) {
  const notify = useNotifyPermission();
  const {show} = useToast();
  const [enabled, setEnabled] = useState<boolean | null | undefined>(undefined); // undefined 읽는 중, null 연결 전(프로필 없음)
  const [channelOff, setChannelOff] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .myPushSettings()
      .then(r => setEnabled(r.enabled))
      .catch(() => setEnabled(undefined));
    channelEnabled('family').then(v => setChannelOff(v === false));
  }, [api]);
  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        load(); // 휴대폰 설정에서 돌아오면 채널 상태를 다시 본다
      }
    });
    return () => sub.remove();
  }, [load]);

  if (notify.state === 'unknown' || enabled === undefined || enabled === null) {
    return null;
  }
  if (notify.state === 'denied' || channelOff) {
    // 휴대폰 쪽에서 꺼짐: 앱 토글로는 켤 수 없으니 켜는 길을 보인다
    const open = notify.state === 'denied' ? notify.open : () => openNotifySettings('family');
    return (
      <Pressable
        testID="child-notify-row"
        accessibilityRole="button"
        accessibilityLabel={`${p.channel.family}, ${p.system_off.open_child}, ${p.system_off.body}`}
        onPress={open}
        style={({pressed}) => [styles.row, pressed ? styles.pressed : null]}>
        <View style={styles.text}>
          <Text role="bodyLg">{p.channel.family}</Text>
          <Text role="sub" tone="muted">
            {p.system_off.body}
          </Text>
        </View>
        <Text role="body" tone="muted">
          {p.system_off.open_child}
        </Text>
      </Pressable>
    );
  }

  const toggle = async () => {
    if (busy) {
      return;
    }
    const next = !enabled;
    setBusy(true);
    setEnabled(next); // 바로 바뀐 것처럼(실패하면 되돌림)
    try {
      const r = await api.setPushEnabled(next);
      if (!r.ok) {
        throw new Error(r.reason);
      }
      setEnabled(r.enabled);
      const d = pushDeps();
      if (next && d) {
        registerToken(d).catch(() => {});
      }
    } catch (e) {
      setEnabled(!next);
      show({text: isOffline(e) ? copy.errors.offline.title : copy.errors.server.title});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      testID="child-notify-row"
      accessibilityRole="switch"
      // L2(대기열 44): 이름에 무엇을 켜는지까지(보이는 글 두 줄과 같게). 힌트만으로는 힌트를 끈 화면 읽기에서 '가족 연결'만 들렸다
      accessibilityLabel={`${p.channel.family}, ${p.channel.family_desc}`}
      accessibilityState={{checked: enabled, disabled: busy}}
      onPress={toggle}
      style={({pressed}) => [styles.row, pressed ? styles.pressed : null]}>
      <View style={styles.text}>
        <Text role="bodyLg">{p.channel.family}</Text>
        <Text role="sub" tone="muted">
          {p.channel.family_desc}
        </Text>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch value={enabled} onValueChange={toggle} disabled={busy} {...SWITCH_COLORS} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: ds.touch.child.primary, paddingVertical: 10},
  pressed: {opacity: 0.7},
  text: {flex: 1},
});
