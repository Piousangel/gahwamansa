import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Heading, Text} from '../ui/ds';
import {ds} from '../ui/ds/roles';
import {copy} from '../copy/copy';
import {formatAnswerDate} from '../lib/childFormat';
import type {ChildParent, MonthItem} from '../features/types';

const m = copy.child.home.month;

/** '최근 한 달 고르신 것'을 보일 어르신만(서버 0068 month 키가 있는 분 = v6 이상 동의). 없으면 빈 배열 → 목록을 그리지 않는다 */
export function monthParents(parents: ChildParent[]): (ChildParent & {month: MonthItem[]})[] {
  return parents.filter((p): p is ChildParent & {month: MonthItem[]} => p.shared && Array.isArray(p.month));
}

// 자녀 홈 '최근 한 달 고르신 것'(기획 v2.1 Q2, 콘텐츠 갈래 설계서 4절 W4). 자녀 C4 와 어르신 미리보기 P13(Q13)이 같이 쓴다(기능 간 import 대신 shared).
// - 사실 목록: 날짜 · 짧은 질문 / 고르신 보기. 서버 순서(날짜 내림차순) 그대로 — 다시 정렬·묶음·세기 없음, 숫자는 날짜뿐(Q3).
// - 답마다 '챙겨 드릴 거리' 한 줄(있을 때만, 그 답 바로 아래 — 리드 권장안, 오너 디자인 질문 5번 대기). 화면에는 '› 문장', 읽기는 '챙겨 드릴 거리, 문장'.
// - 어르신이 두 분 이상이면 분마다 호칭 머리 + 각자 목록(섞이면 오표시, dev-server-notes §1). 빈 목록은 '고르신 것이 여기 모여요'.
// - 날짜 표기는 기존 지난 답 카드와 같은 formatAnswerDate(오너 질문 1번 대기).
// - 행은 누르는 것이 아니다(accessible 한 덩어리, 역할 없음). 말줄임 없음 — 큰 글자 200%에서도 줄바꿈.
export function MonthList({parents, testID = 'month-list'}: {parents: ChildParent[]; testID?: string}) {
  const shown = monthParents(parents);
  if (!shown.length) {
    return null;
  }
  const many = parents.length > 1;
  return (
    <View testID={testID} style={styles.wrap}>
      <Heading level={2}>{m.title}</Heading>
      {shown.map(p => (
        <View key={`month-${p.parentId}`} testID="month-parent" style={styles.group}>
          {many ? (
            // #298 QA-1 L2: 분마다 머리는 머리글 — 화면 읽기가 분 단위로 건너뛸 수 있게
            <Text role="sub" tone="muted" accessibilityRole="header">
              {p.title}
            </Text>
          ) : null}
          {p.month.length ? (
            // 같은 날·같은 보기가 둘일 수 있어(질문이 다름) 순서까지 키에 넣는다. 목록은 서버 순서 그대로라 순서가 곧 자리다
            p.month.map((it, i) => <MonthRow key={`${i}-${it.answeredDate}-${it.choiceLabel}`} item={it} who={many ? p.title : null} />)
          ) : (
            <Text role="body" testID="month-empty">
              {m.empty}
            </Text>
          )}
        </View>
      ))}
      <Text role="sub" tone="muted">
        {m.expire_note}
      </Text>
    </View>
  );
}

function MonthRow({item, who}: {item: MonthItem; who: string | null}) {
  const date = formatAnswerDate(item.answeredDate);
  const label = [who, date, item.promptShort, item.choiceLabel, item.care ? `${m.care_label}, ${item.care}` : null].filter(Boolean).join(', ');
  return (
    <View testID="month-row" accessible accessibilityLabel={label} style={styles.row}>
      <Text role="body" tone="muted">
        {`${date} · ${item.promptShort}`}
      </Text>
      <Text role="answerRow">{item.choiceLabel}</Text>
      {item.care ? (
        <Text role="body" testID="month-care">
          {`${m.care_mark} ${item.care}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 12, alignSelf: 'stretch', marginTop: 8},
  group: {gap: 8},
  row: {backgroundColor: ds.color.card, borderRadius: ds.radius.row, padding: 16, gap: 4},
});
