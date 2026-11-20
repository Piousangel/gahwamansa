import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {backDestination} from '../../app/backDestination';
import {Banner, Button, DsScreen, Heading, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {CONSENT_VERSION, copy, Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {track} from '../track';

const c = copy.consent;

// P2 동의 v4(시안 P6_P7_N1_P2_ds4b P2 보드 + 전문가 리뷰 N-12·7:42). 문구는 그대로(CONSENT_VERSION 영향 없음, 버튼 문구는 법률 확인 전이라 바꾸지 않음).
// - 100%: 흰 카드 안 세 줄은 ✓ 대신 점 머리표(V4: 체크박스로 오해 방지), 거절 안내는 카드 아래, 두 버튼은 Dock.
// - 글자 150% 이상(N-12): 점 칸을 빼 세 줄을 전폭으로, 두 버튼은 본문 끝(다 읽은 뒤에 닿는다), 거절 안내는 '싫어요' 바로 아래 한 줄.
// - 두 버튼은 같은 높이(even) — 주·보조는 색으로만 나눈다(7:42).
export function ConsentScreen({navigation}: NativeStackScreenProps<ParentParams, 'Consent'>) {
  const {api, sync, syncError, setConsented} = useSession();
  const {fontScale} = useWindowDimensions();
  const large = fontScale >= 1.5;
  const [declined, setDeclined] = useState(false);
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [error, setError] = useState<Message | null>(null);
  const shownSent = useRef(false); // consent_shown 은 화면당 한 번

  // 동의 화면은 코스 홈으로 바뀐다(replace): 뒤로가기로 동의 화면이 다시 나오지 않게(리뷰 ③)
  // 서버가 이미 동의한 상태면 이 화면을 건너뛴다(서버 상태와 어긋나는 '싫어요'를 막는다).
  // 확인이 실패하면 세션의 syncError 로 알리되 고르기는 그대로 할 수 있다.
  useEffect(() => {
    let alive = true;
    sync().then(r => {
      if (alive && r?.consented) {
        navigation.replace('CourseHome');
      } else if (alive && !shownSent.current) {
        shownSent.current = true;
        track(api, 'consent_shown'); // AC-05: 이미 동의해 건너뛴 경우는 세지 않는다(확인 실패면 화면이 보이므로 센다)
      }
    });
    return () => {
      alive = false;
    };
  }, [sync, navigation, api]);

  const shown = error ?? syncError; // 동의 저장 실패가 우선, 없으면 상태 확인 실패
  const accept = async () => {
    if (!beginBusy()) {
      return;
    }
    setError(null);
    try {
      await api.giveConsent(CONSENT_VERSION);
      track(api, 'parent_consent_accepted', {consent_version: CONSENT_VERSION}); // 서버가 저장을 인정한 뒤에만
      setConsented(true);
      navigation.replace('CourseHome');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      endBusy();
    }
  };
  // 거부: 서버 호출 없음. 코스는 볼 수 있고 답변은 저장하지 않는다. 나중에 코스 홈에서 동의할 수 있다.
  const decline = () => {
    track(api, 'parent_consent_declined');
    setDeclined(true);
  };

  if (declined) {
    return (
      <DsScreen variant="intro" dock={{primary: {label: c.declined_button, onPress: () => navigation.replace('CourseHome')}}}>
        <Heading level={1}>{c.declined_notice}</Heading>
        <Text role="bodyLg">{c.declined_detail}</Text>
        <Text role="bodyLg">{c.declined_reassure}</Text>
      </DsScreen>
    );
  }

  // 뒤로: 스택 바로 아래 화면(번호 쓰기 등)이 있을 때만, 목적지 이름으로(W-09)
  const dest = navigation.canGoBack() ? backDestination(navigation.getState() as never) : null;
  const back = dest ? {to: dest, onPress: () => navigation.goBack()} : undefined;
  // 오류는 버튼 바로 앞(읽기 순서: 본문 → 오류 → 좋아요)
  const errorBand = shown ? <Banner tone="danger" text={`${shown.title}. ${shown.body}`} testID="consent-error" /> : null;
  const declineNote = (
    <Text role="body" tone="muted" testID="consent-decline-note">
      {c.decline_note}
    </Text>
  );
  const reassure = (
    <Text role="body" tone="muted" testID="consent-reassure">
      {c.reassure}
    </Text>
  );

  return (
    <DsScreen
      variant="intro"
      back={back}
      dock={large ? undefined : {primary: {label: c.accept, onPress: accept, disabled: busy}, secondary: {label: c.decline, onPress: decline}, even: true}}
      tail={
        large ? (
          <View style={styles.actions} testID="consent-actions">
            {errorBand}
            <Button kind="primary" label={c.accept} onPress={accept} disabled={busy} />
            <Button kind="secondary" even label={c.decline} onPress={decline} />
            {declineNote}
            {reassure}
          </View>
        ) : null
      }>
      <Heading level={1}>{c.title}</Heading>
      <View testID="consent-points" style={styles.card}>
        {c.body.map(t =>
          large ? (
            // 150% 이상: 점 칸 없이 전폭(N-12)
            <Text key={t} role="bodyLg" testID="consent-point">
              {t}
            </Text>
          ) : (
            <View key={t} testID="consent-point" style={styles.point}>
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Text role="bodyLg" tone="muted" testID="consent-dot">
                  •
                </Text>
              </View>
              <Text role="bodyLg" style={styles.pointText}>
                {t}
              </Text>
            </View>
          ),
        )}
      </View>
      {large ? null : (
        <>
          {declineNote}
          {reassure}
          {errorBand}
        </>
      )}
    </DsScreen>
  );
}

const styles = StyleSheet.create({
  // 흰 카드 + line 1.5(누르는 것 아님 — 시안 P2), 줄 간격 12
  card: {backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, borderRadius: ds.radius.card, padding: 16, gap: 12},
  point: {flexDirection: 'row', alignItems: 'flex-start', gap: 12},
  pointText: {flexGrow: 1, flexShrink: 1},
  actions: {gap: ds.touch.elder.gap},
});
