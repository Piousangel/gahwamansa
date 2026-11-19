import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {TopBar} from '../../ui/TopBar';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {AudienceProvider, Choice, Sheet} from '../../ui/ds';
import {useToast} from '../../ui/Toast';
import {useSendCheer} from './useSendCheer';
import {findTitleDup} from './titleDup';
import {TitleDupNotice} from './TitleDupNotice';
import {appCopy, copy, withTitle} from '../../copy/copy';
import {color, radius} from '../../ui/tokens';
import {CHILD_CHEER_KEYS, ChildParent, ChildSummary} from '../types';
import {useChildSummary} from '../../shared/useChildData';
import {useBootLoading} from '../../app/splash';
import {formatAnswerDate} from './formatDate';
import {BrandSymbol} from '../../ui/assets/brandSymbol';
import {childErrorMessage} from '../../shared/childError';
import {daysSinceYmd} from '../../lib/childFormat';
import {track, trackOnce} from '../track';

const c = copy.child;
const h = c.home;

// 화면에 보일 어르신 목록. 옛 서버(parents 비어 있음)면 가족 호칭 한 명으로 본다.
function cards(info: ChildSummary): ChildParent[] {
  return info.parents.length
    ? info.parents
    : [{parentId: '', title: info.parentTitle, shared: info.shared, connected: true, latest: info.latest, starter: null}];
}

// C4 자녀 홈 v3: 상단 바(우리 집 앨범·설정) + 최근 답 카드(어르신별) + 연결 끊김 배너 + 하단 응원 보내기.
// 칩·연속일·참여·완료 여부 없음. 연결이 풀린 어르신만 있으면 응원 버튼을 뺀다.
export function ChildHome() {
  const navigation = useNavigation<NativeStackNavigationProp<ChildParams>>();
  const {api} = useSession();
  const {info, error, loading, load} = useChildSummary();
  const [sheet, setSheet] = useState(false);
  const [making, setMaking] = useState(false);
  const {show} = useToast();
  const {send, sending} = useSendCheer(api, load);
  useBootLoading(loading && !info && !error); // 앱 시작 중이면 스플래시 대기 화면이 덮는다

  const list = info ? cards(info) : [];
  const many = list.length > 1;
  const reachable = list.filter(p => p.connected && p.parentId); // 옛 서버(parent_id 없음)면 보낼 대상이 없다
  const dup = findTitleDup(list);

  // AC-05 전환 분모: 이 기기에서 답 카드를 처음 본 때 한 번(child_first_answer_viewed{days_since_connect}). 답 내용·날짜는 싣지 않는다
  const firstSeen = list.find(p => p.shared && p.latest);
  const firstSeenDays = firstSeen?.connectedDate ? daysSinceYmd(firstSeen.connectedDate) : null;
  const hasAnswer = !!firstSeen;
  useEffect(() => {
    if (hasAnswer) {
      trackOnce(api, 'child_first_answer_viewed', firstSeenDays !== null ? {days_since_connect: firstSeenDays} : {}).catch(() => {});
    }
  }, [hasAnswer, firstSeenDays, api]);

  const makeCode = async (p: ChildParent) => {
    if (making) {
      return;
    }
    setMaking(true);
    try {
      const code = await api.issueInviteCode(p.parentId || null);
      track(api, 'invite_code_issued', {purpose: p.parentId ? 'reconnect' : 'parent_code'}); // AC-05
      navigation.navigate('Code', {code, title: p.title});
    } catch (e) {
      show({text: childErrorMessage(e, h.error).title, kind: 'error', action: {label: h.error.button, onPress: () => makeCode(p)}});
    } finally {
      setMaking(false);
    }
  };

  const top = <TopBar title={h.bar_title} settingsLabel={copy.settings.open} onSettings={() => navigation.navigate('Settings')} />;

  // 받은 요약이 없을 때만 오류 화면. 이미 받은 것이 있으면 그대로 두고 오류 줄만 덧붙인다.
  if (error && !info) {
    return (
      <Screen top={top}>
        <View testID="child-home-error" style={styles.center}>
          <Text20 size={24} weight="bold">{error.title}</Text20>
          <Text20>{error.body}</Text20>
          <BigButton variant="secondary" label={error.button} onPress={load} />
        </View>
      </Screen>
    );
  }

  const bottom =
    !info ? (
      <BigButton label={c.cheer.button} disabled disabledReason={h.loading_reason} onPress={() => {}} />
    ) : reachable.length ? (
      <BigButton label={c.cheer.button} loading={sending} onPress={() => setSheet(true)} />
    ) : undefined;

  return (
    <View style={styles.flex}>
      <Screen top={top} bottom={bottom}>
        {error ? <Text20 weight="bold" accessibilityLiveRegion="polite">{error.title}</Text20> : null}
        {!info ? (
          <Text20>{appCopy.loading}</Text20>
        ) : (
          <>
            {list
              .filter(p => !p.connected)
              .map(p => (
                <View key={`off-${p.parentId}`} testID="child-home-disconnected" style={styles.banner} accessibilityLiveRegion="polite">
                  <Text20 size={24} weight="bold">{withTitle(h.disconnected.title, p.title)}</Text20>
                  <Text20>{h.disconnected.body}</Text20>
                  <BigButton variant="secondary" label={h.disconnected.button} loading={making} onPress={() => makeCode(p)} />
                </View>
              ))}
            {/* 호칭 겹침 안내(시안 C4_title_dup): 겹친 동안 닫을 수 없는 줄 + 이름 고르기 */}
            {dup ? <TitleDupNotice api={api} dup={dup} parents={list} onChanged={load} /> : null}
            {list.map(p => (
              <AnswerCard key={`card-${p.parentId}`} parent={p} withHeader={many} />
            ))}
          </>
        )}
      </Screen>
      {/* 응원 시트 v4(시안 child/C4_cheer_sheet_ds4 #40): ds Sheet + Choice(action) 1열. 확정 문구 4개, 누르면 바로 보낸다 */}
      <AudienceProvider value="child">
        <Sheet visible={sheet} onClose={() => setSheet(false)} closeLabel={c.cheer.close} title={c.cheer.title} sub={c.cheer.hint} testID="sheet">
          <Choice
            mode="action"
            testID="cheer"
            items={CHILD_CHEER_KEYS.map(k => ({key: k, label: copy.cheers[k]}))}
            onSelect={k => {
              setSheet(false);
              send(k as (typeof CHILD_CHEER_KEYS)[number], reachable);
            }}
          />
        </Sheet>
      </AudienceProvider>
    </View>
  );
}

// 최근 답 카드(폴라로이드형 테이프 1곳 + 스티치 1줄). 어르신이 여럿이면 빈·나누지 않음 상태에도 호칭 머리를 단다.
function AnswerCard({parent: p, withHeader}: {parent: ChildParent; withHeader: boolean}) {
  const head = `${p.title}${c.title_suffix}`;
  if (!p.shared || !p.latest) {
    return (
      <View style={withHeader ? styles.card : styles.plain}>
        {withHeader ? <Text20 weight="bold" style={styles.sub}>{head}</Text20> : <BrandSymbol size={72} />}
        <Text20 style={styles.centerText}>{!p.shared ? c.not_shared : c.no_answer}</Text20>
      </View>
    );
  }
  const today = formatAnswerDate(p.latest.answeredDate) === '오늘';
  return (
    // 리뷰 L6: 카드 한 장을 한 덩어리로 읽는다(호칭의 최근 답, 답, 날짜, 이야기 문장)
    <View
      testID="child-home-card"
      style={styles.card}
      accessible
      accessibilityLabel={[head, p.latest.choiceLabel, formatAnswerDate(p.latest.answeredDate), p.starter ? `${h.starter_label}, ${p.starter}` : today ? `${p.latest.choiceLabel}${c.talk}` : h.talk_old].join(', ')}>
      <View style={styles.tape} />
      <Text20 weight="bold" style={styles.sub}>{head}</Text20>
      <Text20 size={72} weight="bold" style={styles.choice}>{p.latest.choiceLabel}</Text20>
      <Text20>{formatAnswerDate(p.latest.answeredDate)}</Text20>
      <View style={styles.stitch} />
      {p.starter ? (
        // 기능 회의 B3(C4_starter): 첫마디가 있으면 기본 문장을 대체한다(둘 중 하나만)
        <View testID="child-home-starter" style={styles.starter}>
          <Text20 weight="bold" style={styles.sub}>{h.starter_label}</Text20>
          <Text20 size={24}>{p.starter}</Text20>
        </View>
      ) : (
        <Text20 size={24}>{today ? `${p.latest.choiceLabel}${c.talk}` : h.talk_old}</Text20>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  center: {alignItems: 'center', gap: 8, paddingTop: 48},
  centerText: {textAlign: 'center'},
  plain: {paddingVertical: 32, alignItems: 'center', gap: 8},
  banner: {backgroundColor: color.noticeSoft, borderRadius: radius.card, padding: 16, gap: 6},
  card: {backgroundColor: color.card, borderRadius: radius.childCard, padding: 20, paddingTop: 28, gap: 6, marginTop: 8},
  tape: {position: 'absolute', top: -10, alignSelf: 'center', width: 96, height: 24, backgroundColor: color.tape, transform: [{rotate: '-3deg'}]},
  stitch: {borderTopWidth: 2, borderStyle: 'dashed', borderColor: color.lineSoft, marginVertical: 8},
  choice: {color: color.inkTitle},
  starter: {gap: 4},
  sub: {color: color.inkSub},
});
