import React from 'react';
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
import {requestNotifyPermission} from './notifyNative';
import {pushDeps} from './runtime';

const t = copy.push.permission;

// N1 어르신 알림 안내(시안 common/N1_push 보드 1·2, 문구 push.permission.* 11-11·11-1 #8b). 동의 다음 한 번, 앱 안 안내 → 시스템 창.
// '알려 주세요' = 서버 받기 동의(set_push_enabled true, 0036) + 시스템 창. '괜찮아요' = 서버 호출 없음, 다시 묻지 않음(켜기는 P13).
// 시안과 다른 점: 알림 그림의 시각(오전 8:00)은 빼 둠 — 실제 발송은 09시(D-07)라 약속처럼 읽히지 않게(디자인 확인 필요).
export function PushPermissionScreen() {
  const navigation = useNavigation();
  const {busy, begin, end} = useBusyLatch();
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
    try {
      if (d) {
        await acceptParentPrompt(d, requestNotifyPermission);
      }
    } finally {
      end();
      close();
    }
  };
  const no = async () => {
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
        <>
          <BigButton label={t.yes} onPress={yes} loading={busy} />
          <TextLink label={t.no} onPress={no} disabled={busy} touch={touch.link} />
        </>
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
