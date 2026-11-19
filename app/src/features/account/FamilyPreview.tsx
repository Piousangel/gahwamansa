import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSession} from '../../app/session';
import {Screen} from '../../ui/Screen';
import {BackBar} from '../../app/BackBar';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {Banner} from '../../ui/Banner';
import {color, radius, shadow} from '../../ui/tokens';
import {formatAnswerDate, pairShort} from '../../lib/childFormat';
import {appCopy, copy, offlineMessage, Message} from '../../copy/copy';
import {isOffline} from '../types';
import type {HistoryDay} from '../../api/contract/history';

const pv = copy.settings.preview;
const ch = copy.child;
const DEFAULT_TITLE = '부모님'; // 호칭이 없을 때(서버 응답 성공 + 호칭 null 일 때만. 실패 때는 쓰지 않는다)
const OLDER_ROWS = 2; // 시안: 최근 답 카드 아래 지난 답 2줄

type Data = {title: string; answered: HistoryDay[]};
type Load = {kind: 'loading'} | {kind: 'ok'; data: Data} | {kind: 'failed'; message: Message; offline: boolean};

// P13 '가족에게 이렇게 보여요'(AP-06, 시안 P13_more '가족에게 이렇게 보여요(자녀 화면과 같은 내용)').
// 자녀 화면(C4 최근 답 카드·C5 지난 답 줄)에 실제로 보이는 것만 보여 준다: 호칭, 고른 답, 날짜(질문은 짧은 형 '산과 바다 중').
// 날짜·짧은 질문은 자녀 화면과 같은 lib/childFormat 함수(formatAnswerDate·pairShort, PR #11 리뷰 M1).
// - 동의 거부·철회: '{호칭}의 최근 답 / 답을 나누지 않는 중이에요', 소개문 sub_off, 아래 두 줄 없음(디자인 확인·리드 결정 11-19).
// - 아직 고른 답 없음: '고른 답이 생기면 여기에 보여요', 소개문·아래 두 줄 그대로.
// - 불러오기 실패·오프라인(PR #11 리뷰 M2): 빈 상태나 기본 호칭을 보이지 않는다(사실이 아닌 미리보기 금지). 기기 틀 안에는 카드 없이
//   오류 Banner(다음 할 일 = 다시 불러오기)만.
// 알려진 차이(PR #11 리뷰 M1, 서버 0050 parent_preview_child_view() 들어오면 데이터 출처를 그 RPC 로 바꾼다):
//   ① 데이터 출처가 자녀와 같은 child_summary 가 아니라 어르신 parent_history(최근 30일) — 마지막 답이 30일보다 오래되면 자녀는 그 답을 보는데
//      여기는 '고른 답이 생기면 여기에 보여요'를 보인다. ② 짧은 질문은 서버 prompt_short 대신 앱 pairShort(받침 규칙만, 숫자 끝 '과' 규칙 없음).
export function FamilyPreviewScreen() {
  const navigation = useNavigation();
  const {api, consented} = useSession();
  const [load, setLoad] = useState<Load>({kind: 'loading'});
  const fetchAll = useCallback(async () => {
    setLoad({kind: 'loading'});
    try {
      const [family, history] = await Promise.all([api.parentFamilyList(), api.parentHistory(30)]);
      setLoad({
        kind: 'ok',
        data: {title: family.title ?? DEFAULT_TITLE, answered: history.days.filter(d => d.choice_label !== null)},
      });
    } catch (e) {
      const offline = isOffline(e);
      setLoad({kind: 'failed', message: offline ? offlineMessage : copy.errors.server, offline});
    }
  }, [api]);
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const data = load.kind === 'ok' ? load.data : null;
  const head = data ? `${data.title}${ch.title_suffix}` : '';
  const latest = consented ? data?.answered[0] : undefined;
  const older = consented && data ? data.answered.slice(1, 1 + OLDER_ROWS) : [];
  return (
    <Screen
      top={
        <>
          <BackBar />
          <Text20 size={30} weight="bold" accessibilityRole="header" style={styles.title}>{pv.title}</Text20>
        </>
      }
      bottom={<BigButton label={pv.ok} onPress={() => navigation.goBack()} />}>
      {/* 거부·철회 상태: 라이터 확정 sub_off(11-19). 보여 주는 중이면 기존 sub */}
      <Text20 testID="preview-sub" size={22} weight="bold" style={styles.ink}>{consented ? pv.sub : pv.sub_off}</Text20>
      {/* 리뷰 L3: 불러오기가 끝나 내용이 바뀌면 화면 읽기에 한 번 알린다(polite) */}
      <View testID="preview-device" style={styles.device} accessibilityLiveRegion="polite">
        <Text20 weight="bold" style={styles.sub}>{pv.device_label}</Text20>
        {load.kind === 'loading' ? (
          <Text20 testID="preview-loading">{appCopy.loading}</Text20>
        ) : load.kind === 'failed' ? (
          <Banner
            testID="preview-failed"
            kind={load.offline ? 'offline' : 'error'}
            text={load.message.title}
            action={{label: load.message.button, onPress: fetchAll}}
          />
        ) : latest ? (
          <>
            <View
              testID="preview-latest"
              accessible
              accessibilityLabel={[head, latest.choice_label, formatAnswerDate(latest.session_date)].join(', ')}
              style={styles.card}>
              <Text20 weight="bold" style={styles.sub}>{head}</Text20>
              <Text20 size={40} weight="bold" style={styles.ink}>{latest.choice_label}</Text20>
              <Text20 weight="bold" style={styles.sub}>{formatAnswerDate(latest.session_date)}</Text20>
            </View>
            {older.map(d => (
              <View
                key={d.session_date}
                testID="preview-older"
                accessible
                accessibilityLabel={`${formatAnswerDate(d.session_date)}, ${pairShort(d.question.option_a, d.question.option_b)}, ${d.choice_label}`}
                style={styles.olderRow}>
                <Text20 weight="bold">{formatAnswerDate(d.session_date)}</Text20>
                <Text20>{` · ${pairShort(d.question.option_a, d.question.option_b)} `}</Text20>
                <Text20 size={22} weight="bold" style={styles.ink}>{d.choice_label}</Text20>
              </View>
            ))}
          </>
        ) : (
          // 동의 거부·철회 또는 아직 답 없음: 자녀 C4 와 같은 머리 + 한 줄. 윗줄 '가족 휴대폰 화면'은 유지(디자인 확인 11-19)
          <View testID={consented ? 'preview-empty' : 'preview-not-shared'} accessible style={[styles.card, styles.cardState]}>
            <Text20 weight="bold" style={styles.sub}>{head}</Text20>
            <Text20 size={22}>{consented ? ch.no_answer : ch.not_shared}</Text20>
          </View>
        )}
      </View>
      {/* 거부·철회면 가족에게 가는 답이 없어 '보이지 않아요' 두 줄은 뺀다(라이터 권고·리드 결정 11-19) */}
      {consented ? (
        <View testID="preview-notes" style={styles.notes}>
          <Text20>{`• ${pv.not_typed}`}</Text20>
          <Text20>{`• ${pv.not_days}`}</Text20>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {color: color.inkTitle, paddingBottom: 8},
  ink: {color: color.inkTitle},
  sub: {color: color.inkSub},
  device: {backgroundColor: color.paperSoft, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 18, gap: 10},
  card: {backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 18, gap: 6, boxShadow: shadow.soft},
  cardState: {minHeight: 150, justifyContent: 'center'}, // 답 있음 카드와 비슷하게(디자인 확인 11-19)
  olderRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline'},
  notes: {gap: 4, paddingLeft: 4},
});
