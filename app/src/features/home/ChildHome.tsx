import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {useSession} from '../../app/session';
import {TopBar} from '../../ui/TopBar';
import {Screen, SCREEN_FADE_H} from '../../ui/Screen';
import {AudienceProvider, Button, Card, Choice, Heading, Sheet, StateView, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import type {IconName} from '../../ui/assets/icons';
import {useToast} from '../../ui/Toast';
import {useSendCheer} from './useSendCheer';
import {findTitleDup} from './titleDup';
import {TitleDupNotice} from './TitleDupNotice';
import {appCopy, copy, withTitle} from '../../copy/copy';
import {CHILD_CHEER_KEYS, ChildParent, ChildSummary} from '../types';
import {useChildSummary} from '../../shared/useChildData';
import {useBootLoading} from '../../app/splash';
import {formatAnswerDate} from './formatDate';
import {BrandSymbol} from '../../ui/assets/brandSymbol';
import {childErrorMessage} from '../../shared/childError';
import {daysSinceYmd} from '../../lib/childFormat';
import {track, trackOnce} from '../track';
import {ChildHomeEmpty, useEmptyFold} from './ChildHomeEmpty';

/** 응원 문장별 사물 아이콘(시안 C4_cheer_sheet_ds4: 해·찻잔·새싹·쪽지, 하트·이모지 금지 Q5) */
const CHEER_ICON = {love_you: 'icon-sun', warm_day: 'icon-teacup', thanks_always: 'icon-sprout', peaceful_day: 'icon-note'} as const satisfies Record<(typeof CHILD_CHEER_KEYS)[number], IconName>;

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
  const cheerButton = useRef<React.ComponentRef<typeof import('react-native').Pressable>>(null); // 시트가 닫히면 화면 읽기 포커스를 이 버튼으로(PR #93 M1)
  const [making, setMaking] = useState(false);
  const {show} = useToast();
  const {send, sending} = useSendCheer(api, load);
  useBootLoading(loading && !info && !error); // 앱 시작 중이면 스플래시 대기 화면이 덮는다

  const list = info ? cards(info) : [];
  const many = list.length > 1;
  const reachable = list.filter(p => p.connected && p.parentId); // 옛 서버(parent_id 없음)면 보낼 대상이 없다
  const dup = findTitleDup(list);
  // C4 첫날 빈 상태 안 B(#59): 연결된 분이 모두 보여 주기로 했고 아직 고른 답이 없을 때(첫날). 나누지 않음·연결 끊김은 기존 카드
  //   리뷰 L1: 연결 0명(새 계약 parents 빈 배열)이면 옛 계약 호환 가짜 한 분(parentId '')이 생긴다 → 빈 상태 B 의 '보시면 보여요' 약속은 틀리므로 기존 카드
  const firstDay = !!info && info.parents.length > 0 && list.every(p => p.parentId && p.connected && p.shared && !p.latest);
  const emptyFold = useEmptyFold();
  // N-10(전문가 리뷰 r2 H, 4:201): 200%에서 위 바 + 하단 응원 버튼 + 탭 바 = 화면 51%(R-12 40%). 큰 글자(150% 이상)에서는
  //   응원 버튼을 하단 고정에서 빼 카드 바로 아래 본문으로 둔다(R-12 단서·C3 '큰 글자 = Dock 주 하나' 결정 #83 ②와 같은 방식). 고정 틀 = 위 바 + 탭 바만
  const big = useWindowDimensions().fontScale >= 1.5;

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
        <AudienceProvider value="child">
          <StateView testID="child-home-error" kind="error" title={error.title} body={error.body} action={{label: error.button, onPress: load}} />
        </AudienceProvider>
      </Screen>
    );
  }

  // 하단 고정: ds Button(자녀 역할). 옛 Screen 틀(탭 화면 TopBar)은 그대로 — 탭 화면용 DsScreen list 틀은 아직 없다
  const bottom = (
    <AudienceProvider value="child">
      {!info ? (
        <Button kind="primary" size="dock" label={c.cheer.button} disabled disabledReason={h.loading_reason} onPress={() => {}} />
      ) : reachable.length ? (
        <Button kind="primary" size="dock" label={c.cheer.button} loading={sending} onPress={() => setSheet(true)} buttonRef={cheerButton} />
      ) : null}
    </AudienceProvider>
  );
  const hasBottom = (!info || reachable.length > 0) && !big;
  // 큰 글자: 응원 버튼은 첫 카드(첫날이면 안내 한 줄) 바로 다음 — 어르신이 여럿이어도 버튼은 하나라 첫 카드 다음(#167 리뷰 M2)
  const inline = big && hasBottomContent(info, reachable.length) ? <View testID="child-home-cheer-inline">{bottom}</View> : null;

  return (
    <View style={styles.flex}>
      {/* 리뷰 L4: 옛 Screen 의 아래 흐림(SCREEN_FADE_H, 겹쳐 그림)에 걸치면 민다(기준 = 흐림 위), 민 요소는 흐림 밑(창 끝)으로 — 흐림 속에 위 테두리가 비치지 않게 */}
      <Screen top={top} bottom={hasBottom ? bottom : undefined} onViewport={h => emptyFold.onViewport(h - SCREEN_FADE_H, h)}>
        <AudienceProvider value="child">
        {error ? (
          <View accessibilityLiveRegion="polite">
            <Text role="body">{error.title}</Text>
          </View>
        ) : null}
        {!info ? (
          <StateView kind="loading" title={appCopy.loading} />
        ) : (
          <>
            {list
              .filter(p => !p.connected)
              .map(p => (
                <View key={`off-${p.parentId}`} accessibilityLiveRegion="polite">
                  <Card tone="notice" testID="child-home-disconnected">
                    <Heading level={2}>{withTitle(h.disconnected.title, p.title)}</Heading>
                    <Text role="body">{h.disconnected.body}</Text>
                    <Button kind="secondary" size="dock" label={h.disconnected.button} loading={making} onPress={() => makeCode(p)} />
                  </Card>
                </View>
              ))}
            {/* 호칭 겹침 안내(시안 C4_title_dup): 겹친 동안 닫을 수 없는 줄 + 이름 고르기 */}
            {dup ? <TitleDupNotice api={api} dup={dup} parents={list} onChanged={load} /> : null}
            {firstDay ? (
              <ChildHomeEmpty fold={emptyFold} action={inline} />
            ) : (
              list.map((p, i) => (
                <React.Fragment key={`card-${p.parentId}`}>
                  <AnswerCard parent={p} withHeader={many} />
                  {i === 0 ? inline : null}
                </React.Fragment>
              ))
            )}
          </>
        )}
        {/* 받기 전(로딩)·카드가 없을 때는 본문 끝 */}
        {!info || (!firstDay && list.length === 0) ? inline : null}
        </AudienceProvider>
      </Screen>
      {/* 응원 시트 v4(시안 child/C4_cheer_sheet_ds4 #40): ds Sheet + Choice(action) 1열. 확정 문구 4개, 누르면 바로 보낸다 */}
      <AudienceProvider value="child">
        <Sheet visible={sheet} onClose={() => setSheet(false)} title={c.cheer.title} sub={c.cheer.hint} returnFocusRef={cheerButton} testID="sheet">
          <Choice
            mode="action"
            testID="cheer"
            items={CHILD_CHEER_KEYS.map(k => ({key: k, label: copy.cheers[k], icon: CHEER_ICON[k]}))}
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
// v4(V4-INDEX '시안 없음, 토큰 효과만'): 배치는 v3 그대로, 글자는 ds 역할(호칭 sub·답 answer(#103)·날짜 body·이야기 bodyLg), 면·선은 v4 토큰
function AnswerCard({parent: p, withHeader}: {parent: ChildParent; withHeader: boolean}) {
  const head = `${p.title}${c.title_suffix}`;
  if (!p.shared || !p.latest) {
    return (
      <View style={withHeader ? styles.card : styles.plain}>
        {withHeader ? (
          <Text role="sub" tone="muted">
            {head}
          </Text>
        ) : (
          <BrandSymbol size={72} />
        )}
        <Text role="bodyLg" style={styles.centerText}>
          {!p.shared ? c.not_shared : c.no_answer}
        </Text>
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
      <Text role="sub" tone="muted">
        {head}
      </Text>
      {/* R-21: answer 는 화면에 1개 — 어르신 한 분일 때만. 여러 분(withHeader)이면 행마다 answerRow(#125 리뷰 M1) */}
      <Text role={withHeader ? 'answerRow' : 'answer'}>{p.latest.choiceLabel}</Text>
      <Text role="body">{formatAnswerDate(p.latest.answeredDate)}</Text>
      <View style={styles.stitch} />
      {p.starter ? (
        // 기능 회의 B3(C4_starter): 첫마디가 있으면 기본 문장을 대체한다(둘 중 하나만)
        <View testID="child-home-starter" style={styles.starter}>
          <Text role="sub" tone="muted">
            {h.starter_label}
          </Text>
          <Text role="bodyLg">{p.starter}</Text>
        </View>
      ) : (
        <Text role="bodyLg">{today ? `${p.latest.choiceLabel}${c.talk}` : h.talk_old}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  centerText: {textAlign: 'center'},
  plain: {paddingVertical: 32, alignItems: 'center', gap: 8},
  card: {backgroundColor: ds.color.card, borderRadius: ds.radius.childCard, padding: 20, paddingTop: 28, gap: 6, marginTop: 8},
  // 테이프: 장식(글자 없음)이라 고정 상자 예외(R-09)
  tape: {position: 'absolute', top: -10, alignSelf: 'center', width: 96, height: 24, backgroundColor: ds.color.tape, transform: [{rotate: '-3deg'}]},
  stitch: {borderTopWidth: 2, borderStyle: 'dashed', borderColor: ds.color.lineSoft, marginVertical: 8},
  starter: {gap: 4},
});

/** 하단 버튼 자리에 그릴 것이 있는지(받기 전 = 비활성 버튼, 연결된 분이 있으면 응원) */
function hasBottomContent(info: ChildSummary | null | undefined, reachable: number): boolean {
  return !info || reachable > 0;
}
