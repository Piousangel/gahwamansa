import React from 'react';
import {Linking, Pressable, StyleSheet, View} from 'react-native';
import {BackBar} from '../../app/BackBar';
import {AudienceProvider, Card, DsScreen, Heading, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {copy} from '../../copy/copy';
import {APP_VERSION, CONTACT_EMAIL, PRIVACY_URL} from '../../lib/appInfo';
import {useAppVersionTaps} from '../../dev/devGate';

const a = copy.child.app_info;

// C8 앱 정보: 버전·처리방침·문의(값이 정해진 것만) + AI 고지 상자.
// v4(V4-INDEX '시안 없음, 토큰 효과만'): 배치는 그대로, 부품만 ui/ds(DsScreen·Text 역할·Card notice). 굵은 역할은 제목(title)·AI 고지 제목(heading) 둘.
// TODO(오픈소스 라이선스 행): appInfo.OSS_LICENSES_READY 가 켜지면 목록 화면과 함께 연다.
export function ChildAppInfo() {
  const privacy = PRIVACY_URL;
  const versionTap = useAppVersionTaps();
  const mail = CONTACT_EMAIL;
  const versionInner = (
    <>
      <Text role="bodyLg" style={styles.flex}>
        {a.version}
      </Text>
      <Text role="body" tone="muted">
        {APP_VERSION}
      </Text>
    </>
  );
  return (
    <AudienceProvider value="child">
      <DsScreen
        variant="step"
        header={
          <>
            <BackBar />
            <Heading level={1}>{a.title}</Heading>
          </>
        }>
        <View style={styles.section}>
          {/* 버전 줄: staging·개발 빌드에서만 7번 탭 → 개발자 메뉴(devGate). production 은 누를 수 없는 줄 */}
          {versionTap ? (
            <Pressable testID="version-tap" onPress={versionTap} style={styles.row} accessible accessibilityLabel={`${a.version}, ${APP_VERSION}`}>
              {versionInner}
            </Pressable>
          ) : (
            // production: 누를 수 없는 줄(화면 읽기에 '사용 안 함'으로 읽히지 않게, 보안 리뷰 L1)
            <View testID="version-line" style={styles.row} accessible accessibilityLabel={`${a.version}, ${APP_VERSION}`}>
              {versionInner}
            </View>
          )}
          {privacy ? <LinkRow label={a.privacy} onPress={() => Linking.openURL(privacy)} /> : null}
          {mail ? <LinkRow label={a.contact} sub={mail} onPress={() => Linking.openURL(`mailto:${mail}`)} /> : null}
        </View>
        <Card tone="notice" testID="ai-notice">
          <Heading level={2}>{a.ai_title}</Heading>
          <Text role="body">{a.ai_body}</Text>
        </Card>
      </DsScreen>
    </AudienceProvider>
  );
}

function LinkRow({label, sub, onPress}: {label: string; sub?: string; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({pressed}) => [styles.row, pressed ? styles.pressed : null]}>
      <Text role="bodyLg" style={styles.flex}>
        {label}
      </Text>
      {sub ? (
        <Text role="body" tone="muted">
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  section: {backgroundColor: ds.color.card, borderRadius: ds.radius.card, paddingHorizontal: 16, paddingVertical: 4, alignSelf: 'stretch'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: ds.touch.child.primary, paddingVertical: 10},
  pressed: {backgroundColor: ds.color.actionSoft},
});
