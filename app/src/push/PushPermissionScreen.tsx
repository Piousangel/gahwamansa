import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {copy} from '../copy/copy';
import {Screen} from '../ui/Screen';
import {Text20} from '../ui/Text20';
import {BigButton} from '../ui/BigButton';
import {TextLink} from '../ui/TextLink';
import {BrandSymbol} from '../ui/assets/brandSymbol';
import {useBusyLatch} from '../ui/useBusyLatch';
import {color, fontSize, radius, shadow, space, touch} from '../ui/tokens';
import {acceptParentPrompt, declineParentPrompt} from './pushClient';
import {openNotifySettings, requestNotifyPermission, type NotifyPermission} from './notifyNative';
import {pushDeps} from './runtime';

const t = copy.push.permission;

// N1 어르신 알림 안내(시안 common/N1_push 보드 1·2, 문구 push.permission.* 11-11·11-1 #8b). 동의 다음 한 번, 앱 안 안내 → 시스템 창.
// '알려 주세요' = 서버 받기 동의(set_push_enabled true, 0036) + 시스템 창. '괜찮아요' = 서버 호출 없음, 다시 묻지 않음(켜기는 P13).
// 리뷰 L1: 시스템 창이 뜨지 않으면(이미 두 번 거절·앱 알림 끔 = blocked) 닫지 않고 '알림이 휴대폰 설정에서 꺼져 있어요' + '휴대폰 설정 열기'.
//   창에서 '허용 안함'을 고른 경우(denied)는 그 선택을 따라 닫는다. 재노출: 이 계정에서 답했으면 N1 은 다시 뜨지 않는다 —
//   다시 켜기는 P13 알림 행(휴대폰에서 꺼짐이면 push.system_off 행 + 설정 열기, AP-06).
// 시안과 다른 점: 알림 그림의 시각(오전 8:00)은 빼 둠 — 실제 발송은 09시(D-07)라 약속처럼 읽히지 않게(디자인 확인 필요).
export function PushPermissionScreen() {
  const navigation = useNavigation();
  const {busy, begin, end} = useBusyLatch();
  const [blocked, setBlocked] = useState(false);
  const close = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };
  const yes = async () => {
    const d = pushDeps();
    if (!begin()) {
      return;
    }
    let p: NotifyPermission = 'granted';
    try {
      if (d) {
        p = await acceptParentPrompt(d, requestNotifyPermission);
      }
    } finally {
      end();
    }
    if (p === 'blocked' || p === 'unknown') {
      setBlocked(true); // 창이 뜨지 않았다 → 휴대폰 설정 안내(닫지 않음)
      return;
    }
    close();
  };
  const no = async () => {
    if (blocked) {
      close(); // 이미 답함('알려 주세요'), 설정은 나중에
      return;
    }
    const d = pushDeps();
    if (!begin()) {
      return;
    }
    try {
      if (d) {
        await declineParentPrompt(d);
      }
    } finally {
      end();
      close();
    }
  };

  return (
    <Screen
      bottom={
        blocked ? (
          <>
            <BigButton label={copy.push.system_off.open_parent} onPress={() => openNotifySettings()} />
            <TextLink label={t.no} onPress={no} touch={touch.link} />
          </>
        ) : (
          <>
            <BigButton label={t.yes} onPress={yes} loading={busy} />
            <TextLink label={t.no} onPress={no} disabled={busy} touch={touch.link} />
          </>
        )
      }>
      <View
        testID="n1-preview"
        style={styles.card}
        accessible
        accessibilityLabel={t.preview_a11y}
        importantForAccessibility="yes">
        <BrandSymbol size={48} />
        <View style={styles.cardText} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text20 style={styles.sub}>{copy.brand.name}</Text20>
          <Text20 weight="bold" style={styles.title}>{copy.push.daily.title}</Text20>
          <Text20>{t.preview_caption}</Text20>
        </View>
      </View>
      <Text20 size={fontSize.title} weight="bold" accessibilityRole="header" style={styles.title}>
        {t.title}
      </Text20>
      <Text20 size={fontSize.bodyLg}>{t.body}</Text20>
      <Text20 size={fontSize.bodyLg} style={styles.sub}>{t.optional}</Text20>
      {blocked ? (
        <Text20 testID="n1-system-off" size={fontSize.bodyLg} weight="bold" accessibilityLiveRegion="polite">
          {copy.push.system_off.body}
        </Text20>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: color.card,
    boxShadow: shadow.soft,
  },
  cardText: {flex: 1, minWidth: 0},
  sub: {color: color.inkSub},
  title: {color: color.inkTitle},
});
