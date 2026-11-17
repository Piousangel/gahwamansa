import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParentParams} from '../../app/ParentStack';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {StepRow} from '../../ui/StepRow';
import {color, radius} from '../../ui/tokens';
import {useScreenTitleRef} from '../../ui/screenTitle';
import {appCopy, CONSENT_VERSION, copy, Message} from '../../copy/copy';
import {useLoadTodayContent} from './useTodayContent';
import {StampRow} from './StampRow';
import {CheerDialog} from './CheerDialog';
import {kstDateLine, kstWeekdayIndex, stampsFromDates} from './stamps';
import {Stitch} from '../../ui/assets/album';
import {TextLink} from '../link/TextLink';
import {errorMessage} from './useFinishStep';
import {useBootLoading} from '../../app/splash';
import type {StepName, WeekStamps} from '../types';

const c = copy.course;
const STEPS: {step: StepName; route: 'PhotoStep' | 'QuestionStep' | 'KeyboardStep'}[] = [
  {step: 'photo', route: 'PhotoStep'},
  {step: 'question', route: 'QuestionStep'},
  {step: 'hangul', route: 'KeyboardStep'},
];

export function CourseHome({navigation}: NativeStackScreenProps<ParentParams, 'CourseHome'>) {
  const {api, done, content, consented, setConsented, syncError, sync} = useSession();
  const [consentError, setConsentError] = useState<Message | null>(null);
  const titleRef = useRef<unknown>(null); // P8 대화상자가 닫힌 뒤 포커스를 돌려줄 제목
  useLoadTodayContent();
  useBootLoading(content === undefined && !syncError); // 앱 시작 중이면 스플래시 대기 화면이 덮는다
  // 이번 주 도장: 연결된 어르신만 서버에서 받는다(미연결 열람은 호출하지 않고 줄을 숨김). 오늘 단계가 바뀌면 다시 받는다.
  // 실패하면 도장 줄만 숨긴다(장식이라 코스 진행을 막지 않음, 코스 오류는 syncError 가 알림).
  const [week, setWeek] = useState<WeekStamps | null>(null);
  const linked = !!content && content.linked;
  const doneCount = done.length;
  useEffect(() => {
    if (!linked) {
      setWeek(null);
      return;
    }
    let alive = true;
    api
      .getWeekStamps()
      .then(w => alive && setWeek(w))
      .catch(() => alive && setWeek(null));
    return () => {
      alive = false;
    };
  }, [api, linked, doneCount]);
  const consentNow = async () => {
    setConsentError(null);
    try {
      await api.giveConsent(CONSENT_VERSION);
      setConsented(true);
    } catch (e) {
      setConsentError(errorMessage(e));
    }
  };
  // 아직 아무것도 못 받았는데 실패: 오류만 보여 준다(오프라인/서버 오류 문구가 다름)
  if (content === undefined && syncError) {
    return (
      <Screen top={<Title />} bottom={<BigButton label={syncError.button} onPress={sync} />}>
        <Text20 size={24} weight="bold" accessibilityLiveRegion="polite">{syncError.title}</Text20>
        <Text20>{syncError.body}</Text20>
      </Screen>
    );
  }
  if (content === undefined) {
    return (
      <Screen top={<Title />}>
        <Text20 size={24}>{appCopy.loading}</Text20>
      </Screen>
    );
  }
  if (content === null || !content.photo || !content.question) {
    return (
      <Screen top={<Title />} bottom={<BigButton variant="secondary" label={appCopy.no_content.button} onPress={sync} />}>
        <Text20 size={24} weight="bold">{appCopy.no_content.title}</Text20>
        <Text20>{appCopy.no_content.body}</Text20>
      </Screen>
    );
  }
  const preview = !content.linked;
  const all = done.length === 3;
  const current = STEPS.find(s => !done.includes(s.step));
  // 표준 화면 틀(시안 P3 v4): 날짜 줄이 위 고정 제목, 단계는 행, 아래 고정 버튼 1개(글자를 키우면 본문만 스크롤).
  // 하단: 스티치 구분선 + 주 버튼은 지금 단계 이름(copy 10절). 다 마치면 보조 버튼 '오늘 코스 다시 보기'(빈 하단 공백 없음).
  // 다시 보기는 지금 사진 보기만 보기 전용이 있다(B2). 둘 중 고르기·자판으로 쓰기 보기 전용은 디자인 ④ 시안 뒤 추가.
  const reviewPhoto = () => navigation.navigate('PhotoStep', {review: true});
  const dock = current ? (
    <>
      <Stitch width="100%" />
      <BigButton label={c.step[current.step]} onPress={() => navigation.navigate(current.route)} />
    </>
  ) : all ? (
    <>
      <Stitch width="100%" />
      <BigButton variant="secondary" label={c.review_link} onPress={reviewPhoto} />
    </>
  ) : undefined;
  const todayIdx = kstWeekdayIndex();
  // 미연결 열람: 상단 얇은 띠 + 작은 링크(오늘 할 일보다 가볍게, 주 버튼은 아래 하나뿐). 글 첫 줄과 링크 바닥선 정렬
  // '오늘의 코스' 제목은 없다(시안 P3 v4). 날짜 줄이 화면 제목(머리글, R2 첫 포커스·P8 닫힌 뒤 복귀 대상)
  const top = (
    <>
      {preview ? (
        <View testID="course-strip" style={styles.strip}>
          <Text20 style={styles.stripText}>{c.disconnected_banner}</Text20>
          {/* 번호 화면을 위에 쌓아, 거기서 '이전'이면 이 코스 홈으로 돌아온다(QA B2) */}
          <TextLink label={c.write_code} onPress={() => navigation.push('Connect', {from: 'course'})} />
        </View>
      ) : null}
      <View style={styles.titleRow}>
        <Header testID="date-line" label={kstDateLine()} nodeRef={titleRef} size={22} />
        {/* 설정은 연결 여부와 상관없이 늘 보인다(QA B3, 시안 P3) */}
        <TextLink label={copy.settings.open} icon="icon-settings" touch={64} onPress={() => navigation.navigate('Settings')} />
      </View>
      <Stitch width="100%" />
    </>
  );
  return (
    <Screen top={top} bottom={dock}>
      {/* P8: 연결된 어르신에게 온 읽지 않은 응원(미연결 열람은 묻지 않음) */}
      <CheerDialog api={api} enabled={linked} returnFocusRef={titleRef} />
      {syncError ? (
        <View style={styles.notice}>
          <Text20 size={24} weight="bold" accessibilityLiveRegion="polite">{syncError.title}</Text20>
          <BigButton variant="secondary" label={syncError.button} onPress={sync} />
        </View>
      ) : null}
      {/* 인사 한 줄(상태별). 미연결 완료는 도장이 없으므로 도장 말 대신 사실만 */}
      <Text20 size={24} weight="bold" style={styles.greeting}>
        {all ? (preview ? c.done_preview : c.done_today) : done.length === 1 ? c.left_two : done.length === 2 ? c.left_one : c.greeting}
      </Text20>
      {preview || !week ? null : <StampRow days={stampsFromDates(week.weekStart, week.doneDates)} todayIdx={todayIdx} />}
      {!consented && !preview ? (
        <View style={styles.notice}>
          <Text20>{copy.consent.title}</Text20>
          <BigButton variant="secondary" label={copy.consent.accept} onPress={consentNow} />
          {consentError ? <Text20 accessibilityLiveRegion="polite">{consentError.title}</Text20> : null}
        </View>
      ) : null}
      <View testID="course-steps" style={styles.steps}>
        {STEPS.map(s => {
          const status = done.includes(s.step) ? 'done' : current?.step === s.step ? 'now' : 'wait';
          const statusLabel = status === 'done' ? c.status.done : status === 'now' ? c.status.now : c.status.later;
          // 다 마친 뒤 했어요 행 '›' → 보기 전용(지금은 사진 보기만, 나머지는 ④ 시안 뒤)
          const onPress = all && s.step === 'photo' ? reviewPhoto : undefined;
          return <StepRow key={s.step} title={c.step[s.step]} status={status} statusLabel={statusLabel} onPress={onPress} />;
        })}
      </View>
    </Screen>
  );
}

// 화면 제목(R2: Screen 이 첫 포커스로 등록). nodeRef 를 주면 그 요소도 알려 준다(P8 응원 대화상자가 닫힌 뒤 포커스 복귀, R12).
// 로딩·오류·빈 상태는 '오늘의 코스'(기존 P3 보드), 코스가 보이는 상태는 날짜 줄(시안 P3 v4).
function Title() {
  return <Header label={c.title} size={32} />;
}

function Header({label, size, nodeRef, testID}: {label: string; size: number; nodeRef?: React.RefObject<unknown>; testID?: string}) {
  const register = useScreenTitleRef(true);
  const ref = useCallback(
    (node: unknown) => {
      if (nodeRef) {
        nodeRef.current = node;
      }
      return register(node);
    },
    [nodeRef, register],
  );
  return (
    <View ref={ref} testID={testID} accessible accessibilityRole="header" accessibilityLabel={label} style={styles.header}>
      <Text20 size={size} weight="bold" style={styles.title}>
        {label}
      </Text20>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {color: color.inkTitle},
  header: {flexShrink: 1, paddingBottom: 4},
  titleRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8},
  greeting: {color: color.inkTitle},
  // 얇은 띠(시안 P3 v4): 옅은 면, 테두리 없음, 세로 패딩 12, 글 첫 줄과 '번호 쓰기' 바닥선 정렬
  strip: {flexDirection: 'row', alignItems: 'baseline', gap: 8, backgroundColor: color.noticeSoft, borderRadius: radius.chip, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8},
  stripText: {flex: 1},
  // 간격 3단계(리듬 D): 묶음 안 8(행 사이), 묶음 사이 16(본문 gap), 구역 사이 24(= 16 + 8)
  steps: {gap: 8, marginTop: 8},
  notice: {backgroundColor: color.noticeSoft, borderRadius: radius.card, borderWidth: 4, borderColor: color.action, paddingVertical: 14, paddingHorizontal: 16, gap: 12},
});
