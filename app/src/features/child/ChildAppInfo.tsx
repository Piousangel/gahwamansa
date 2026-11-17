import React from 'react';
import {Linking, Pressable, StyleSheet, View} from 'react-native';
import {BackBar} from '../../app/BackBar';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {copy} from '../../copy/copy';
import {color, radius, size} from '../../ui/tokens';
import {APP_VERSION, CONTACT_EMAIL, PRIVACY_URL} from '../../lib/appInfo';
import {useAppVersionTaps} from '../../dev/devGate';

const a = copy.child.app_info;

// C7 앱 정보: 버전·처리방침·문의(값이 정해진 것만) + AI 고지 상자.
// TODO(오픈소스 라이선스 행): appInfo.OSS_LICENSES_READY 가 켜지면 목록 화면과 함께 연다.
export function ChildAppInfo() {
  const privacy = PRIVACY_URL;
  const versionTap = useAppVersionTaps();
  const mail = CONTACT_EMAIL;
  return (
    <Screen
      top={
        <>
          <BackBar />
          <Text20 size={32} weight="bold" accessibilityRole="header" style={styles.title}>{a.title}</Text20>
        </>
      }>
      <View style={styles.section}>
        {/* 버전 줄: staging·개발 빌드에서만 7번 탭 → 개발자 메뉴(devGate). production 은 누를 수 없는 줄 */}
        <Pressable testID="version-tap" disabled={!versionTap} onPress={versionTap} style={styles.row} accessible accessibilityLabel={`${a.version}, ${APP_VERSION}`}>
          <Text20 weight="bold" style={styles.flex}>{a.version}</Text20>
          <Text20 style={styles.sub}>{APP_VERSION}</Text20>
        </Pressable>
        {privacy ? <LinkRow label={a.privacy} onPress={() => Linking.openURL(privacy)} /> : null}
        {mail ? <LinkRow label={a.contact} sub={mail} onPress={() => Linking.openURL(`mailto:${mail}`)} /> : null}
      </View>
      <View testID="ai-notice" style={styles.notice}>
        <Text20 weight="bold">{a.ai_title}</Text20>
        <Text20>{a.ai_body}</Text20>
      </View>
    </Screen>
  );
}

function LinkRow({label, sub, onPress}: {label: string; sub?: string; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({pressed}) => [styles.row, pressed ? styles.pressed : null]}>
      <Text20 weight="bold" style={styles.flex}>{label}</Text20>
      {sub ? <Text20 style={styles.sub}>{sub}</Text20> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  title: {paddingBottom: 8},
  section: {backgroundColor: color.card, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 4},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: size.touchMin, paddingVertical: 10},
  pressed: {opacity: 0.6},
  sub: {color: color.inkSub},
  notice: {backgroundColor: color.noticeSoft, borderRadius: radius.card, padding: 16, gap: 6},
});
