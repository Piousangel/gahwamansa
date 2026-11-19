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
import {formatAnswerDate} from '../../lib/childFormat';
import {appCopy, copy, offlineMessage, Message} from '../../copy/copy';
import {isOffline} from '../types';
import type {HistoryItem, LatestAnswer} from '../types';

const pv = copy.settings.preview;
const ch = copy.child;
const OLDER_ROWS = 2; // 시안: 최근 답 카드 아래 지난 답 2줄

type Data = {title: string; shared: boolean; latest: LatestAnswer | null; items: HistoryItem[]};
type Load = {kind: 'loading'} | {kind: 'ok'; data: Data} | {kind: 'failed'; message: Message; offline: boolean};

// P13 '가족에게 이렇게 보여요'(AP-06, 시안 P13_more '가족에게 이렇게 보여요(자녀 화면과 같은 내용)').
// 자녀 화면(C4 최근 답 카드·C5 지난 답 줄)에 실제로 보이는 것만 보여 준다: 호칭, 고른 답, 날짜(질문은 짧은 형 '산과 바다 중').
// 데이터는 서버 0050 parent_preview_child_view(자녀 child_summary·child_answer_history 와 같은 내부 함수, 본인 항목 1개)를
// 자녀 화면과 같은 파서로 읽은 값이다(PR #11 리뷰 M1): 최근 답은 기간 제한 없음(자녀 C4 와 같음), 지난 답 줄은 서버 prompt_short.
// 호칭은 summary.parents[0].title(가족 기본 호칭 parent_title 이 아님, 리뷰 L1). 날짜는 자녀와 같은 lib formatAnswerDate.
// - 동의 거부·철회: '{호칭}의 최근 답 / 답을 나누지 않는 중이에요', 소개문 sub_off, 아래 두 줄 없음(디자인 확인·리드 결정 11-19).
// - 아직 고른 답 없음: '고른 답이 생기면 여기에 보여요', 소개문·아래 두 줄 그대로.
// - 불러오기 실패·오프라인(PR #11 리뷰 M2): 빈 상태나 기본 호칭을 보이지 않는다(사실이 아닌 미리보기 금지). 기기 틀 안에는 카드 없이
//   오류 Banner(다음 할 일 = 다시 불러오기)만.
export function FamilyPreviewScreen() {
  const navigation = useNavigation();
  const {api, consented} = useSession();
  const [load, setLoad] = useState<Load>({kind: 'loading'});
  const fetchAll = useCallback(async () => {
    setLoad({kind: 'loading'});
    try {
      const {summary, history} = await api.parentPreviewChildView();
      const me = summary.parents[0];
      setLoad({
        kind: 'ok',
        data: {
          title: me?.title ?? summary.parentTitle,
          shared: me ? me.shared : summary.shared,
          latest: me?.latest ?? null,
          items: history[0]?.items ?? [],
        },
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
  // 보여 주는 중인지는 서버 값(자녀와 같은 shared). 불러오기 전·실패 때는 이 기기의 동의 상태로 소개문만 고른다
  const shared = data ? data.shared : consented;
  const latest = data?.shared ? data.latest : null;
  // 지난 답 줄: 자녀 C5 목록에서 최근 답 카드와 같은 날을 뺀 앞 2줄(시안)
  const older = data?.shared
    ? data.items.filter(it => !(latest && it.answeredDate === latest.answeredDate && it.choiceLabel === latest.choiceLabel)).slice(0, OLDER_ROWS)
    : [];
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
      <Text20 testID="preview-sub" size={22} weight="bold" style={styles.ink}>{shared ? pv.sub : pv.sub_off}</Text20>
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
              accessibilityLabel={[head, latest.choiceLabel, formatAnswerDate(latest.answeredDate)].join(', ')}
              style={styles.card}>
              <Text20 weight="bold" style={styles.sub}>{head}</Text20>
              <Text20 size={40} weight="bold" style={styles.ink}>{latest.choiceLabel}</Text20>
              <Text20 weight="bold" style={styles.sub}>{formatAnswerDate(latest.answeredDate)}</Text20>
            </View>
            {older.map(d => (
              <View
                key={`${d.answeredDate}-${d.choiceLabel}`}
                testID="preview-older"
                accessible
                accessibilityLabel={`${formatAnswerDate(d.answeredDate)}, ${d.promptShort}, ${d.choiceLabel}`}
                style={styles.olderRow}>
                <Text20 weight="bold">{formatAnswerDate(d.answeredDate)}</Text20>
                <Text20>{` · ${d.promptShort} `}</Text20>
                <Text20 size={22} weight="bold" style={styles.ink}>{d.choiceLabel}</Text20>
              </View>
            ))}
          </>
        ) : (
          // 동의 거부·철회 또는 아직 답 없음: 자녀 C4 와 같은 머리 + 한 줄. 윗줄 '가족 휴대폰 화면'은 유지(디자인 확인 11-19)
          <View testID={shared ? 'preview-empty' : 'preview-not-shared'} accessible style={[styles.card, styles.cardState]}>
            <Text20 weight="bold" style={styles.sub}>{head}</Text20>
            <Text20 size={22}>{shared ? ch.no_answer : ch.not_shared}</Text20>
          </View>
        )}
      </View>
      {/* 거부·철회면 가족에게 가는 답이 없어 '보이지 않아요' 두 줄은 뺀다(라이터 권고·리드 결정 11-19) */}
      {shared ? (
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
