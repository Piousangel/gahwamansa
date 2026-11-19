import React, {useCallback, useRef, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {ChildParams} from '../../app/ChildStack';
import {TopBar} from '../../ui/TopBar';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import {appCopy, copy, withTitle} from '../../copy/copy';
import {color, radius} from '../../ui/tokens';
import type {HistoryItem, ParentHistory} from '../types';
import {formatAnswerDate} from './formatDate';
import {BrandSymbol} from '../../ui/assets/brandSymbol';
import {useAnswerHistory, useApi} from '../../shared/useChildData';
import {PaidSheet} from './PaidSheet';
import {track} from '../track';

const c = copy.child;
const p = c.past;

// C5 지난 답 v4: 어르신별 최근 30일 고른 답, 최신순(날짜 · 질문 짧은 형 · 고른 답).
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
    body = (
      <View testID="child-past-error" style={styles.center}>
        <Text20 weight="bold" style={styles.centerText}>{error.title}</Text20>
        {error.body ? <Text20 style={styles.centerText}>{error.body}</Text20> : null}
        <BigButton variant="secondary" label={error.button} onPress={load} />
      </View>
    );
  } else if (loading && !info) {
    body = <Text20>{appCopy.loading}</Text20>;
  } else if (!many && list[0] && !list[0].shared) {
    body = <EmptyState text={c.not_shared} />;
  } else if (!many && !(list[0]?.items.length)) {
    body = <EmptyState text={c.no_answer} />;
  } else {
    body = (
      <>
        <Text20 style={styles.sub}>{p.sub}</Text20>
        {list.map(x => (
          <ParentSection key={x.parentId} history={x} header={many} />
        ))}
      </>
    );
  }

  return (
    <Screen top={<TopBar title={title} settingsLabel={copy.settings.open} onSettings={() => navigation.navigate('Settings')} />}>
      <View testID="child-past" />
      {error && info ? <Text20 weight="bold" accessibilityLiveRegion="polite">{error.title}</Text20> : null}
      {body}
      {/* AC-01: 이야기 주제 추천 행('곧 유료' 배지, AC-09)을 누르면 C6 곧 유료 시트 */}
      {info && anyShared && !error ? (
        <Pressable
          ref={topicRef}
          testID="child-past-topic"
          style={styles.topic}
          accessibilityRole="button"
          accessibilityLabel={`${p.topic}, ${p.topic_badge}`}
          onPress={() => setPaidOpen(true)}>
          <Text20 weight="bold" style={styles.flex}>{p.topic}</Text20>
          <View style={styles.badge}>
            <Text20 weight="bold">{p.topic_badge}</Text20>
          </View>
        </Pressable>
      ) : null}
      <PaidSheet api={api} visible={paidOpen} onClose={() => setPaidOpen(false)} returnFocusRef={topicRef} />
    </Screen>
  );
}

// 빈·보여 주지 않는 중: C4 와 같은 심볼(72) + 가운데 글자(C5_history)
function EmptyState({text}: {text: string}) {
  return (
    <View testID="child-past-empty" style={styles.empty}>
      <BrandSymbol size={72} />
      <Text20 style={styles.centerText}>{text}</Text20>
    </View>
  );
}

function ParentSection({history: h, header}: {history: ParentHistory; header: boolean}) {
  return (
    <View style={styles.section}>
      {header ? (
        <Text20 size={24} weight="bold" accessibilityRole="header">{h.title}</Text20>
      ) : null}
      {!h.shared ? (
        <Text20>{c.not_shared}</Text20>
      ) : h.items.length === 0 ? (
        <Text20>{c.no_answer}</Text20>
      ) : (
        h.items.map(it => <Row key={`${h.parentId}-${it.answeredDate}-${it.choiceLabel}`} item={it} />)
      )}
    </View>
  );
}

function Row({item}: {item: HistoryItem}) {
  const date = formatAnswerDate(item.answeredDate);
  const q = item.promptShort;
  return (
    <View
      testID="child-past-item"
      style={styles.row}
      accessible
      accessibilityLabel={p.row_a11y.split('{날짜}').join(date).split('{질문}').join(q).split('{답}').join(item.choiceLabel)}>
      <View style={styles.flex}>
        <Text20 style={styles.sub}>{date}</Text20>
        <Text20>{`· ${q}`}</Text20>
      </View>
      <Text20 size={28} weight="bold" style={styles.answer}>{item.choiceLabel}</Text20>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  center: {alignItems: 'center', gap: 8, paddingTop: 48},
  centerText: {textAlign: 'center'},
  empty: {alignItems: 'center', gap: 8, paddingVertical: 32},
  sub: {color: color.inkSub},
  section: {gap: 8},
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.card, borderRadius: radius.childCard,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  answer: {color: color.inkTitle, flexShrink: 0, maxWidth: '50%', textAlign: 'right'},
  topic: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.paperSoft, borderRadius: radius.card, padding: 16, marginTop: 8},
  badge: {backgroundColor: color.noticeSoft, borderRadius: radius.chip, paddingHorizontal: 10, paddingVertical: 2},
});
