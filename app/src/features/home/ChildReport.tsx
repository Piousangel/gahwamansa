import React, {useCallback, useRef, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {TopBar} from '../../ui/TopBar';
import {Screen} from '../../ui/Screen';
import {AudienceProvider, Heading, SignPair, StateView, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {appCopy, copy, withTitle} from '../../copy/copy';
import type {HistoryItem, ParentHistory} from '../types';
import {formatAnswerDate} from './formatDate';
import {BrandSymbol} from '../../ui/assets/brandSymbol';
import {useAnswerHistory, useApi} from '../../shared/useChildData';
import {PaidSheet} from './PaidSheet';
import {track} from '../track';

const c = copy.child;
const p = c.past;

// C5 지난 답 v4(부품만 ui/ds): 어르신별 최근 30일 고른 답, 최신순. 날짜 카드 = 날짜 · 짧은 질문 한 줄 + 두 칸 나란히
// (C-4 안 1, D-4 2026-11-24 — 시안 docs/design/2026-11-24-d2-d3-c4/c4-child-history.html): A 왼쪽·B 오른쪽, 고른 칸만 노랑 팻말.
// 팻말이 카드마다 하나라 R-22 '화면당 1개'의 예외 자리(child-past-list > child-past-item, testUtils/designRules.R22_LIST_EXEMPT).
// 빈 날·개수·빈도·연속 집계 없음, 페이지 나눔 없음. 어르신이 2명 이상이면 호칭 머리글로 나누고 제목은 "지난 답".
export function ChildReport() {
  const navigation = useNavigation<NativeStackNavigationProp<ChildParams>>();
  const {info, error, loading, load} = useAnswerHistory();
  const list = info ?? [];
  const many = list.length > 1;
  const title = many ? p.title_many : withTitle(p.title, list[0]?.title ?? '부모님');
  const anyShared = list.length === 0 || list.some(x => x.shared);
  const api = useApi();
  const [paidOpen, setPaidOpen] = useState(false);
  const topicRef = useRef<React.ComponentRef<typeof View>>(null);
  // AC-05: 지난 답을 받아 보여 준 때, 화면에 들어올 때마다 한 번(child_report_viewed, 속성 없음)
  const loaded = !!info;
  useFocusEffect(
    useCallback(() => {
      if (loaded) {
        track(api, 'child_report_viewed');
      }
    }, [loaded, api]),
  );

  let body: React.ReactNode;
  if (error && !info) {
    body = <StateView testID="child-past-error" kind="error" title={error.title} body={error.body || undefined} action={{label: error.button, onPress: load}} />;
  } else if (loading && !info) {
    body = <StateView kind="loading" title={appCopy.loading} />;
  } else if (!many && list[0] && !list[0].shared) {
    body = <EmptyState text={c.not_shared} />;
  } else if (!many && !(list[0]?.items.length)) {
    body = <EmptyState text={c.no_answer} />;
  } else {
    body = (
      <>
        <Text role="sub" tone="muted">
          {p.sub}
        </Text>
        {list.map(x => (
          <ParentSection key={x.parentId} history={x} header={many} />
        ))}
      </>
    );
  }

  return (
    <Screen top={<TopBar title={title} settingsLabel={copy.settings.open} onSettings={() => navigation.navigate('Settings')} />}>
      <AudienceProvider value="child">
        <View testID="child-past" />
        {error && info ? (
          <View accessibilityLiveRegion="polite">
            <Text role="body">{error.title}</Text>
          </View>
        ) : null}
        {body}
        {/* AC-01: 이야기 주제 추천 행('곧 유료' 배지, AC-09)을 누르면 C6 곧 유료 시트 */}
        {info && anyShared && !error ? (
          <Pressable
            ref={topicRef}
            testID="child-past-topic"
            style={({pressed}) => [styles.topic, pressed ? styles.topicPressed : null]}
            accessibilityRole="button"
            accessibilityLabel={`${p.topic}, ${p.topic_badge}`}
            onPress={() => setPaidOpen(true)}>
            <Text role="bodyLg" style={styles.flex}>
              {p.topic}
            </Text>
            <View style={styles.badge}>
              <Text role="sub">{p.topic_badge}</Text>
            </View>
          </Pressable>
        ) : null}
      </AudienceProvider>
      <PaidSheet api={api} visible={paidOpen} onClose={() => setPaidOpen(false)} returnFocusRef={topicRef} />
    </Screen>
  );
}

// 빈·보여 주지 않는 중: C4 와 같은 심볼(72) + 가운데 글자(C5_history)
function EmptyState({text}: {text: string}) {
  return (
    <View testID="child-past-empty" style={styles.empty}>
      <BrandSymbol size={72} />
      <Text role="bodyLg" style={styles.centerText}>
        {text}
      </Text>
    </View>
  );
}

function ParentSection({history: h, header}: {history: ParentHistory; header: boolean}) {
  return (
    <View style={styles.section}>
      {header ? <Heading level={2}>{h.title}</Heading> : null}
      {!h.shared ? (
        <Text role="body">{c.not_shared}</Text>
      ) : h.items.length === 0 ? (
        <Text role="body">{c.no_answer}</Text>
      ) : (
        <View testID="child-past-list" style={styles.list}>
          {h.items.map(it => (
            <Row key={`${h.parentId}-${it.answeredDate}-${it.choiceLabel}`} item={it} />
          ))}
        </View>
      )}
    </View>
  );
}

function Row({item}: {item: HistoryItem}) {
  const date = formatAnswerDate(item.answeredDate);
  const q = item.promptShort;
  const label = p.row_a11y.split('{날짜}').join(date).split('{질문}').join(q).split('{답}').join(item.choiceLabel);
  // 카드 한 줄로 읽는다(날짜·질문·고른 답). 빈 날은 서버가 주지 않아 카드가 없다(11-18 U6)
  return (
    <View testID="child-past-item" style={styles.row} accessible accessibilityLabel={label}>
      <Text role="sub" tone="muted">
        {`${date} · ${q}`}
      </Text>
      <SignPair optionA={item.optionA} optionB={item.optionB} chosen={item.choiceLabel} readLabel={item.choiceLabel} testID="child-past-pair" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  centerText: {textAlign: 'center'},
  empty: {alignItems: 'center', gap: 8, paddingVertical: 32},
  section: {gap: 8},
  list: {gap: 8},
  row: {gap: 8, backgroundColor: ds.color.card, borderRadius: ds.radius.childCard, paddingTop: 14, paddingBottom: 16, paddingHorizontal: 16},
  topic: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ds.color.paperSoft, borderRadius: ds.radius.card, padding: 16, marginTop: 8, minHeight: ds.touch.child.min},
  topicPressed: {backgroundColor: ds.color.actionSoft},
  badge: {backgroundColor: ds.color.noticeSoft, borderRadius: ds.radius.chip, paddingHorizontal: 10, paddingVertical: 2},
});
