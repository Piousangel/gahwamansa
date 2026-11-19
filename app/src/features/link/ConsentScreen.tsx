import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {CONSENT_VERSION, copy, Message} from '../../copy/copy';
import {errorMessage} from '../course/useFinishStep';
import {useBusyLatch} from '../../ui/useBusyLatch';
import {track} from '../track';
import {Icon} from '../../ui/assets/icons';
import {color, radius, shadow} from '../../ui/tokens';

export function ConsentScreen({navigation}: NativeStackScreenProps<ParentParams, 'Consent'>) {
  const {api, sync, syncError, setConsented} = useSession();
  const [declined, setDeclined] = useState(false);
  const {busy, begin: beginBusy, end: endBusy} = useBusyLatch(); // 같은 틱 두 번 누름도 막는다(AP-14)
  const [error, setError] = useState<Message | null>(null);
  const shownSent = useRef(false); // consent_shown 은 화면당 한 번

  // 동의 화면은 코스 홈으로 바뀐다(replace): 뒤로가기로 동의 화면이 다시 나오지 않게(리뷰 ③)
  // 서버가 이미 동의한 상태면 이 화면을 건너뛴다(서버 상태와 어긋나는 '싫어요'를 막는다).
  // 확인이 실패하면 세션의 syncError 로 알리되 고르기는 그대로 할 수 있다.
  useEffect(() => {
    let alive = true;
    sync().then(c => {
      if (alive && c?.consented) {
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
      <Screen bottom={<BigButton label={copy.consent.declined_button} onPress={() => navigation.replace('CourseHome')} />}>
        <Text20 size={28} weight="bold">{copy.consent.declined_notice}</Text20>
        <Text20>{copy.consent.declined_detail}</Text20>
        <Text20>{copy.consent.declined_reassure}</Text20>
      </Screen>
    );
  }
  return (
    <Screen
      top={<BackBar />}
      bottom={
        <>
          {/* 오류 상자는 하단 버튼 바로 위(디자인 판정: 네 줄로 늘어 본문에 두면 150% 이상에서 화면 밖으로 밀림). 읽기는 본문 다음, 버튼 앞 */}
          {shown ? (
            <View testID="consent-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
              <Icon name="icon-warning" size={28} color={color.dangerInk} />
              <View style={styles.errorText}>
                <Text20 size={24} weight="bold" style={styles.errorTitle}>{shown.title}</Text20>
                <Text20>{shown.body}</Text20>
              </View>
            </View>
          ) : null}
          <BigButton label={copy.consent.accept} disabled={busy} onPress={accept} />
          <BigButton variant="secondary" label={copy.consent.decline} onPress={decline} />
        </>
      }>
      <Text20 size={32} weight="bold" accessibilityRole="header" style={styles.title}>{copy.consent.title}</Text20>
      {/* 시안 P2: 흰 카드 안 체크 행. 행 간격 8, 체크 32 는 첫 줄에 맞춤(여러 줄이어도 위 정렬).
          본문은 Screen 스크롤 영역이라 150% 이상에서 넘치면 아래 흐림이 보이고, 버튼은 하단 고정이라 끝까지 안 읽어도 누를 수 있다 */}
      <View testID="consent-points" style={styles.card}>
        {copy.consent.body.map(t => (
          <View key={t} testID="consent-point" style={styles.point}>
            <Icon name="icon-check" size={32} color={color.done} />
            <Text20 size={22} style={styles.pointText}>{t}</Text20>
          </View>
        ))}
      </View>
      {/* 싫어요일 때 가족에게 보이는 것(법률 노출 #7, copy 11-19 decline_note): 체크 목록과 성격이 달라 카드 바로 아래 'ⓘ' 한 줄(디자인 판정 M2 ②) */}
      <View testID="consent-info" style={styles.point}>
        <Icon name="icon-info" size={28} color={color.inkSub} />
        <Text20 testID="consent-decline-note" style={styles.infoText}>{copy.consent.decline_note}</Text20>
      </View>
      <Text20 size={22} style={styles.sub}>{copy.consent.reassure}</Text20>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {color: color.inkTitle},
  card: {backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 16, gap: 8, boxShadow: shadow.soft},
  point: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 60},
  pointText: {flex: 1, minWidth: 0, color: color.inkTitle},
  sub: {color: color.inkSub},
  infoText: {flex: 1, minWidth: 0, color: color.inkSub},
  error: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: color.card, borderWidth: 4, borderColor: color.danger, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 16},
  errorText: {flex: 1, gap: 6},
  errorTitle: {color: color.dangerInk},
});
